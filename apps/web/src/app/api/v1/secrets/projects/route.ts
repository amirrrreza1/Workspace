import { createProjectSchema } from "@reminder/domain";

import {
  errorResponse,
  jsonBody,
  noStore,
  requestErrorResponse,
  secretsRepository,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await secretsRepository().listProjects();
    return noStore(Response.json(projects));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const input = createProjectSchema.parse(body);
    const project = await secretsRepository().createProject(input);

    return noStore(
      Response.json(project, {
        status: 201,
        headers: { Location: `/api/v1/secrets/projects/${project.id}` },
      }),
    );
  } catch (error) {
    return requestErrorResponse(error) ?? errorResponse(error);
  }
}
