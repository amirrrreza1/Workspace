import { createRegularExpenseItemSchema } from "@reminder/domain";

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
    const items = await expensesRepository().listRegularItems();
    return noStore(Response.json(items));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const input = createRegularExpenseItemSchema.parse(body);
    const item = await expensesRepository().createRegularItem(input);

    return noStore(Response.json(item, { status: 201 }));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
