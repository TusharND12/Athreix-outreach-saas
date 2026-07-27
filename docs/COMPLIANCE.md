# Data and outreach compliance baseline

This document is an engineering control baseline, not legal advice. Counsel must review the actual launch jurisdictions, Actors, target sources, notices, contracts, and outreach practices.

## Why the product uses explicit gates

Apify's current terms make the customer responsible for the legality, authorization, quality, and use of customer data. Actor use must follow Apify's general terms, Acceptable Use Policy, the selected Actor creator's terms, target-source terms, and applicable law. Community Actor creators may receive data according to the Actor's permissions and are not automatically Apify subprocessors.

Apify's Acceptable Use Policy explicitly prohibits unsolicited mass messaging. Athreix therefore creates reviewable drafts for individual prospects; it does not provide a bulk-send engine. A later CRM/email integration must enforce consent/suppression and provider rules independently.

Official references reviewed on 2026-07-20:

- [Apify General Terms and Conditions](https://docs.apify.com/legal/general-terms-and-conditions)
- [Apify Actor Terms and Conditions](https://docs.apify.com/legal/actor-terms-and-conditions)
- [Apify Acceptable Use Policy](https://docs.apify.com/legal/acceptable-use-policy)
- [Apify Data Processing Addendum](https://docs.apify.com/legal/data-processing-addendum)
- [Apify GDPR information](https://docs.apify.com/legal/gdpr-information)
- [India Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)

Terms change. Re-review before launch and quarterly thereafter.

## Actor approval checklist

No production Actor is enabled until an administrator records:

- Actor identifier, creator, maintainer status, version, pricing, permission level, privacy policy, and terms URL
- Intended sources and confirmation that collection does not bypass authentication, access controls, robots/technical restrictions where applicable, or contractual restrictions
- Fields returned, purpose necessity, source URL/provenance coverage, accuracy expectations, and deletion behavior
- Processor/subprocessor role, data locations/transfers, DPA coverage, and any Community Actor creator access
- Rate limits, retry behavior, cost ceiling, dataset retention, and incident contact
- Legal review owner, approval date, expiry/re-review date, and allowed jurisdictions/modes

Prefer Apify-maintained or contractually reviewed Actors with limited permissions. Actor IDs remain environment configuration so an unreviewed marketplace Actor cannot silently become part of the product.

## Product controls

### All searches

- Require a specific business purpose and prohibit fraud, stalking, discrimination, harassment, credential abuse, or source-control circumvention.
- Keep source URL, Actor/run/dataset identifiers, collection time, terms-review metadata, and confidence beside each record.
- Minimize fields before storage and encrypt sensitive contact channels at the application layer.
- Check workspace and global suppression lists before display, outreach generation, list insertion, or export.
- Provide correction, deletion, suppression, and auditable export workflows.
- Prevent AI scores from being used as the sole basis for employment, credit, housing, insurance, healthcare, education, or another regulated/high-impact decision.

### B2C searches

- Require jurisdiction, declared purpose, lawful-basis/consent representation, retention period, and an operator attestation before execution.
- Disable searches for minors and sensitive/special-category traits, inferred vulnerability, exact live location, health, biometrics, religion, caste, race/ethnicity, political beliefs, sexual orientation, financial distress, or similar protected data.
- Default retention to 30 days and require re-justification for extension.
- Do not reveal phone/email until the workspace role and purpose permit it; never export suppressed records.

### Outreach

- Draft only; no automatic or mass sending.
- Surface channel permission, verification/freshness, and suppression state before generation.
- Include sender identity and an opt-out mechanism in templates where applicable.
- Audit the user, prospect, channel, purpose, model, and template version.

## Launch actions outside code

- Execute DPAs and subprocessor terms with Apify, OpenRouter, database, Redis, email, analytics, and storage vendors as applicable.
- Publish counsel-approved privacy notice, terms, responsible-use policy, retention schedule, and data-subject request process.
- Complete jurisdiction-specific assessments for India's DPDP Act/Rules, GDPR/ePrivacy/PECR, CCPA/CPRA, CAN-SPAM, TCPA, and other applicable marketing/privacy laws.
- Establish incident response, breach notification, access reviews, deletion verification, and quarterly Actor/source audits.
