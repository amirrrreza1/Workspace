import { importEnvSchema } from "@reminder/domain";

import { errorResponse, jsonBody, noStore, requestErrorResponse, secretsRepository } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; envId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id, envId } = await context.params;
    const body = await jsonBody(request);
    const input = importEnvSchema.parse(body);
    const result = await secretsRepository().importEnv(id, envId, input);

    return noStore(Response.json(result));
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
