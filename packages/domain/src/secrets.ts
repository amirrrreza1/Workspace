import { z } from "zod";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  environmentCount: number;
  secretCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectEnvironment = {
  id: string;
  projectId: string;
  name: string;
  secretCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSecret = {
  id: string;
  projectId: string;
  environmentId: string;
  key: string;
  value: string;
  comment: string | null;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name cannot be empty")
    .max(120, "Project name must be at most 120 characters"),
  description: z.string().trim().max(1000).optional().nullable(),
  defaultEnvironments: z
    .array(z.string().trim().min(1).max(60))
    .default(["development", "staging", "production"]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name cannot be empty")
    .max(120, "Project name must be at most 120 characters")
    .optional(),
  description: z.string().trim().max(1000).optional().nullable(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createEnvironmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Environment name cannot be empty")
    .max(60, "Environment name must be at most 60 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Environment name must only contain alphanumeric characters, hyphens, and underscores"),
});

export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>;

export const updateEnvironmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Environment name cannot be empty")
    .max(60, "Environment name must be at most 60 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Environment name must only contain alphanumeric characters, hyphens, and underscores"),
});

export type UpdateEnvironmentInput = z.infer<typeof updateEnvironmentSchema>;

export const upsertSecretSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Secret key cannot be empty")
    .max(255, "Secret key must be at most 255 characters")
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Secret key must be a valid environment variable name (e.g. DATABASE_URL)"),
  value: z.string(),
  comment: z.string().trim().max(500).optional().nullable(),
  isSecret: z.boolean().default(true),
});

export type UpsertSecretInput = z.infer<typeof upsertSecretSchema>;

export const importEnvSchema = z.object({
  rawContent: z.string().min(1, "Env file content cannot be empty"),
  overwrite: z.boolean().default(true),
});

export type ImportEnvInput = z.infer<typeof importEnvSchema>;

export type ParsedEnvEntry = {
  key: string;
  value: string;
  comment?: string;
};

/**
 * Parses a standard .env file string into structured entries.
 * Handles:
 * - Comments starting with #
 * - Inline comments: KEY=value # comment
 * - Quoted values (single or double quotes)
 * - Escaped characters and newlines
 * - export KEY=val syntax
 */
export function parseEnvFile(raw: string): ParsedEnvEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: ParsedEnvEntry[] = [];

  let pendingComment: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) {
      pendingComment = undefined;
      continue;
    }

    // Comment line
    if (line.startsWith("#")) {
      const text = line.replace(/^#+\s*/, "").trim();
      pendingComment = pendingComment ? `${pendingComment}\n${text}` : text;
      continue;
    }

    // Strip optional "export " prefix
    const cleanLine = line.startsWith("export ") ? line.slice(7).trim() : line;

    // Match KEY=VALUE
    const equalIndex = cleanLine.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const key = cleanLine.slice(0, equalIndex).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let rawValue = cleanLine.slice(equalIndex + 1).trim();
    let inlineComment: string | undefined;

    // Handle quotes
    if (rawValue.startsWith('"')) {
      const closingQuote = rawValue.indexOf('"', 1);
      if (closingQuote !== -1) {
        const afterQuote = rawValue.slice(closingQuote + 1).trim();
        if (afterQuote.startsWith("#")) {
          inlineComment = afterQuote.replace(/^#+\s*/, "").trim();
        }
        rawValue = rawValue.slice(1, closingQuote).replace(/\\n/g, "\n").replace(/\\"/g, '"');
      } else {
        // Multi-line double quoted string
        let fullValue = rawValue.slice(1);
        let foundEnd = false;
        while (++i < lines.length) {
          const nextLine = lines[i]!;
          const nextQuote = nextLine.indexOf('"');
          if (nextQuote !== -1) {
            fullValue += "\n" + nextLine.slice(0, nextQuote);
            const afterQuote = nextLine.slice(nextQuote + 1).trim();
            if (afterQuote.startsWith("#")) {
              inlineComment = afterQuote.replace(/^#+\s*/, "").trim();
            }
            foundEnd = true;
            break;
          } else {
            fullValue += "\n" + nextLine;
          }
        }
        rawValue = foundEnd ? fullValue.replace(/\\n/g, "\n").replace(/\\"/g, '"') : fullValue;
      }
    } else if (rawValue.startsWith("'")) {
      const closingQuote = rawValue.indexOf("'", 1);
      if (closingQuote !== -1) {
        const afterQuote = rawValue.slice(closingQuote + 1).trim();
        if (afterQuote.startsWith("#")) {
          inlineComment = afterQuote.replace(/^#+\s*/, "").trim();
        }
        rawValue = rawValue.slice(1, closingQuote);
      } else {
        // Multi-line single quoted string
        let fullValue = rawValue.slice(1);
        while (++i < lines.length) {
          const nextLine = lines[i]!;
          const nextQuote = nextLine.indexOf("'");
          if (nextQuote !== -1) {
            fullValue += "\n" + nextLine.slice(0, nextQuote);
            break;
          } else {
            fullValue += "\n" + nextLine;
          }
        }
        rawValue = fullValue;
      }
    } else {
      // Unquoted value: check for inline comments
      const commentIndex = rawValue.indexOf(" #");
      if (commentIndex !== -1) {
        inlineComment = rawValue.slice(commentIndex + 2).trim();
        rawValue = rawValue.slice(0, commentIndex).trim();
      }
    }

    const comment = inlineComment ?? pendingComment;
    entries.push({ key, value: rawValue, ...(comment ? { comment } : {}) });
    pendingComment = undefined;
  }

  return entries;
}

/**
 * Serializes secrets entries into standard .env format text.
 */
export function formatEnvFile(entries: { key: string; value: string; comment?: string | null }[]): string {
  return entries
    .map((entry) => {
      const lines: string[] = [];
      if (entry.comment) {
        for (const commentLine of entry.comment.split("\n")) {
          lines.push(`# ${commentLine}`);
        }
      }
      let val = entry.value;
      if (val.includes("\n") || val.includes(" ") || val.includes('"') || val.includes("#") || val === "") {
        val = `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }
      lines.push(`${entry.key}=${val}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
