# Security model

## Protected assets

- Account credentials, sessions, provider tokens, and reset/verification tokens
- Prospect contact channels and source/provenance records
- Workspace searches, notes, lists, outreach drafts, exports, and credits
- Admin actions, audit history, and billing entitlements

## Trust boundaries

The browser is untrusted. Every API revalidates identity, workspace membership, role, payload, requested record IDs, and current suppression/compliance state. Apify outputs and OpenRouter model outputs are untrusted provider data and must pass normalization and strict structured-output schema validation before persistence or rendering.

## Implemented control expectations

- Auth.js encrypted, HTTP-only, secure, same-site session cookies in production
- Password hashing for credential-based accounts and single-use, expiring recovery tokens
- Workspace-scoped RBAC and separate platform-admin authorization
- Verified-email plus platform-admin approval for new customer access; rejection/suspension checks at sign-in, JWT refresh, and request context; session-version rotation on every access-state mutation
- Zod input validation, request-size limits, rate limiting, idempotency for job/export/checkout creation, and CSRF/origin protection for mutations
- Stripe-hosted card collection; exact-path webhook CSRF exemption; raw-body signature verification; payload-digest replay protection; tenant/customer/subscription cross-checks; configured server-side Price mapping; stale-event protection; and one credit grant per subscription period
- AES-256-GCM envelope format for sensitive fields with versioned keys and room for rotation
- No secrets or decrypted contact values in queues, logs, URLs, analytics, or client-rendered server errors
- Append-only credits ledger and audit events for admin, export, compliance, list, and outreach mutations
- Security headers, strict content-type handling, safe download filenames, spreadsheet formula neutralization, and short-lived signed export URLs
- Dependency scanning, secret scanning, lint/type/test/build gates, and least-privilege production credentials

## Operational requirements

- Store secrets in the deployment platform, not `.env` files committed to Git.
- Use separate production, staging, preview, and local databases and storage buckets.
- Keep Firestore and Storage browser access deny-by-default, make the Cloud Run worker private, and use separate least-privilege enqueue, task-invoker, and worker identities. Enable backups, point-in-time recovery, and tested restore procedures.
- Rotate provider, auth, webhook, and encryption credentials on a documented schedule and immediately after suspected exposure.
- Review platform admins, pending/grandfathered customer approvals, suspensions, credit adjustments, and Actor allowlists at least quarterly.
- Redact logs by default and keep audit records longer than operational logs only when the retention policy permits it.

## Reporting

Before public launch, replace this section with a monitored security contact, disclosure policy, and response SLA. Do not put vulnerability details in public issues.
