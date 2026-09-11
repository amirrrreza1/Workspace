import { getConfig } from "@reminder/config";
import { sendTelegramDocument } from "@reminder/notifications";

import { backupRepository, errorResponse, noStore, repository } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = getConfig();

    if (!config.TELEGRAM_BOT_TOKEN) {
      return noStore(
        Response.json(
          {
            error: {
              code: "TELEGRAM_NOT_CONFIGURED",
              message: "Telegram bot token is not configured on the server (TELEGRAM_BOT_TOKEN).",
              meta: null,
            },
          },
          { status: 400 },
        ),
      );
    }

    let inputChatId: string | undefined;
    try {
      const body = (await request.json().catch(() => ({}))) as { chatId?: string };
      inputChatId = typeof body.chatId === "string" ? body.chatId.trim() : undefined;
    } catch {
      // Body may be empty, which is acceptable if configured in settings
    }

    const currentSettings = await repository().getSettings();
    const targetChatId =
      inputChatId ||
      currentSettings.backupTelegramChatId?.trim() ||
      config.TELEGRAM_BACKUP_CHAT_ID?.trim();

    if (!targetChatId) {
      return noStore(
        Response.json(
          {
            error: {
              code: "CHAT_ID_REQUIRED",
              message:
                "Please specify a Telegram channel username (e.g. @my_channel) or chat ID.",
              meta: null,
            },
          },
          { status: 400 },
        ),
      );
    }

    const backup = await backupRepository().exportBackup();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const filename = `workspace-backup-${timestamp}.json`;
    const jsonString = JSON.stringify(backup, null, 2);

    const caption = [
      "<b>📦 Workspace Backup</b>",
      `📅 <i>${new Date().toUTCString()}</i>`,
      "",
      `🔔 <b>Reminders:</b> ${backup.data.reminders.length}`,
      `📝 <b>Notes:</b> ${backup.data.notes.length}`,
      `🔑 <b>Projects:</b> ${backup.data.projects.length}`,
    ].join("\n");

    const receipt = await sendTelegramDocument({
      botToken: config.TELEGRAM_BOT_TOKEN,
      chatId: targetChatId,
      filename,
      content: jsonString,
      caption,
      contentType: "application/json",
    });

    return noStore(
      Response.json({
        success: true,
        message: `Backup successfully sent to ${targetChatId}.`,
        messageId: receipt.providerMessageId,
        acceptedAt: receipt.acceptedAt,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
