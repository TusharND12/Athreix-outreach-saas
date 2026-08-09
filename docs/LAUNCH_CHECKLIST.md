# Production launch checklist

The repository fails closed when critical services or approvals are missing. Complete every item below for the intended region before inviting customers; a successful source build alone is not a legal, data-quality, or operational approval.

## Initial launch scope

Launch one accountable owner per workspace, B2B prospect research only, reviewable outreach drafts only, and three capacity-based paid plans. Do not advertise B2C collection, self-service team invitations, seat billing, or automated sending. The repository retains defensive B2C and role-based controls for a separately reviewed later release.

## Current external handoff

The code cannot create or approve the following production facts. These are the remaining owner/operator gates after `pnpm release:check` passes:

- Add the production OpenRouter key and four explicitly pinned, evaluated model IDs to Secret Manager. Populate `ATHREIX_APIFY_ALLOWED_ACTORS`, `ATHREIX_APIFY_ACTOR_REVIEWS_JSON`, and `APIFY_RESEARCH_ACTORS_JSON`; verify the B2B discovery Actor and every research Actor are both allowlisted and currently reviewed.
- Create the three live Stripe Prices, choose an approved tax mode, configure the live signing secret/webhook, complete merchant requirements, and exercise the full test-mode billing matrix below.
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

- Confirm the company is approved to use the selected Stripe account in its operating country and for international SaaS sales. Complete merchant, bank, export, tax, and recurring-payment requirements before accepting live payments.
- Create exactly one active monthly recurring Stripe Price for `STARTER`, `GROWTH`, and `SCALE`; set each Price's `athreixPlan` metadata to that exact plan ID, configure the three distinct Price IDs as runtime configuration, and verify `/api/health` reports `stripe_ready`.
- Set `BILLING_TAX_MODE=stripe` only after Stripe Tax is activated and registrations are configured. Use `manual` only with a documented, approved external tax calculation, invoicing, filing, and remittance process.
- Configure the production webhook endpoint and its production-only signing secret for the documented event set. Replay test events and verify altered payloads, unknown Prices, cross-workspace mappings, and stale events fail closed.
- In test mode, complete first purchase, renewal, payment failure/recovery, cancellation-at-period-end, immediate cancellation, and new subscription after cancellation. Confirm redirects never grant credits and proration invoices never grant a full monthly allowance.
- Reconcile paid invoices to ledger entries and verify one grant per subscription period under duplicate and out-of-order webhook delivery before enabling checkout in production.

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
- Run `GET /api/health` against the production domain and require HTTP 200 with no missing configuration. Exercise signup/verification/reset, hosted checkout and a signed paid-invoice credit grant, portal/cancellation, one B2B search, audited reveal, outreach draft with workspace signature, list save, each export format, suppression, privacy request/resolution, retention, session revocation, and admin monitoring.
- Record launch approvers, rollback owner, incident contacts, support path, Actor/source review expiry, model evaluation version, and the exact release commit.
