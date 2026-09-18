import { createExpenseSchema, expenseFilterSchema } from "@reminder/domain";

import {
  errorResponse,
  expensesRepository,
  jsonBody,
  noStore,
  requestErrorResponse,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filterInput = {
      q: url.searchParams.get("q") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      limit: url.searchParams.get("limit") ?? 50,
      offset: url.searchParams.get("offset") ?? 0,
    };

    const parsedFilter = expenseFilterSchema.parse(filterInput);
    const repo = expensesRepository();
    const result = await repo.listExpenses(parsedFilter);

    return noStore(Response.json(result));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const input = createExpenseSchema.parse(body);
    const expense = await expensesRepository().createExpense(input);

    return noStore(
      Response.json(expense, {
        status: 201,
        headers: { Location: `/api/v1/expenses/${expense.id}` },
      }),
    );
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
