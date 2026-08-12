# Production launch checklist

The repository fails closed when critical services or approvals are missing. Complete every item below for the intended region before inviting customers; a successful source build alone is not a legal, data-quality, or operational approval.

## Initial launch scope

Launch one accountable owner per workspace, B2B prospect research only, reviewable outreach drafts only, and three capacity-based paid plans. Do not advertise B2C collection, self-service team invitations, seat billing, or automated sending. The repository retains defensive B2C and role-based controls for a separately reviewed later release.

## Current external handoff

The code cannot create or approve the following production facts. These are the remaining owner/operator gates after `pnpm release:check` passes:

- Add the production OpenRouter key and four explicitly pinned, evaluated model IDs to Secret Manager. Populate `ATHREIX_APIFY_ALLOWED_ACTORS`, `ATHREIX_APIFY_ACTOR_REVIEWS_JSON`, and `APIFY_RESEARCH_ACTORS_JSON`; verify the B2B discovery Actor and every research Actor are both allowlisted and currently reviewed.
- Keep staging on Paddle Sandbox. Before a later production launch, create separate Paddle Live products, Prices, client token, and notification destination; complete merchant/tax/domain requirements; and repeat the full billing matrix below with Live-specific configuration. Never copy Sandbox IDs or secrets into Live.
- Replace draft legal documents with counsel-approved versions for the actual launch entity and jurisdiction.
- Attach a customer-facing HTTPS domain, support address/process, alert destination, scheduled retention/monitoring jobs, and tested backup/restore procedure.
- Record the 100-record model evaluation, live-provider acceptance test, security/abuse review, launch approvers, rollback owner, and exact release commit.
- Deploy the reviewed commit and require the live `/api/health` response to return HTTP 200 with no missing configuration before enabling checkout or approving customers.

## Infrastructure

- Provision an isolated production Firebase project and enable Firestore point-in-time recovery or scheduled backups before launch.
- Enable Firebase Authentication providers, create Firestore and Storage in the intended region, and deploy the committed Firestore rules/indexes and Storage rules.
- Enable Cloud Tasks and Cloud Run; create the regional search queue with bounded concurrency, rate, retry, and backoff settings. Deploy the same image with command `node node_modules/tsx/dist/cli.mjs src/worker.ts` as a private Cloud Run service and use `/tasks/search` as the task target.
- Use a dedicated task OIDC service account, grant it only Cloud Run invocation, grant the web runtime only task-enqueue and service-account-use permissions, and confirm an authenticated staging task completes before routing traffic.
- Configure the authenticated daily retention request and five-minute monitoring request. Route every non-2xx result, provider-cleanup backlog, queue age, failed job, and storage deletion failure to an owned alert destination.
- Keep Firestore and Storage browser rules deny-by-default. Grant the server/worker service account only the required Firestore, Authentication, Storage-object, and service-usage roles.
- Verify Firestore-backed registration/login/reset rate limits across multiple web instances and configure TTL cleanup for the `_rateLimits.expiresAt` field.

## Identity and secrets

- Generate unique production values for `AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET`, and `SEARCH_TASK_SIGNING_SECRET`; store them in the deployment secret manager and scope each service to only the secrets it needs.
- Set the canonical HTTPS `NEXT_PUBLIC_APP_URL`. Configure SMTP sender authentication and Google OAuth as applicable, including exact redirect origins.
- Rotate every credential used during staging before launch. Verify that previews use isolated data and cannot access production provider or storage credentials.
- Set `ADMIN_EMAILS` deliberately; verify `/admin` is visible only to allowlisted platform admins; exercise verified-email approval, rejection, suspension, restoration, session invalidation, and a reasoned idempotent credit adjustment. Review platform-admin records, grandfathered customers, workspace roles, and suspended accounts.

## Prospect providers

- Select specific Apify Actors and document the creator, immutable/versioned release, terms URL/version, permissions, reviewed modes and jurisdictions, review owner/date, and expiry/re-review date.
- Put only those Actor IDs in `APIFY_ALLOWED_ACTORS`; a configured ID is not implicitly allowed.
- Keep `APIFY_B2C_ACTOR_ID` and `APIFY_B2C_SOURCES_JSON` unset for the initial B2B launch. A future B2C release must register each approved source reference, bind it to its owning/licensed workspaces, and pass a separate legal, provider, isolation, and quality review.
- Run bounded cost, timeout, partial-run, retry, deletion, and schema-change tests against staging Actors. Confirm unfinished runs are aborted and cannot be charged as completed searches.
- Verify target-source terms, collection authority, notices, processor/subprocessor roles, transfers, and Apify/Actor deletion behavior with counsel and procurement.

## Billing and credits

- For staging, create exactly one active monthly recurring Paddle Sandbox Price for `STARTER`, `GROWTH`, and `SCALE`; configure the three distinct Price IDs, Sandbox client token, API key, and notification secret, then verify `/api/health` reports `paddle_ready`.
- Subscribe the Sandbox notification destination to `transaction.completed` plus all subscription lifecycle events handled by the app. Replay simulated events and verify altered payloads, unknown Prices, cross-workspace mappings, duplicates, and stale events fail closed.
- Complete a Sandbox first purchase, renewal, payment failure/recovery, cancellation-at-period-end, and a new subscription after cancellation. Confirm redirects never grant credits and subscription-update transactions never grant a full monthly allowance.
- Reconcile completed Paddle transactions to ledger entries and verify one grant per transaction under duplicate and out-of-order webhook delivery before considering Paddle Live.
- Before accepting live payments, complete Paddle's merchant, bank, domain, tax, export, and recurring-payment requirements, then provision entirely separate Live configuration and repeat these checks.

## AI quality

- Run the evaluation protocol in `docs/MODEL_EVALS.md` on rights-cleared representative records.
- Pin the approved model and prompt/schema versions. Set budget and latency alerts and verify that deterministic fallback output is visibly traceable.
- Review false-high-score, unsupported-claim, sensitive-inference, schema/refusal, and outreach-quality samples before every model or prompt change.

## Privacy and responsible use

- Replace draft legal pages with counsel-approved Terms, Privacy Notice, Responsible Use Policy, data-retention schedule, subprocessors, security contact, and data-rights instructions.
- Complete the required DPA/DPIA/transfer and marketing-law reviews for each launch jurisdiction. Confirm adult-only, consent, purpose, channel, suppression, and deletion controls with real test records.
- Establish verified data-rights intake and resolution ownership. Test erasure through canonical records, saved lists, outreach, exports/storage, evidence, and provider runs; retain only non-payload completion evidence.
- Confirm Athreix remains draft-only. Any later sender/CRM integration requires a separate legal and technical launch review and must not enable unsolicited mass messaging.

## Release gate

- Require a green CI run for formatting, lint, strict TypeScript, unit/component tests, dependency/peer audit, migration deployment, production build, container build, and desktop/mobile browser tests.
- Run `GET /api/health` against the deployment domain and require HTTP 200 with no missing configuration. Exercise signup/verification/reset, Paddle checkout and a signed completed-transaction credit grant, portal/cancellation, one B2B search, audited reveal, outreach draft with workspace signature, list save, each export format, suppression, privacy request/resolution, retention, session revocation, and admin monitoring.
- Record launch approvers, rollback owner, incident contacts, support path, Actor/source review expiry, model evaluation version, and the exact release commit.
