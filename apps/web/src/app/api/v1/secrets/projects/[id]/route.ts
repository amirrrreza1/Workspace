import { updateProjectSchema } from "@reminder/domain";

import { errorResponse, jsonBody, noStore, requestErrorResponse, secretsRepository } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const project = await secretsRepository().getProject(id);
    if (!project) {
      return noStore(Response.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 }));
    }
    return noStore(Response.json(project));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await jsonBody(request);
    const input = updateProjectSchema.parse(body);
    const updated = await secretsRepository().updateProject(id, input);
    return noStore(Response.json(updated));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const deleted = await secretsRepository().deleteProject(id);
    if (!deleted) {
      return noStore(Response.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 }));
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
