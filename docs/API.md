# API contract

Athreix exposes same-origin application APIs under `/api`. They are intended for the web application and a trusted worker, not as a public third-party API. Authenticated routes use the Auth.js session cookie; mutating requests are origin checked, JSON bodies are size limited, and service methods repeat workspace and role checks.

The initial customer launch is B2B-only. The internal contract still documents dormant B2C controls so they cannot be mistaken for an ungoverned future path, but production must leave B2C provider/source configuration disabled until a separate launch review is complete.

## Response conventions

Most successful JSON responses use this envelope:

```json
{
  "data": {},
  "meta": { "demo": false }
}
```

Validation and service errors use a stable, non-sensitive envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": {}
  }
}
```

List endpoints add pagination metadata. `POST /api/export` is the exception: it streams the generated file and returns its identifier and row count in `X-Athreix-*` response headers.

Workspace roles are ordered `VIEWER < MEMBER < ADMIN < OWNER`. Platform-admin routes also require `User.isPlatformAdmin`. Consumer collection and consumer contact-data access require `ADMIN` or `OWNER`; the service rechecks purpose, consent/channel permission, suppression, and retention at access time.

## Core prospect APIs

| Method   | Route                                   | Minimum access                         | Purpose                                                                                                                 |
| -------- | --------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/search`                           | B2B: member; B2C: admin                | Validate compliance fields, reserve credits, persist a search/job, and enqueue collection. `/api/searches` is an alias. |
| `GET`    | `/api/search`                           | Viewer                                 | Paginated search history.                                                                                               |
| `GET`    | `/api/search/:id`                       | Viewer                                 | Authoritative search metadata and latest job.                                                                           |
| `DELETE` | `/api/search/:id`                       | Member                                 | Delete a workspace search and its dependent records.                                                                    |
| `GET`    | `/api/jobs/:id`                         | Viewer                                 | Latest job state by job or search identifier.                                                                           |
| `GET`    | `/api/results`                          | Viewer                                 | Filtered, sorted, paginated, contact-masked results. Requires `searchId` for a specific run.                            |
| `GET`    | `/api/results?searchId=:id&reveal=true` | Member                                 | Search-scoped full B2B contact values with a page-level audit; suppressed and consumer records remain protected.        |
| `GET`    | `/api/results/:id`                      | Viewer                                 | Result details with masked contact channels.                                                                            |
| `GET`    | `/api/results/:id?reveal=true`          | Member; consumer records require admin | Audited reveal after current suppression, purpose, channel-permission, and retention checks.                            |
| `GET`    | `/api/company/:id`                      | Viewer                                 | Workspace-scoped company profile, evidence, and masked professional contacts.                                           |
| `POST`   | `/api/outreach`                         | Member                                 | Create an individual, reviewable draft. It never sends a message.                                                       |
| `GET`    | `/api/outreach`                         | Viewer                                 | Latest workspace drafts.                                                                                                |

The compatibility routes `/api/generate-email`, `/api/generate-linkedin`, `/api/generate-follow-up`, and `/api/generate-whatsapp` delegate to the same outreach service and controls.

### Search creation

`POST /api/search` accepts `mode`, `query`, optional structured `filters`, `targetCount`, and a plain-language `purpose`. B2C requests additionally require a reviewed first-party or permissioned-partner source and reference, jurisdiction, lawful basis, adult-only and responsible-use attestations, and a bounded retention period. Legitimate-interest processing requires its assessment. The exact schema lives in `src/server/schemas.ts` and unknown keys are rejected.

Send a unique `Idempotency-Key` header (8–200 characters) for retried search creation. One credit is reserved per requested lead; the pipeline reconciles the reservation against eligible stored results exactly once.

### Results query

`GET /api/results` supports `searchId`, `page`, `pageSize` (maximum 100), `minScore`, `industry`, `location`, `title`, `companySize`, `sort=score|newest|company|location`, and `reveal=true`. Bulk reveal requires a search ID and member access, is limited to eligible B2B rows, and writes an audit event for each returned page. Expired or suppressed contact values are never revealed.

Displayed, exported, and outreach-context profile attributes come from the immutable non-sensitive snapshot captured for that search result. A later enrichment may update the shared canonical company/person, but it cannot rewrite an older result's profile context. Sensitive channel reveal, current verification, suppression, retention, and B2C purpose/channel permission are always evaluated from live canonical records.

### Outreach creation

```json
{
  "resultId": "result-id",
  "type": "COLD_EMAIL",
  "tone": "professional",
  "manualIntent": true,
  "offer": "Optional specific offer",
  "context": "Optional operator context"
}
```

Supported types are `COLD_EMAIL`, `LINKEDIN_MESSAGE`, `LINKEDIN_CONNECTION`, `FOLLOW_UP`, and `WHATSAPP`. Supported tones are `professional`, `friendly`, `direct`, and `premium`.

## Lists and exports

| Method                   | Route                       | Minimum access                       | Purpose                                                                                   |
| ------------------------ | --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `GET`, `POST`            | `/api/lists`                | Viewer / member                      | List or create saved lists.                                                               |
| `GET`, `PATCH`, `DELETE` | `/api/lists/:id`            | Viewer / member                      | Read, rename/move, add/remove results, or delete a list.                                  |
| `GET`, `POST`            | `/api/folders`              | Viewer / member                      | List or create nested folders.                                                            |
| `POST`                   | `/api/export`               | Member; consumer data requires admin | Generate CSV, XLSX, or JSON from exactly one search/list after live authorization checks. |
| `GET`                    | `/api/exports`              | Viewer                               | Paginated safe export history; non-admin users see only their own exports.                |
| `GET`                    | `/api/exports/:id/download` | Member                               | Audit and redirect to an unexpired short-lived storage URL.                               |
| `DELETE`                 | `/api/exports/:id`          | Member                               | Remove an authorized export record and stored object where configured.                    |

Export requests require `acknowledgeLawfulUse: true` and exactly one `searchId` or `listId`. Optional controls include `selectedIds`, `minScore`, `onlyVerified`, and a unique subset of `PROFILE`, `COMPANY_OR_AUDIENCE`, `CONTACT`, `AI_ANALYSIS`, and `PROVENANCE`. Spreadsheet formulas are neutralized. Send an `Idempotency-Key` header for safe client retries.

## Workspace and governance APIs

| Routes                                             | Access                    | Notes                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/dashboard`, `/api/usage`, `GET /api/billing` | Viewer                    | Current metrics, append-only credit activity, safe subscription state, and plan metadata.                                                                             |
| `POST /api/billing/checkout`                       | Owner                     | Create an idempotent hosted subscription Checkout session for a server-mapped plan Price.                                                                             |
| `POST /api/billing/portal`                         | Owner                     | Create a short-lived hosted customer-portal session for the workspace's mapped billing customer.                                                                      |
| `POST /api/billing/webhook`                        | Stripe signature          | Verify the raw request signature and transactionally reconcile idempotent subscription and paid-invoice entitlement events.                                           |
| `/api/profile`                                     | Viewer                    | Read/update supported personal profile fields.                                                                                                                        |
| `POST /api/profile/sessions/revoke`                | Viewer                    | Rotate the user's session version so every existing session is rejected on its next authenticated request.                                                            |
| `/api/settings`                                    | Viewer read; admin write  | Workspace defaults, sender identity, timezone, tone, and retention.                                                                                                   |
| `/api/notifications`                               | Viewer                    | List and mark the current user's notifications read.                                                                                                                  |
| `/api/suppressions`                                | Admin                     | Add/list hashed channel suppression entries; deletion requests erase matched canonical records.                                                                       |
| `/api/privacy/requests`                            | Viewer submit; admin list | Encrypted, duplicate-safe data-rights request intake and workspace request history.                                                                                   |
| `GET /api/admin`, `/api/admin/health`              | Platform admin            | Aggregate customer/usage metrics and secret-free dependency readiness.                                                                                                |
| `GET`, `PATCH /api/admin/users`                    | Platform admin            | Search customers and approve, reject, suspend, or restore access. Verified email is required for approval; every mutation is audited and rotates the session version. |
| `POST /api/admin/credits`                          | Platform admin            | Idempotent, reason-required workspace credit adjustment backed by the append-only ledger.                                                                             |
| `GET`, `PATCH /api/admin/privacy`                  | Platform admin            | List requests, audit every encrypted identity reveal, and record encrypted resolution/evidence metadata.                                                              |
| `/api/admin/jobs`, `/searches`, `/errors`, `/logs` | Platform admin            | Restricted worker/search failure visibility and audit history for the `/admin` operations portal.                                                                     |

`GET /api/internal/monitoring` requires the retention/cron bearer secret and returns HTTP 503 when recent failures, stale jobs, past-due subscriptions, overdue privacy requests, or provider cleanup more than 26 hours past retention require operator attention. The response contains counts only, never prospect payloads.

## Authentication and operations

Credential signup is `POST /api/auth/register` and requires the current terms/responsible-use versions. New password accounts must verify their email via `/api/auth/verify-email`, then receive platform-admin approval before a session is accepted. New OAuth customers enter the same pending-approval state; allowlisted platform administrators bootstrap as approved. Accounts created before this gate are grandfathered to avoid an unsafe rollout lockout. Approval, rejection, suspension, and restoration are enforced at sign-in, JWT refresh, and request-context boundaries. `/api/auth/resend-verification`, forgot-password, and single-use reset-password routes are rate limited. OAuth and session handling are owned by Auth.js at `/api/auth/*`.

`GET /api/health` is a public, secret-free readiness response. A live production instance reports ready only when the environment schema, password authentication client/server configuration, database, encryption, Cloud Tasks/private Cloud Run target, reviewed Apify discovery and research Actors, OpenRouter, export storage, email, billing provider/Prices, retention secret, and canonical URLs are configured and reachable as applicable. `GET /api/internal/retention` requires `Authorization: Bearer $CRON_SECRET` (or `X-Cron-Secret`) and is intended only for the configured scheduler.
