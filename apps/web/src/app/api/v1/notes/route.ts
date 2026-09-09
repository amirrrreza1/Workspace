import { createNoteSchema, noteFilterSchema } from "@reminder/domain";

import { errorResponse, jsonBody, noStore, notesRepository, requestErrorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filterInput = {
      q: url.searchParams.get("q") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      isPinned: url.searchParams.get("isPinned") ?? undefined,
      isArchived: url.searchParams.get("isArchived") ?? undefined,
      sort: url.searchParams.get("sort") ?? "updated_desc",
    };

    const parsedFilter = noteFilterSchema.parse(filterInput);
    const repo = notesRepository();
    const [items, summary] = await Promise.all([repo.list(parsedFilter), repo.getSummary()]);

    return noStore(
      Response.json({
        items,
        summary,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const input = createNoteSchema.parse(body);
    const note = await notesRepository().create(input);

    return noStore(
      Response.json(note, {
        status: 201,
        headers: { Location: `/api/v1/notes/${note.id}` },
      }),
    );
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
