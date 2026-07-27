# Athreix Lead Intelligence

Athreix is an AI-native lead intelligence platform for autonomous B2B company research and privacy-gated B2C audience research. It turns a natural-language brief into a structured research plan, runs reviewed Apify Actors in parallel, normalizes public evidence, detects buying signals and pain points, qualifies opportunities through OpenRouter, and produces transparent sales strategy and personalized outreach.

## What is included

- Premium public site, authentication experience, and responsive product shell
- Natural-language search understanding with a visible, editable research plan
- Parallel Apify research across search, maps, websites, key pages, careers, news, reviews, profiles, and social presence
- Firebase Authentication, Cloud Firestore persistence, Firebase Storage exports, Redis/BullMQ job orchestration, credits ledger, RBAC, and audit events
- OpenRouter structured intelligence for search understanding, company summaries, audits, technology detection, buying intent, qualification, strategy, outreach, competitors, industries, and company chat
- One-page company intelligence reports with website analysis, decision-makers, activity timeline, recommendations, and citation-level evidence
- Results filtering, provenance, consent/suppression controls, saved searches, tasks, notifications, usage, settings, and admin operations
- PDF, CSV, Excel, JSON, CRM-ready, and AI-report exports with selection/score/verification filters
- Demo mode for evaluating the complete experience without external credentials

## Local setup

Requirements: Node.js 22+, pnpm 11+, a Firebase project, and Redis 7+.

```bash
cp .env.example .env.local
pnpm install
pnpm models:generate
pnpm firebase:smoke
pnpm dev
```

Place a Firebase Admin service-account key at `.athreix/firebase-admin.json` for local development, or use Application Default Credentials on a managed Google runtime. The key directory is ignored by Git and Docker. `docker compose up --build` starts Redis and the persistent search worker; run the Next.js web process with `pnpm dev`.

The retained Prisma schema is model/type metadata for the Firestore compatibility layer only. There is no Prisma database client, relational migration, PostgreSQL connection, or seed step in the runtime.

For a UI-only evaluation, leave `DEMO_MODE=true`; external calls are replaced with deterministic fixtures. Production must set `DEMO_MODE=false` and configure every required secret.

## Production integrations

1. Create a Firebase project, enable Email/Password in Firebase Authentication, create Cloud Firestore and Firebase Storage in the intended region, deploy the committed rules with `pnpm firebase:deploy`, and provide least-privilege Admin SDK credentials to the server and worker.
2. Create Redis, set `REDIS_URL`, and generate `AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, and `CRON_SECRET`.
3. Review and approve specific Apify Actors, then set `APIFY_B2B_ACTOR_ID`, optional `APIFY_B2C_ACTOR_ID`, `APIFY_RESEARCH_ACTORS_JSON`, and `APIFY_API_TOKEN`. Actor choice is deliberately not hard-coded; every production Actor must be allowlisted and have a current terms/security review.
4. Set `OPENROUTER_API_KEY`. The default `openrouter/auto` routing can be replaced independently for research, high-volume scoring, and outreach. Calls use strict JSON schemas, explicit timeout/retry limits, bounded concurrency, ordered analysis windows, and an auditable deterministic fallback after the configured analysis budget.
5. Deploy the Next.js app to Vercel and run `pnpm worker` as a persistent worker process on a container runtime with the same environment variables.

## Commands

```bash
pnpm dev          # Next.js development server
pnpm worker       # BullMQ worker process
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

Athreix does not make a data collection or outreach purpose lawful merely by supporting it. Customers are responsible for source terms, authorization, notices, lawful basis, consent where required, suppression requests, and jurisdiction-specific marketing rules. The application blocks sensitive/minor targeting, requires additional B2C purpose controls, records provenance, and generates outreach drafts only—it does not send unsolicited mass messages.

Read [docs/COMPLIANCE.md](docs/COMPLIANCE.md) before enabling live Apify Actors or onboarding customers.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/OPERATIONS.md](docs/OPERATIONS.md), and the [production launch checklist](docs/LAUNCH_CHECKLIST.md).

## Status

This repository is a production-oriented platform foundation. Live data quality, legality, and unit economics depend on the reviewed Apify Actors, public sources, credentials, retention policy, and OpenRouter model evaluations selected for each deployment. No Apollo, ZoomInfo, Clearbit, Crunchbase, People Data Labs, Hunter, RocketReach, or similar paid data API is integrated.
