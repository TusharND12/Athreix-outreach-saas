# Operations runbook

## Health signals

Monitor web/API availability, Firestore latency/quota/index errors, Firebase Authentication failures, Firebase Storage upload/deletion failures, Redis connectivity, queue age/depth, stalled/failed jobs, Apify run cost and failure rate, OpenRouter latency/refusal/schema errors, export failures, credit reconciliation mismatches, rate-limit events, and suppression/deletion SLA.

Firestore is the authoritative application and audit store. Deploy rule/index changes with `pnpm firebase:deploy`; deploy Storage rules separately with `pnpm firebase:deploy:storage` after the bucket is activated. Validate server access with `pnpm firebase:smoke` and never expose an Admin SDK credential to browser code.

## Search incident triage

1. Inspect the job record and audit-safe error code; do not copy raw prospect data into tickets.
2. Determine whether failure occurred before credit reservation, during provider collection, normalization, AI analysis, or persistence.
3. Retry only idempotent stages. Reconcile reserved credits exactly once.
4. Quarantine an Actor if its output schema, terms, permissions, cost, or accuracy changed unexpectedly.
5. Notify affected workspaces without exposing provider secrets or another tenant's identifiers.

## Data-rights request

1. Verify the requester and record jurisdiction/scope.
2. Search canonical identities and encrypted deterministic lookup tokens across workspaces.
3. Restrict the record while verification is pending.
4. Correct, export, delete, or suppress as required; propagate to derived lists, outreach, exports, and provider storage when applicable.
5. Record completion evidence without retaining the deleted payload.

## Scheduled work

Implemented in this repository:

- BullMQ's worker lifecycle detects stalled work and retries bounded search jobs; a token-scoped database lease heartbeats independently during long provider/AI calls. Monitor queue age, lease age, analysis fallback counts, and run at least one persistent worker.
- Vercel invokes `/api/internal/retention` daily. The authenticated task removes expired result/evidence data, clears expired consent proofs, expires export artifacts, and attempts provider dataset/run cleanup.

Required production operations that are intentionally not represented as automatic product behavior:

- Alert on low credits and failed jobs from the exposed metrics/notification data until a delivery provider and digest schedule are configured.
- Reconcile the append-only credit ledger and investigate orphan provider runs on a regular operator-defined schedule.
- Tune `OPENROUTER_SCORING_CONCURRENCY`, `OPENROUTER_ANALYSIS_WINDOW_SIZE`, `SEARCH_ANALYSIS_BUDGET_MS`, and `SEARCH_WORKER_CONCURRENCY` only from measured staging latency/rate-limit data. The database stale window is clamped to at least three heartbeat intervals.
- Review Actor/source terms and expiry, workspace-to-source authorization bindings, platform-admin access, restore readiness, and retention outcomes at least quarterly.

Do not advertise automatic monthly credit renewal until the payment provider or an idempotent entitlement-period grant job is connected. Plan caps are metadata; only recorded ledger grants create spendable credits.

## Data-rights resolution

The product provides encrypted request intake and an admin queue. Identity verification, source/provider propagation, decision recording, and requester delivery remain a controlled manual runbook for this MVP; there is no UI action that pretends a request is completed. Record the resolution and completion evidence through the audited operational process, then run targeted erasure/suppression and verify derived exports and provider storage.
