import { updateExpenseSchema } from "@reminder/domain";

import {
  errorResponse,
  expensesRepository,
  jsonBody,
  noStore,
  NotFoundError,
  requestErrorResponse,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const expense = await expensesRepository().getExpenseById(id);
    if (!expense) throw new NotFoundError("Expense not found.");

    return noStore(Response.json(expense));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await jsonBody(request);
    const input = updateExpenseSchema.parse(body);
    const updated = await expensesRepository().updateExpense(id, input);

    return noStore(Response.json(updated));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await expensesRepository().deleteExpense(id);

    return noStore(new Response(null, { status: 204 }));
  } catch (error) {
    return errorResponse(error);
  }
}
