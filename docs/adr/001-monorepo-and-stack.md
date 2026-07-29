# ADR-001: Monorepo layout and technology stack

## Status

Accepted

## Context

SupaCompliant needs a web UI, assessment worker, CLI, control library, framework mappings, reporting, and shared types. Assessments are long-running and must not block request handlers. Secrets must never reach the browser. The product must remain easy to self-host.

## Decision

Use a **pnpm workspaces monorepo**:

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router UI + REST API routes |
| `apps/worker` | PostgreSQL-backed job runner |
| `apps/cli` | `supacompliant` CLI |
| `packages/shared` | Zod schemas, enums, result types |
| `packages/database` | Drizzle schema, queries, encryption helpers |
| `packages/assessment-engine` | Run orchestration, concurrency, digests |
| `packages/control-library` | Versioned technical controls |
| `packages/framework-mappings` | Versioned framework packs |
| `packages/reporting` | Snapshot, compare, export (JSON/CSV/SARIF/HTML) |
| `packages/ui` | Shared light-theme UI primitives |
| `packages/config` | ESLint/TS/Tailwind shared config |
| `supabase/` | App database migrations + seed |

Stack choices:

- **Next.js App Router + TypeScript strict** for UI and BFF
- **Supabase Auth + PostgreSQL RLS** for multi-tenant isolation
- **Drizzle ORM** for application tables
- **PostgreSQL job queue** (SKIP LOCKED + advisory locks) — no Redis required
- **Envelope encryption** (AES-256-GCM data keys + KEK env var) for connection secrets
- **Vitest + Playwright** for tests
- **Pino + OpenTelemetry hooks** for structured logging

Visual language inspired by [shadcndashboard](https://github.com/shadcndashboard/shadcndashboard) (MIT), adapted for a serious assurance product (light-first, restrained colour, status icons + text).

## Consequences

- Single install/build graph; packages version together with the control library.
- Self-hosters need only PostgreSQL/Supabase — not Redis.
- Worker must run as a separate process in production.
- Control library commits are recorded on every assessment run for historical comparability.
