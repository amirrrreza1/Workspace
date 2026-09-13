import {
  formatEnvFile,
  parseEnvFile,
  type CreateEnvironmentInput,
  type CreateProjectInput,
  type ImportEnvInput,
  type Project,
  type ProjectEnvironment,
  type ProjectSecret,
  type UpdateEnvironmentInput,
  type UpdateProjectInput,
  type UpsertSecretInput,
} from "@reminder/domain";
import type { Sql } from "postgres";

import { decryptSecret, encryptSecret } from "./crypto.js";
import { ConflictError, NotFoundError } from "./errors.js";
import { createSql } from "./index.js";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  environment_count: string;
  secret_count: string;
  created_at: Date;
  updated_at: Date;
};

type EnvironmentRow = {
  id: string;
  project_id: string;
  name: string;
  secret_count: string;
  created_at: Date;
  updated_at: Date;
};

type SecretRow = {
  id: string;
  project_id: string;
  environment_id: string;
  key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  comment: string | null;
  is_secret: boolean;
  created_at: Date;
  updated_at: Date;
};

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    environmentCount: Number(row.environment_count ?? 0),
    secretCount: Number(row.secret_count ?? 0),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToEnvironment(row: EnvironmentRow): ProjectEnvironment {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    secretCount: Number(row.secret_count ?? 0),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class SecretsRepository {
  private readonly masterKey: string;

  constructor(
    private readonly databaseUrl: string,
    masterKey?: string,
  ) {
    this.masterKey = masterKey || databaseUrl;
  }

  private async withSql<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const sql = await createSql(this.databaseUrl);
    try {
      return await work(sql);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  async listProjects(): Promise<Project[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<ProjectRow[]>`
        select
          p.id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at,
          count(distinct e.id) as environment_count,
          count(distinct s.id) as secret_count
        from projects p
        left join project_environments e on e.project_id = p.id
        left join project_secrets s on s.project_id = p.id
        group by p.id
        order by p.name asc
      `;
      return rows.map(rowToProject);
    });
  }

  async getProject(
    id: string,
  ): Promise<{ project: Project; environments: ProjectEnvironment[] } | null> {
    return this.withSql(async (sql) => {
      const projectRows = await sql<ProjectRow[]>`
        select
          p.id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at,
          count(distinct e.id) as environment_count,
          count(distinct s.id) as secret_count
        from projects p
        left join project_environments e on e.project_id = p.id
        left join project_secrets s on s.project_id = p.id
        where p.id = ${id}
        group by p.id
        limit 1
      `;
      const p = projectRows[0];
      if (!p) return null;

      const envRows = await sql<EnvironmentRow[]>`
        select
          e.id,
          e.project_id,
          e.name,
          e.created_at,
          e.updated_at,
          count(s.id) as secret_count
        from project_environments e
        left join project_secrets s on s.environment_id = e.id
        where e.project_id = ${id}
        group by e.id
        order by e.name asc
      `;

      return {
        project: rowToProject(p),
        environments: envRows.map(rowToEnvironment),
      };
    });
  }

  async createProject(data: CreateProjectInput): Promise<Project> {
    return this.withSql(async (sql) => {
      return await sql.begin(async (tx) => {
        const rows = await tx<ProjectRow[]>`
          insert into projects (name, description)
          values (${data.name}, ${data.description ?? null})
          returning id, name, description, '0' as environment_count, '0' as secret_count, created_at, updated_at
        `;
        const project = rows[0];
        if (!project) throw new Error("Could not create project.");

        if (data.defaultEnvironments && data.defaultEnvironments.length > 0) {
          for (const envName of data.defaultEnvironments) {
            await tx`
              insert into project_environments (project_id, name)
              values (${project.id}, ${envName})
              on conflict (project_id, name) do nothing
            `;
          }
        }

        return {
          ...rowToProject(project),
          environmentCount: data.defaultEnvironments?.length ?? 0,
        };
      });
    });
  }

  async updateProject(id: string, data: UpdateProjectInput): Promise<Project> {
    return this.withSql(async (sql) => {
      const existingRows = await sql<ProjectRow[]>`
        select id, name, description, created_at, updated_at, '0' as environment_count, '0' as secret_count
        from projects
        where id = ${id}
        limit 1
      `;
      const existing = existingRows[0];
      if (!existing) throw new NotFoundError("Project not found.");

      const rows = await sql<ProjectRow[]>`
        update projects
        set
          name = ${data.name !== undefined ? data.name : existing.name},
          description = ${data.description !== undefined ? data.description : existing.description},
          updated_at = now()
        where id = ${id}
        returning id, name, description, '0' as environment_count, '0' as secret_count, created_at, updated_at
      `;
      const updated = rows[0];
      if (!updated) throw new NotFoundError("Project not found.");
      return rowToProject(updated);
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.withSql(async (sql) => {
      const result = await sql`
        delete from projects where id = ${id}
      `;
      return result.count > 0;
    });
  }

  async listEnvironments(projectId: string): Promise<ProjectEnvironment[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<EnvironmentRow[]>`
        select
          e.id,
          e.project_id,
          e.name,
          e.created_at,
          e.updated_at,
          count(s.id) as secret_count
        from project_environments e
        left join project_secrets s on s.environment_id = e.id
        where e.project_id = ${projectId}
        group by e.id
        order by e.name asc
      `;
      return rows.map(rowToEnvironment);
    });
  }

  async createEnvironment(
    projectId: string,
    data: CreateEnvironmentInput,
  ): Promise<ProjectEnvironment> {
    return this.withSql(async (sql) => {
      const duplicate = await sql<EnvironmentRow[]>`
        select id from project_environments
        where project_id = ${projectId} and name = ${data.name}
        limit 1
      `;
      if (duplicate.length > 0) {
        throw new ConflictError(`Environment "${data.name}" already exists in this project.`);
      }

      const rows = await sql<EnvironmentRow[]>`
        insert into project_environments (project_id, name)
        values (${projectId}, ${data.name})
        returning id, project_id, name, '0' as secret_count, created_at, updated_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Could not create environment.");
      return rowToEnvironment(row);
    });
  }

  async updateEnvironment(
    projectId: string,
    envId: string,
    data: UpdateEnvironmentInput,
  ): Promise<ProjectEnvironment> {
    return this.withSql(async (sql) => {
      const existingRows = await sql<EnvironmentRow[]>`
        select
          e.id,
          e.project_id,
          e.name,
          e.created_at,
          e.updated_at,
          count(s.id) as secret_count
        from project_environments e
        left join project_secrets s on s.environment_id = e.id
        where e.id = ${envId} and e.project_id = ${projectId}
        group by e.id
        limit 1
      `;
      const existing = existingRows[0];
      if (!existing) throw new NotFoundError("Environment not found.");

      if (data.name !== existing.name) {
        const duplicate = await sql<EnvironmentRow[]>`
          select id
          from project_environments
          where project_id = ${projectId} and name = ${data.name} and id != ${envId}
          limit 1
        `;
        if (duplicate.length > 0) {
          throw new ConflictError(`Environment "${data.name}" already exists in this project.`);
        }
      }

      const rows = await sql<EnvironmentRow[]>`
        update project_environments
        set
          name = ${data.name},
          updated_at = now()
        where id = ${envId} and project_id = ${projectId}
        returning id, project_id, name, created_at, updated_at
      `;
      const updated = rows[0];
      if (!updated) throw new NotFoundError("Environment not found.");

      return {
        ...rowToEnvironment(updated),
        secretCount: Number(existing.secret_count ?? 0),
      };
    });
  }

  async deleteEnvironment(projectId: string, envId: string): Promise<boolean> {
    return this.withSql(async (sql) => {
      const result = await sql`
        delete from project_environments
        where id = ${envId} and project_id = ${projectId}
      `;
      return result.count > 0;
    });
  }

  async listSecrets(projectId: string, envId: string): Promise<ProjectSecret[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<SecretRow[]>`
        select
          id,
          project_id,
          environment_id,
          key,
          encrypted_value,
          iv,
          auth_tag,
          comment,
          is_secret,
          created_at,
          updated_at
        from project_secrets
        where project_id = ${projectId} and environment_id = ${envId}
        order by key asc
      `;

      return rows.map((row) => {
        let decryptedValue = "";
        try {
          decryptedValue = decryptSecret(
            {
              encryptedValue: row.encrypted_value,
              iv: row.iv,
              authTag: row.auth_tag,
            },
            this.masterKey,
          );
        } catch {
          decryptedValue = "[DECRYPTION_ERROR]";
        }

        return {
          id: row.id,
          projectId: row.project_id,
          environmentId: row.environment_id,
          key: row.key,
          value: decryptedValue,
          comment: row.comment,
          isSecret: row.is_secret,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        };
      });
    });
  }

  async upsertSecret(
    projectId: string,
    envId: string,
    data: UpsertSecretInput,
  ): Promise<ProjectSecret> {
    return this.withSql(async (sql) => {
      const encrypted = encryptSecret(data.value, this.masterKey);

      const rows = await sql<SecretRow[]>`
        insert into project_secrets (
          project_id,
          environment_id,
          key,
          encrypted_value,
          iv,
          auth_tag,
          comment,
          is_secret
        )
        values (
          ${projectId},
          ${envId},
          ${data.key},
          ${encrypted.encryptedValue},
          ${encrypted.iv},
          ${encrypted.authTag},
          ${data.comment ?? null},
          ${data.isSecret}
        )
        on conflict (environment_id, key)
        do update set
          encrypted_value = excluded.encrypted_value,
          iv = excluded.iv,
          auth_tag = excluded.auth_tag,
          comment = coalesce(excluded.comment, project_secrets.comment),
          is_secret = excluded.is_secret,
          updated_at = now()
        returning id, project_id, environment_id, key, encrypted_value, iv, auth_tag, comment, is_secret, created_at, updated_at
      `;

      const row = rows[0];
      if (!row) throw new Error("Could not upsert secret.");

      return {
        id: row.id,
        projectId: row.project_id,
        environmentId: row.environment_id,
        key: row.key,
        value: data.value,
        comment: row.comment,
        isSecret: row.is_secret,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    });
  }

  async deleteSecret(secretId: string): Promise<boolean> {
    return this.withSql(async (sql) => {
      const result = await sql`
        delete from project_secrets where id = ${secretId}
      `;
      return result.count > 0;
    });
  }

  async importEnv(
    projectId: string,
    envId: string,
    data: ImportEnvInput,
  ): Promise<{ importedCount: number }> {
    const entries = parseEnvFile(data.rawContent);
    for (const entry of entries) {
      await this.upsertSecret(projectId, envId, {
        key: entry.key,
        value: entry.value,
        comment: entry.comment ?? null,
        isSecret: true,
      });
    }
    return { importedCount: entries.length };
  }

  async exportEnv(projectId: string, envId: string): Promise<string> {
    const secrets = await this.listSecrets(projectId, envId);
    return formatEnvFile(secrets);
  }
}
