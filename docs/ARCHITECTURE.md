# Architecture

## System shape

```mermaid
flowchart LR
  U[Operator] --> N[Next.js app on Firebase App Hosting]
  N --> A[Firebase Authentication + Auth.js sessions]
  N --> F[(Cloud Firestore)]
  N --> T[Google Cloud Tasks]
  T -->|OIDC + signed body| W[Private Cloud Run worker]
  W --> AP[Reviewed Apify discovery Actor]
  W --> APR[Parallel Apify research Actors]
  W --> O[OpenRouter structured intelligence]
  W --> F
  N --> S[Firebase Storage]
  U --> ST[Paddle Checkout and Customer Portal]
  ST -->|signed webhook| N
  N --> U
```

The Next.js application owns server-rendered pages, authenticated APIs, permission checks, request validation, short mutations, and job creation. Search processing happens in the worker so Apify polling, normalization, enrichment, and scoring do not depend on a serverless request remaining alive.

Cloud Firestore is the source of truth for users, workspaces, billing, searches, jobs, results, and the append-only audit ledger. Firebase Authentication owns password identities, Auth.js issues the application session, and Firebase Storage holds private expiring export artifacts. Browser access to Firestore and Storage is denied; all product access passes through authenticated server APIs and Admin SDK IAM.

Paddle Sandbox is the external payment processor for staging, not the entitlement source of truth. Only workspace owners can request a server-authorized Checkout or Customer Portal session; the server maps the requested plan to a configured Paddle Price and binds workspace metadata before Paddle.js opens the overlay. A raw-body signature-verified webhook maps a configured Paddle Price to an internal plan, verifies the workspace/customer/subscription binding, rejects stale state changes, and appends credits only for a completed initial or recurring subscription transaction. The billing event, subscription state, workspace balance, and unique transaction ledger grant commit in one transaction.

## Search lifecycle

1. Validate the audience brief, filters, mode, lawful-purpose fields, requested lead count, and available credits.
2. Create the search and job in one database transaction; reserve credits in the append-only ledger.
3. Enqueue only the job identifier—never raw contact data—in Google Cloud Tasks. Each push request carries an OIDC identity and an HMAC over the exact body.
4. Resolve the configured, reviewed discovery Actor for B2B or B2C and record the actor/source metadata.
5. For each discovered B2B company, fan out reviewed Apify research Actors under company/actor semaphores. Retry with bounded attempts, deduplicate evidence, cache normalized bundles, and clean provider artifacts.
6. Normalize the discovery dataset and research bundles into canonical company, contact, signal, technology, and evidence shapes with timestamps and confidence.
7. Deduplicate companies and people with deterministic normalized keys before fuzzy or AI-assisted comparison.
8. Apply deterministic eligibility and base scoring first. OpenRouter structured analysis runs concurrently in small ordered windows under a process-wide semaphore, explicit per-call bounds, and a cooperative job budget; budget exhaustion switches remaining records to deterministic analysis rather than orphaning the job.
9. Persist canonical companies/people and their website analysis, buying signals, evidence, timeline, tasks, and research reports. Attach an immutable non-sensitive profile snapshot to each result, update leased-job progress, reconcile actual credit usage, and create a notification.
10. Export through an audited, permission-checked path as PDF, CSV, Excel, JSON, CRM-ready CSV, or an AI intelligence report; large artifacts expire from storage.

## Degraded modes

- `DEMO_MODE=true`: deterministic data, analysis, job progress, and exports; intended for local/product evaluation.
- Firestore unavailable: read-only UI fixtures remain available, but persistent mutations report a clear degraded state.
- Firebase Authentication unavailable: account creation and password sign-in fail closed; existing application sessions continue only until their configured expiry.
- Firebase Storage unavailable: searches and saved data continue, but durable export upload/download is unavailable and health reports the storage component as degraded.
- Billing configuration or Price validation unavailable: hosted checkout and subscription management fail closed. No browser or subscription-status event can grant credits; existing recorded credits remain governed by the ledger.
- Cloud Tasks unavailable: development may process a bounded job inline. Production never runs a search inline; an ambiguous/claimed enqueue remains pending, while a confirmed unclaimed job is failed and its reservation released.
- Apify unavailable: the job records a retryable provider error. OpenRouter timeout, refusal, schema failure, or analysis-budget exhaustion uses the auditable deterministic analysis and is recorded in job metrics.

## Multi-tenancy

Every mutable business entity belongs to a workspace. Authorization is checked by workspace membership and role at the service boundary, not only in the UI. Unique constraints include workspace scope where appropriate. Admin access is separate from workspace ownership and every admin mutation is audited.

New customers are placed in an explicit `PENDING` approval state. Email/password accounts must also complete email verification; OAuth does not bypass the approval gate. Platform administrators approve or reject customers through `/admin`, can separately suspend or restore an approved account, and cannot mutate other platform-admin accounts from the portal. Any access-state change increments `sessionVersion`, so an existing JWT is invalidated on its next authenticated request. Pre-gate customer documents without an approval field are treated as grandfathered approved records until an administrator explicitly changes them.

## Deployment

Firebase App Hosting runs the Next.js application in `us-central1` behind a global load balancer and Cloud CDN. The default Firestore database uses the `nam5` multi-region for higher availability near the dynamic application origin. Google Cloud Tasks pushes bounded-retry work to a private Cloud Run worker built from the same source image. The web and worker share the same Firebase project and encryption configuration, while IAM and secret access remain least-privilege per service. Preview environments should use an isolated Firebase project or demo mode; never point untrusted previews at production data.
