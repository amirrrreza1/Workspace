import { errorResponse, noStore, secretsRepository } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; envId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id, envId } = await context.params;
    const envText = await secretsRepository().exportEnv(id, envId);

    const response = new Response(envText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename=".env"',
      },
    });
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
