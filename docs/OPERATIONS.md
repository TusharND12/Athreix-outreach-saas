# Operations runbook

## Health signals

Monitor web/API availability, Firestore latency/quota/index errors, Firebase Authentication failures, Firebase Storage upload/deletion failures, Cloud Tasks queue age/depth/retries, Cloud Run worker latency/errors, failed jobs, Paddle webhook failure/retry age and transaction/ledger reconciliation, Apify run cost and failure rate, OpenRouter latency/refusal/schema errors, export failures, credit reconciliation mismatches, rate-limit events, and suppression/deletion SLA.

Firestore is the authoritative application and audit store. Deploy rule/index changes with `pnpm firebase:deploy`; deploy Storage rules separately with `pnpm firebase:deploy:storage` after the bucket is activated. Validate server access with `pnpm firebase:smoke` and never expose an Admin SDK credential to browser code.

`GET /api/internal/monitoring` is an authenticated synthetic alert endpoint. Invoke it every five minutes with `Authorization: Bearer $CRON_SECRET` and alert on every non-2xx response. It reports recent failed jobs/exports, stale active jobs, past-due subscriptions, overdue privacy requests, and provider cleanup more than 26 hours past retention without returning customer payloads.

## Customer approval and access

1. Open `/admin` with a platform-admin account and review `Pending approval` records. Confirm the email is verified, the customer identity/domain is expected, and responsible-use onboarding is complete outside the application where required.
2. Record a concise internal approval or rejection note. Approval enables sign-in; rejection remains reversible but does not delete the account or its legal-acceptance record.
3. Use suspension for an incident, abuse review, payment/compliance hold, or compromised account. Suspension and rejection invalidate existing sessions; restoring suspension does not override a rejected approval state.
4. Use credit adjustment only with a ticket/reconciliation reason. Never use it to imitate an unreceived payment; the ledger and audit record are permanent operational evidence.
5. Review grandfathered accounts, pending-account age, admin membership, suspensions, and unusual adjustment volume on a regular schedule. Platform-admin accounts are deliberately protected from portal mutations and must be changed through the controlled allowlist/bootstrap procedure.

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

- Cloud Tasks performs bounded delivery retries to the private Cloud Run worker; a token-scoped database lease heartbeats independently during long provider/AI calls. Monitor task attempts, queue age, lease age, and analysis fallback counts.
- Google Cloud Scheduler invokes `/api/internal/retention` daily with `CRON_SECRET`. The authenticated task removes expired result/evidence data, clears expired consent proofs, expires export artifacts, and attempts provider dataset/run cleanup.
- A scheduler invokes `/api/internal/monitoring` every five minutes with the same secret. Its non-2xx response is the alert signal; connect it to the production incident destination rather than treating the scheduled request itself as sufficient monitoring.

Required production operations that are intentionally not represented as automatic product behavior:

- Deliver customer-facing low-credit and failed-job notifications through an approved email provider when one is selected; operational failures are exposed by the authenticated monitoring endpoint now.
- Reconcile the append-only credit ledger and investigate orphan provider runs on a regular operator-defined schedule.
- Tune Cloud Tasks queue concurrency/rate, `OPENROUTER_SCORING_CONCURRENCY`, `OPENROUTER_ANALYSIS_WINDOW_SIZE`, and `SEARCH_ANALYSIS_BUDGET_MS` only from measured staging latency/rate-limit data. The database stale window is clamped to at least three heartbeat intervals.
- Review Actor/source terms and expiry, workspace-to-source authorization bindings, platform-admin access, restore readiness, and retention outcomes at least quarterly.

Do not advertise automatic monthly credit renewal until the payment provider or an idempotent entitlement-period grant job is connected. Plan caps are metadata; only recorded ledger grants create spendable credits.

## Billing reconciliation

1. Treat Paddle as the payment record and `CreditLedger` as the spendable-credit record. Never adjust credits from Checkout success redirects or subscription status alone.
2. Configure the Paddle Sandbox notification destination for `transaction.completed`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.activated`, `subscription.trialing`, `subscription.past_due`, `subscription.paused`, and `subscription.resumed`.
3. Alert on any non-2xx webhook delivery. Correct configuration or mapping failures and allow Paddle to retry the same event; event ID and payload digest checks make retries safe.
4. Reconcile each completed `web` or `subscription_recurring` transaction to exactly one ledger row keyed by Paddle transaction ID. Subscription-update and prorated transactions must not create a full monthly grant.
5. Resolve customer/subscription-to-workspace conflicts manually. Do not rewrite identifiers or issue credits until ownership is verified from both systems.
6. Rotate the webhook secret after suspected exposure and keep old/new endpoint overlap only for the provider-supported rotation window.

## Data-rights resolution

The product provides encrypted request intake and an admin queue. Identity verification, source/provider propagation, targeted erasure/suppression, derived-export/provider verification, and requester delivery remain a controlled manual runbook for this MVP. An administrator may mark a request complete only after that work is finished and an evidence reference is recorded; the status action does not itself erase data.
