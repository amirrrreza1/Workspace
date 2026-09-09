import { createEnvironmentSchema } from "@reminder/domain";

import { errorResponse, jsonBody, noStore, requestErrorResponse, secretsRepository } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const environments = await secretsRepository().listEnvironments(id);
    return noStore(Response.json(environments));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await jsonBody(request);
    const input = createEnvironmentSchema.parse(body);
    const environment = await secretsRepository().createEnvironment(id, input);

    return noStore(
      Response.json(environment, {
        status: 201,
      }),
    );
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
