import { createExpenseCategorySchema } from "@reminder/domain";

import {
  errorResponse,
  expensesRepository,
  jsonBody,
  noStore,
  requestErrorResponse,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await expensesRepository().listCategories();
    return noStore(Response.json(categories));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const input = createExpenseCategorySchema.parse(body);
    const category = await expensesRepository().createCategory(input);

    return noStore(Response.json(category, { status: 201 }));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
