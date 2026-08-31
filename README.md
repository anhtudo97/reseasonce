# Resonance

AI-powered text-to-speech and voice cloning for teams. Upload a voice sample, then generate speech from any text using that voice — or one of the 20 built-in voices.

Every voice and generation is scoped to a Clerk **organization**, so a team shares its custom voices and generation history.

## Stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, RSC) + React 19                           |
| API        | tRPC v11 + TanStack Query (server prefetch → client suspense)     |
| Auth       | Clerk (organizations required)                                    |
| Database   | PostgreSQL + Prisma 7 (`@prisma/adapter-pg` driver adapter)       |
| Storage    | Cloudflare R2 (voice samples + generated audio)                   |
| TTS engine | Chatterbox Turbo on [Modal](https://modal.com) (`chatterbox_tts.py`) |
| UI         | Tailwind CSS v4, shadcn/ui (`radix-nova`), wavesurfer.js          |
| Monitoring | Sentry                                                            |

## How it works

```
Browser ──tRPC──▶ generations.create
                       │
                       ├─▶ resolve voice (SYSTEM, or CUSTOM owned by the org)
                       ├─▶ POST /generate on the Chatterbox API (Modal, GPU)
                       ├─▶ create Generation row
                       └─▶ upload WAV to R2 · generations/orgs/{orgId}/{id}

Browser ◀── /api/audio/{id} ── signed R2 URL fetched server-side, streamed back
```

The R2 bucket is never exposed to the browser. `/api/audio/[generationId]` and `/api/voices/[voiceId]` check the caller's org, mint a one-hour signed URL server-side, and stream the response through.

Modal mounts the same R2 bucket read-only, so the app passes a `voice_key` (object key) rather than uploading the sample with every request.

## Prerequisites

- Node.js 20+ and **pnpm** 11
- Docker (for local Postgres) or any Postgres 17 instance
- Accounts: Clerk, Cloudflare R2, Modal, Sentry (optional), Hugging Face (for the model download on Modal)

## Setup

```bash
pnpm install
cp .env.example .env          # then fill in the real values
docker compose -f docker.compose.yml up -d   # Postgres 17 on :5432
pnpm db:migrate               # applies migrations and seeds the 20 system voices
pnpm dev
```

Open http://localhost:3000. You'll be asked to sign in and create an organization before reaching the dashboard.

Every key in `.env` is validated at boot by `src/lib/env.ts` — the app refuses to start on a missing one. Set `SKIP_ENV_VALIDATION=true` to bypass this (e.g. in a Docker build).

`pnpm db:migrate` runs `scripts/seed-system-voices.ts`, which uploads the WAVs in `scripts/system-voices/` to R2 and upserts the matching `SYSTEM` voice rows. It needs working R2 credentials.

Note: `APP_URL` must be plain `http://localhost:3000` locally — `next dev` runs without TLS, and an `https://` origin breaks every server-rendered tRPC call.

## Scripts

| Command           | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `pnpm dev`        | Dev server                                                               |
| `pnpm build`      | `prisma generate` then `next build`                                      |
| `pnpm start`      | Production server                                                        |
| `pnpm lint`       | ESLint                                                                   |
| `pnpm db:migrate` | `prisma migrate dev` (+ seed)                                            |
| `pnpm db:generate`| Regenerate the Prisma client into `src/generated/prisma`                 |
| `pnpm db:studio`  | Prisma Studio                                                            |
| `pnpm sync-api`   | Regenerate `src/types/chatterbox-api.d.ts` from the Chatterbox OpenAPI spec |

## Project structure

```
src/
├── app/                    # routes — thin: metadata, searchParams, prefetch, render a view
│   ├── (dashboard)/        # dashboard, /text-to-speech, /voices
│   ├── api/
│   │   ├── audio/[generationId]/   # streams generated audio
│   │   ├── voices/[voiceId]/       # streams a voice sample
│   │   ├── voices/create/          # raw-body audio upload (see below)
│   │   └── trpc/[trpc]/
│   ├── sign-in, sign-up, org-selection
├── features/               # the actual UI, per feature
│   ├── dashboard/ · text-to-speech/ · voices/
│   │   └── components/ views/ data/ lib/ hooks/ contexts/
├── trpc/                   # init (procedures), routers, server/client wiring
├── lib/                    # db, env, r2, chatterbox-client, utils
├── generated/prisma/       # generated Prisma client — do not edit
└── proxy.ts                # middleware (Next 16 renamed middleware → proxy)

chatterbox_tts.py           # Modal GPU service — deployed separately, not part of the Next build
scripts/                    # seed-system-voices.ts, sync-api.ts, system-voices/*.wav
```

### Two API surfaces

Everything JSON goes through tRPC (`src/trpc/routers/`). Route handlers exist only where tRPC doesn't fit:

- **`POST /api/voices/create`** — the audio arrives as the raw request body, so metadata (`name`, `category`, `language`, `description`) is passed as **query parameters**. Rejects files over 20 MB or shorter than 10 seconds.
- **`/api/audio/*`, `/api/voices/*`** — binary streaming proxies for R2.

### Auth

`src/proxy.ts` protects every route except `/sign-in`, `/sign-up` and `/api/tel` (Sentry's tunnel route — it must stay public or client-side error reports are silently dropped). Signed-in users without an active organization are redirected to `/org-selection`.

tRPC procedures are defined in `src/trpc/init.ts`: `baseProcedure` (Sentry), `authProcedure` (requires a user), `orgProcedure` (requires user + org). Data-touching procedures use `orgProcedure` and filter by `ctx.orgId`.

## The Chatterbox service

`chatterbox_tts.py` is a standalone Modal app (A10G GPU, FastAPI, API-key auth) that is deployed separately from the web app.

Before deploying, fill in `R2_BUCKET_NAME` and `R2_ACCOUNT_ID` at the top of the file, and create the Modal secrets it expects:

```bash
modal secret create cloudflare-r2 \
  AWS_ACCESS_KEY_ID=<r2-access-key-id> \
  AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
modal secret create chatterbox-api-key CHATTERBOX_API_KEY=<key>
modal secret create hf-token HF_TOKEN=<huggingface-token>

modal deploy chatterbox_tts.py
```

Point `CHATTERBOX_API_URL` / `CHATTERBOX_API_KEY` in `.env` at the deployed endpoint, then run `pnpm sync-api` so the generated client types match. `src/types/chatterbox-api.d.ts` is generated — never edit it by hand.

## Conventions

- Prettier: no semicolons, double quotes, no trailing commas, 120 columns.
- kebab-case filenames throughout, components included.
- Conventional commits, enforced by commitlint via a husky `commit-msg` hook.
- Polar billing (subscription checks and usage metering) is scaffolded but commented out in `generations.create` and `POST /api/voices/create`.

There is no test suite in this repo yet; `pnpm lint` and `pnpm build` are the verification steps.
