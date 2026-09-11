import { backupRepository, errorResponse, noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backup = await backupRepository().exportBackup();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const filename = `workspace-backup-${timestamp}.json`;

    const response = new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
