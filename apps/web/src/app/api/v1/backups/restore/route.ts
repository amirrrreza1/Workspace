import { workspaceBackupSchema } from "@reminder/domain";

import { backupRepository, errorResponse, noStore } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return noStore(
        Response.json(
          {
            error: {
              code: "DEMO_MODE_RESTRICTION",
              message:
                "Restoring custom backups is disabled in Demo Mode for security. Use 'Reset Demo Data' to restore the sample workspace.",
              meta: null,
            },
          },
          { status: 403 },
        ),
      );
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return noStore(
          Response.json(
            {
              error: {
                code: "INVALID_BACKUP_FILE",
                message: "No backup file was uploaded.",
                meta: null,
              },
            },
            { status: 400 },
          ),
        );
      }
      const text = await (file as Blob).text();
      try {
        payload = JSON.parse(text);
      } catch {
        return noStore(
          Response.json(
            {
              error: {
                code: "INVALID_JSON",
                message: "The uploaded file is not valid JSON.",
                meta: null,
              },
            },
            { status: 400 },
          ),
        );
      }
    } else if (contentType.includes("application/json")) {
      try {
        payload = await request.json();
      } catch {
        return noStore(
          Response.json(
            {
              error: {
                code: "INVALID_JSON",
                message: "The request body is not valid JSON.",
                meta: null,
              },
            },
            { status: 400 },
          ),
        );
      }
    } else {
      return noStore(
        Response.json(
          {
            error: {
              code: "UNSUPPORTED_MEDIA_TYPE",
              message: "Expected multipart/form-data or application/json.",
              meta: null,
            },
          },
          { status: 415 },
        ),
      );
    }

    const backup = workspaceBackupSchema.parse(payload);
    const result = await backupRepository().restoreBackup(backup);

    return noStore(Response.json(result));
  } catch (error) {
    return errorResponse(error);
  }
}
