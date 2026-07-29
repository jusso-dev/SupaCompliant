/**
 * Application schema (Drizzle-oriented types).
 * Source of truth for SQL is supabase/migrations/00001_init.sql
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  inet,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  requireMfaPrivileged: boolean("require_mfa_privileged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("memberships_org_user").on(t.organisationId, t.userId),
  }),
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  invitedBy: uuid("invited_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("projects_org_slug").on(t.organisationId, t.slug),
  }),
);

export const environments = pgTable("environments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("development"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const databaseConnections = pgTable("database_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetType: text("target_type").notNull(),
  host: text("host"),
  port: integer("port"),
  databaseName: text("database_name"),
  username: text("username"),
  sslMode: text("ssl_mode").default("require"),
  projectRef: text("project_ref"),
  persistSecrets: boolean("persist_secrets").notNull().default(true),
  lastPreflight: jsonb("last_preflight"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Encrypted secret material — never selected by client roles */
export const connectionSecrets = pgTable("connection_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => databaseConnections.id, { onDelete: "cascade" })
    .unique(),
  ciphertext: text("ciphertext").notNull(),
  nonce: text("nonce").notNull(),
  wrappedDek: text("wrapped_dek").notNull(),
  kekVersion: text("kek_version").notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assessmentProfiles = pgTable("assessment_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  frameworkPacks: jsonb("framework_packs").notNull().default([]),
  controlIds: jsonb("control_ids"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assessmentRuns = pgTable(
  "assessment_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => databaseConnections.id),
    profileId: uuid("profile_id").references(() => assessmentProfiles.id),
    status: text("status").notNull().default("draft"),
    manifest: jsonb("manifest"),
    digest: text("digest"),
    progress: integer("progress").notNull().default(0),
    errorMessage: text("error_message"),
    createdBy: uuid("created_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("assessment_runs_org_idx").on(t.organisationId),
  }),
);

export const controlExecutions = pgTable(
  "control_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => assessmentRuns.id, { onDelete: "cascade" }),
    controlId: text("control_id").notNull(),
    controlVersion: text("control_version").notNull(),
    status: text("status").notNull(),
    severity: text("severity").notNull(),
    summary: text("summary").notNull(),
    expected: text("expected"),
    actual: text("actual"),
    evidence: jsonb("evidence"),
    evidenceSummary: text("evidence_summary"),
    durationMs: integer("duration_ms"),
    categories: jsonb("categories"),
    mappings: jsonb("mappings"),
    remediation: jsonb("remediation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index("control_executions_run_idx").on(t.runId),
  }),
);

export const reportSnapshots = pgTable("report_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  runId: uuid("run_id")
    .notNull()
    .references(() => assessmentRuns.id, { onDelete: "cascade" }),
  digest: text("digest").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").references(() => environments.id),
  sourceControlId: text("source_control_id"),
  sourceExecutionId: uuid("source_execution_id"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  ownerId: uuid("owner_id"),
  firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull().defaultNow(),
  lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  remediation: text("remediation"),
  externalTicketUrl: text("external_ticket_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commentThreads = pgTable("comment_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => assessmentRuns.id, { onDelete: "cascade" }),
  executionId: uuid("execution_id").references(() => controlExecutions.id, {
    onDelete: "cascade",
  }),
  findingId: uuid("finding_id").references(() => findings.id, { onDelete: "cascade" }),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => commentThreads.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").default({}),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("audit_events_org_idx").on(t.organisationId),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(),
    status: text("status").notNull().default("pending"),
    payload: jsonb("payload").notNull().default({}),
    /** Ephemeral encrypted secrets for one-shot runs — cleared after claim processing */
    ephemeralSecrets: jsonb("ephemeral_secrets"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    pendingIdx: index("jobs_pending_idx").on(t.status, t.runAfter),
  }),
);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: jsonb("scopes").notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secretHash: text("secret_hash").notNull(),
  events: jsonb("events").notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exceptions = pgTable("exceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  executionId: uuid("execution_id").references(() => controlExecutions.id),
  findingId: uuid("finding_id").references(() => findings.id),
  reason: text("reason").notNull(),
  approvedBy: uuid("approved_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riskAcceptances = pgTable("risk_acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id, { onDelete: "cascade" }),
  rationale: text("rationale").notNull(),
  acceptedBy: uuid("accepted_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tables that MUST have RLS enabled */
export const TENANT_TABLES = [
  "organisations",
  "memberships",
  "invitations",
  "projects",
  "environments",
  "database_connections",
  "connection_secrets",
  "assessment_profiles",
  "assessment_runs",
  "control_executions",
  "report_snapshots",
  "findings",
  "comment_threads",
  "comments",
  "audit_events",
  "jobs",
  "api_keys",
  "webhooks",
  "notifications",
  "exceptions",
  "risk_acceptances",
] as const;
