import { updateNoteSchema } from "@reminder/domain";

import { errorResponse, jsonBody, noStore, notesRepository, requestErrorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const note = await notesRepository().getById(id);
    if (!note) {
      return noStore(
        Response.json(
          { error: { code: "NOT_FOUND", message: "Note not found." } },
          { status: 404 },
        ),
      );
    }
    return noStore(Response.json(note));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await jsonBody(request);
    const input = updateNoteSchema.parse(body);
    const updated = await notesRepository().update(id, input);
    return noStore(Response.json(updated));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const deleted = await notesRepository().delete(id);
    if (!deleted) {
      return noStore(
        Response.json(
          { error: { code: "NOT_FOUND", message: "Note not found." } },
          { status: 404 },
        ),
      );
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
