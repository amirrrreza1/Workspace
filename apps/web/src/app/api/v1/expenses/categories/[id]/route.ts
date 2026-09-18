import { updateExpenseCategorySchema } from "@reminder/domain";

import {
  errorResponse,
  expensesRepository,
  jsonBody,
  noStore,
  requestErrorResponse,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await jsonBody(request);
    const input = updateExpenseCategorySchema.parse(body);
    const updated = await expensesRepository().updateCategory(id, input);

    return noStore(Response.json(updated));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await expensesRepository().deleteCategory(id);

    return noStore(new Response(null, { status: 204 }));
  } catch (error) {
    return errorResponse(error);
  }
}
