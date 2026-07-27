# API contract

Athreix exposes same-origin application APIs under `/api`. They are intended for the web application and a trusted worker, not as a public third-party API. Authenticated routes use the Auth.js session cookie; mutating requests are origin checked, JSON bodies are size limited, and service methods repeat workspace and role checks.

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

| Routes                                         | Access                    | Notes                                                                                                                         |
| ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/api/dashboard`, `/api/usage`, `/api/billing` | Viewer                    | Current metrics, append-only credit activity, and plan metadata. Payment checkout is intentionally unavailable.               |
| `/api/profile`                                 | Viewer                    | Read/update supported personal profile fields.                                                                                |
| `/api/settings`                                | Viewer read; admin write  | Workspace defaults, sender identity, timezone, tone, and retention.                                                           |
| `/api/notifications`                           | Viewer                    | List and mark the current user's notifications read.                                                                          |
| `/api/suppressions`                            | Admin                     | Add/list hashed channel suppression entries; deletion requests erase matched canonical records.                               |
| `/api/privacy/requests`                        | Member submit; admin list | Encrypted data-rights request intake. Resolution is a verified operational workflow until an admin resolution API is shipped. |
| `/api/admin/*`                                 | Platform admin            | Aggregate health, users, jobs, searches, errors, logs, analytics, and idempotent credit adjustment.                           |

## Authentication and operations

Credential signup is `POST /api/auth/register` and requires the current terms/responsible-use versions. New password accounts must verify their email via `/api/auth/verify-email`; `/api/auth/resend-verification`, forgot-password, and single-use reset-password routes are rate limited. OAuth and session handling are owned by Auth.js at `/api/auth/*`.

`GET /api/health` is a public, secret-free readiness response. A live production instance reports ready only when authentication, database, encryption, Redis, reviewed Apify discovery and research Actors, OpenRouter, and export storage are configured and reachable as applicable. `GET /api/internal/retention` requires `Authorization: Bearer $CRON_SECRET` (or `X-Cron-Secret`) and is intended only for the configured scheduler.
