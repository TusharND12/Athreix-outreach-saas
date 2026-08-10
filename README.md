# Athreix Lead Intelligence

Athreix is an AI-native lead intelligence platform for autonomous B2B company research. It turns a natural-language brief into a structured research plan, runs reviewed Apify Actors in parallel, normalizes public evidence, detects buying signals and pain points, qualifies opportunities through OpenRouter, and produces transparent sales strategy and personalized outreach.

## What is included

- Premium public site, authentication experience, and responsive product shell
- Natural-language search understanding with a visible, editable research plan
- Parallel Apify research across search, maps, websites, key pages, careers, news, reviews, profiles, and social presence
- Firebase Authentication, Cloud Firestore persistence and distributed abuse protection, Firebase Storage exports, Google Cloud Tasks/Cloud Run job orchestration, a signed and idempotent Paddle subscription boundary, credits ledger, RBAC, and audit events
- OpenRouter structured intelligence for search understanding, company summaries, audits, technology detection, buying intent, qualification, strategy, outreach, competitors, industries, and company chat
- One-page company intelligence reports with website analysis, decision-makers, activity timeline, recommendations, and citation-level evidence
- Results filtering, provenance, consent/suppression controls, saved searches, tasks, notifications, usage, settings, and admin operations
- PDF, CSV, Excel, JSON, CRM-ready, and AI-report exports with selection/score/verification filters
- Demo mode for evaluating the complete experience without external credentials

## Local setup

Requirements: Node.js 22+, pnpm 11+, and a Firebase project for live mode.

```bash
cp .env.example .env.local
pnpm install
pnpm models:generate
pnpm firebase:smoke
pnpm dev
```

Place a Firebase Admin service-account key at `.athreix/firebase-admin.json` for local development, or use Application Default Credentials on a managed Google runtime. The key directory is ignored by Git and Docker. `docker compose up --build` starts the authenticated HTTP search worker on port 8081; run the Next.js web process with `pnpm dev`.

The retained Prisma schema is model/type metadata for the Firestore compatibility layer only. There is no Prisma database client, relational migration, PostgreSQL connection, or seed step in the runtime.

For a UI-only evaluation, leave `DEMO_MODE=true`; external calls are replaced with deterministic fixtures. Production must set `DEMO_MODE=false` and configure every required secret.

If `.env.local` is configured for the live Firebase project, start an isolated local demo explicitly with `pnpm dev:demo`. This overrides the local live-data flags for that process only; it does not change or expose production configuration.

## Production integrations

1. Create a Firebase project, enable Email/Password in Firebase Authentication, create Cloud Firestore and Firebase Storage in the intended region, deploy the committed rules with `pnpm firebase:deploy`, and provide least-privilege Admin SDK credentials to the server and worker.
2. Enable Cloud Tasks and Cloud Run in the same Google Cloud project. Create the `athreix-search` queue, deploy the image as a private Cloud Run service with command `node node_modules/tsx/dist/cli.mjs src/worker.ts`, grant a dedicated task identity `roles/run.invoker`, and give the web runtime only Cloud Tasks enqueue access plus permission to use that identity. Set `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL` and the exact `SEARCH_TASK_TARGET_URL` ending in `/tasks/search`.
3. Generate unique `AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET`, and `SEARCH_TASK_SIGNING_SECRET` values and store them in the managed runtime secret store. Give the worker the task-signing secret, but not the unrelated retention secret.
4. Review and approve specific Apify Actors, then set `APIFY_B2B_ACTOR_ID`, `APIFY_RESEARCH_ACTORS_JSON`, and `APIFY_API_TOKEN`. Actor choice is deliberately not hard-coded; every production Actor must be allowlisted and have a current terms/security review. The retained B2C service boundary is not part of the initial customer-facing launch.
5. Set `OPENROUTER_API_KEY`. The default `openrouter/auto` routing can be replaced independently for research, high-volume scoring, and outreach. Calls use strict JSON schemas, explicit timeout/retry limits, bounded concurrency, ordered analysis windows, and an auditable deterministic fallback after the configured analysis budget.
6. In Paddle Sandbox, create one active monthly recurring Price for every Athreix tier, a client-side token, and a notification destination for `/api/billing/webhook`. Billing remains unavailable until the sandbox API key, destination secret, client token, and all Price IDs pass readiness validation. Do not reuse sandbox values for Paddle Live.
7. Deploy the Next.js app with Firebase App Hosting in `us-central1` behind its global CDN. App Hosting and Firebase Storage require the Blaze plan; Cloud Tasks and Cloud Run use the same Google Cloud billing account and do not require a separate vendor.

## Commands

```bash
pnpm dev          # Next.js development server
pnpm dev:demo     # isolated fixture-backed demo with the built-in demo login
pnpm worker       # Cloud Tasks HTTP worker for Cloud Run
pnpm firebase:smoke # verify Firestore connectivity and write access
pnpm firebase:deploy # deploy Firestore rules and indexes
pnpm firebase:deploy:storage # deploy Storage rules after Storage is activated
pnpm test         # unit/component tests
pnpm test:e2e     # Playwright desktop + mobile flows
pnpm lint         # ESLint
pnpm typecheck    # strict TypeScript
pnpm build        # model metadata + production Next build
pnpm verify       # full non-E2E verification
```

## Responsible use

Athreix does not make a data collection or outreach purpose lawful merely by supporting it. Customers are responsible for source terms, authorization, notices, lawful basis, consent where required, suppression requests, and jurisdiction-specific marketing rules. The application records provenance and generates outreach drafts only—it does not send unsolicited mass messages.

Read [docs/COMPLIANCE.md](docs/COMPLIANCE.md) before enabling live Apify Actors or onboarding customers.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/OPERATIONS.md](docs/OPERATIONS.md), and the [production launch checklist](docs/LAUNCH_CHECKLIST.md).

## Status

This repository is a production-oriented platform foundation. Live data quality, legality, and unit economics depend on the reviewed Apify Actors, public sources, credentials, retention policy, and OpenRouter model evaluations selected for each deployment. No Apollo, ZoomInfo, Clearbit, Crunchbase, People Data Labs, Hunter, RocketReach, or similar paid data API is integrated.
