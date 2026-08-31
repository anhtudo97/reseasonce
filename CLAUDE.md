# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **pnpm** (`packageManager: pnpm@11.1.3`).

```bash
pnpm dev                 # next dev
pnpm build               # prisma generate && next build
pnpm lint                # eslint
pnpm db:migrate          # prisma migrate dev (also runs seed via prisma.config.ts)
pnpm db:generate         # regenerate Prisma client into src/generated/prisma
pnpm db:studio
pnpm sync-api            # regenerate src/types/chatterbox-api.d.ts from CHATTERBOX_API_URL/openapi.json
docker compose -f docker.compose.yml up -d   # local Postgres 17 on :5432
```

No test runner is configured — there are no test files or test scripts in this repo. Verification is `pnpm lint` + `pnpm build`.

`.env` is required to boot: `src/lib/env.ts` validates it with `@t3-oss/env-nextjs` and throws at startup on a missing key. See `.env.example`. `SKIP_ENV_VALIDATION=true` bypasses it (Docker builds).

## What this is

Resonance — a multi-tenant text-to-speech / voice-cloning app. Users belong to a Clerk **organization**; all voices and generations are scoped to `orgId`. Audio generation is delegated to an external Chatterbox TTS service running on Modal (`chatterbox_tts.py` in the repo root is the deployed Python service, not part of the Next.js build). Audio files live in Cloudflare R2.

## Architecture

### Data flow for a generation

`generations.create` (tRPC) → look up voice (SYSTEM, or CUSTOM owned by this org) → `POST /generate` on the Chatterbox API via `openapi-fetch` → create `Generation` row → upload WAV to R2 at `generations/orgs/{orgId}/{generationId}` → write back `r2ObjectKey`. Both `voices.delete` and `generations.create` follow a **create-row-then-upload-then-patch-key** pattern with compensating deletes in `catch` — keep that shape when adding similar flows.

### Two API surfaces, on purpose

- **tRPC** (`src/trpc/routers/`) for everything JSON. Procedures come from `src/trpc/init.ts`: `baseProcedure` (Sentry middleware), `authProcedure` (userId), `orgProcedure` (userId + orgId). Almost everything should be `orgProcedure` and filter by `ctx.orgId`.
- **Route handlers** (`src/app/api/`) only where tRPC doesn't fit:
  - `POST /api/voices/create` — raw audio body upload; metadata arrives as **query params**, not a JSON body. Validates size (20 MB) and duration (≥10s) with `music-metadata`.
  - `GET /api/audio/[generationId]`, `GET /api/voices/[voiceId]` — R2 is never exposed to the browser. These auth-check, generate a 1h signed URL server-side, fetch it, and stream the body back. Client code always references `/api/audio/{id}`, never an R2 URL.

### Server/client data pattern

Page (server) calls `prefetch(trpc.x.queryOptions(...))` and wraps the view in `<HydrateClient>`; the view is `"use client"` and reads the same query with `useSuspenseQuery(trpc.x.queryOptions(...))`. The inputs must match exactly or the hydration misses. URL state uses `nuqs` — parsers are defined once per feature (e.g. `src/features/voices/lib/params.ts`) and shared between the server (`createSearchParamsCache`) and the client (`useQueryState`).

### Feature folders

`src/app/**` files are thin: metadata, `searchParams` parsing, prefetch, then render a view. Real code lives in `src/features/{dashboard,text-to-speech,voices}/` split into `components/`, `views/`, `data/`, `lib/`, `hooks/`, `contexts/`. Shared UI is `src/components/ui/` (shadcn, style `radix-nova`, aliases in `components.json`).

### Auth

`src/proxy.ts` is the middleware file (Next 16 renamed `middleware` → `proxy`). It protects everything except `/sign-in`, `/sign-up`, `/api/tel`, and redirects signed-in users without an active org to `/org-selection`. `/api/tel` is Sentry's `tunnelRoute` — it must stay public or client-side error reporting fails silently.

### Prisma

Client is generated to **`src/generated/prisma`**, imported as `@/generated/prisma/client` — never from `@prisma/client`. Uses the `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`). Seeding is `scripts/seed-system-voices.ts`, which uploads the 20 WAVs in `scripts/system-voices/` to R2 and upserts the `SYSTEM` voices listed in `src/features/voices/data/voice-scoping.ts`.

### Chatterbox types

`src/types/chatterbox-api.d.ts` is generated — do not hand-edit; run `pnpm sync-api` after the Modal service changes.

## Conventions

- Prettier: **no semicolons**, double quotes, no trailing commas, width 120, 2 spaces.
- Files: kebab-case throughout, including components (`voice-create-form.tsx`).
- Commits: conventional commits, enforced by commitlint via the husky `commit-msg` hook.
- Polar billing calls are commented out (not dead code) in `generations.create` and `POST /api/voices/create`, along with the `POLAR_*` keys in `src/lib/env.ts`. Leave them in place unless billing is being re-enabled.
- ESLint disables `react-hooks/purity`, `react-hooks/set-state-in-effect`, and `@typescript-eslint/no-explicit-any` — don't reintroduce those as blockers.
