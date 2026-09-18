import { getConfig } from "@reminder/config";
import { seedDemoData } from "@reminder/db";

import { errorResponse, noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const config = getConfig();
    if (!config.demoMode) {
      return noStore(
        Response.json(
          {
            error: {
              code: "DEMO_MODE_DISABLED",
              message: "Demo mode is not enabled on this instance.",
              meta: null,
            },
          },
          { status: 403 },
        ),
      );
    }

    const result = await seedDemoData(config.DATABASE_URL, config.SECRETS_MASTER_KEY);
    return noStore(
      Response.json({
        success: true,
        message: "Workspace demo data has been reset to its initial state.",
        restored: result.restored,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
