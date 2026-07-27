# Production launch checklist

The repository fails closed when critical services or approvals are missing. Complete every item below for the intended region before inviting customers; a successful source build alone is not a legal, data-quality, or operational approval.

## Infrastructure

- Provision an isolated production Firebase project and Redis with network restrictions and a tested recovery plan. Enable Firestore point-in-time recovery or scheduled backups before launch.
- Enable Firebase Authentication providers, create Firestore and Storage in the intended region, and deploy the committed Firestore rules/indexes and Storage rules.
- Deploy the Next.js web image and the same image with command `pnpm worker`. Confirm the public health endpoint sees a current worker heartbeat before routing traffic.
- Configure the authenticated daily retention request and alert on any non-2xx result, provider-cleanup backlog, queue age, failed jobs, or storage deletion failure.
- Keep Firestore and Storage browser rules deny-by-default. Grant the server/worker service account only the required Firestore, Authentication, Storage-object, and service-usage roles.

## Identity and secrets

- Generate unique production values for `AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, and `CRON_SECRET`; store them in the deployment secret manager.
- Set the canonical HTTPS `NEXT_PUBLIC_APP_URL`. Configure SMTP sender authentication and Google OAuth as applicable, including exact redirect origins.
- Rotate every credential used during staging before launch. Verify that previews use isolated data and cannot access production provider or storage credentials.
- Set `ADMIN_EMAILS` deliberately and review platform-admin records, workspace roles, and suspended accounts.

## Prospect providers

- Select specific Apify Actors and document the creator, immutable/versioned release, terms URL/version, permissions, reviewed modes and jurisdictions, review owner/date, and expiry/re-review date.
- Put only those Actor IDs in `APIFY_ALLOWED_ACTORS`; a configured ID is not implicitly allowed.
- Register each approved B2C source reference exactly in `APIFY_B2C_SOURCES_JSON`, including its owning/licensed `workspaceIds`, source owner, Actor, jurisdiction, review window, and terms version. Test that the same reference is denied from every other workspace; a reference is an identifier, not authorization.
- Run bounded cost, timeout, partial-run, retry, deletion, and schema-change tests against staging Actors. Confirm unfinished runs are aborted and cannot be charged as completed searches.
- Verify target-source terms, collection authority, notices, processor/subprocessor roles, transfers, and Apify/Actor deletion behavior with counsel and procurement.

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
- Run `GET /api/health` against the production domain and require HTTP 200 with no missing configuration. Exercise signup/verification/reset, one B2B search, one authorized B2C search, audited reveal, outreach draft, list save, each export format, suppression, deletion, retention, and admin monitoring.
- Record launch approvers, rollback owner, incident contacts, support path, Actor/source review expiry, model evaluation version, and the exact release commit.
