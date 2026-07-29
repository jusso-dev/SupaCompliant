import { z } from "zod";

export const connectionTestSchema = z.object({
  targetType: z.enum(["supabase", "postgresql"]),
  name: z.string().min(1).max(120).optional(),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  sslMode: z.enum(["disable", "require", "verify-full"]).default("require"),
  projectRef: z.string().optional(),
  managementToken: z.string().optional(),
  allowPrivateNetwork: z.boolean().default(false),
  persistSecrets: z.boolean().default(true),
  /** If true, reject superuser-looking usernames unless allowSuperuserDiagnostic */
  allowSuperuserDiagnostic: z.boolean().default(false),
});

export type ConnectionTestInput = z.infer<typeof connectionTestSchema>;

export const SUPERUSER_LIKE = new Set([
  "postgres",
  "supabase_admin",
  "rds_superuser",
]);
