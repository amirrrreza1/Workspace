import { errorResponse, noStore, requestErrorResponse, secretsRepository } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; envId: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id, envId } = await context.params;
    const deleted = await secretsRepository().deleteEnvironment(id, envId);
    if (!deleted) {
      return noStore(Response.json({ error: { code: "NOT_FOUND", message: "Environment not found." } }, { status: 404 }));
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
