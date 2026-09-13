import { upsertSecretSchema } from "@reminder/domain";

import {
  errorResponse,
  jsonBody,
  noStore,
  requestErrorResponse,
  secretsRepository,
} from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; envId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id, envId } = await context.params;
    const secrets = await secretsRepository().listSecrets(id, envId);
    return noStore(Response.json(secrets));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id, envId } = await context.params;
    const body = await jsonBody(request);
    const input = upsertSecretSchema.parse(body);
    const secret = await secretsRepository().upsertSecret(id, envId, input);

    return noStore(
      Response.json(secret, {
        status: 200,
      }),
    );
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
