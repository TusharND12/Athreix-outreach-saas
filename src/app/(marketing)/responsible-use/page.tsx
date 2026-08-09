import type { Metadata } from "next";

import {
  LegalPage,
  type LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Responsible Use",
  description:
    "The pre-launch responsible-use principles and prohibited uses for Athreix Prospect AI.",
};

const sections: LegalSection[] = [
  {
    title: "The short version",
    body: (
      <>
        <p>
          Athreix is for legitimate, purpose-appropriate prospect and audience
          research. It helps users review results and create personalized
          outreach drafts.{" "}
          <strong>It must not be used for unsolicited mass messaging</strong>,
          deceptive contact, harassment, or rights-violating surveillance.
        </p>
        <p>
          A record being publicly accessible does not automatically make its
          collection, processing, enrichment, export, or use lawful.
        </p>
      </>
    ),
  },
  {
    title: "Your authorization and lawful basis",
    body: (
      <>
        <p>Before running a search or using a result, you must:</p>
        <ul>
          <li>
            have the authority and an applicable lawful basis to collect and
            process the data for the stated purpose;
          </li>
          <li>
            follow Apify’s terms and acceptable-use rules, the terms of each
            underlying source, and applicable privacy, marketing,
            consumer-protection, and anti-spam laws;
          </li>
          <li>
            provide required notices and obtain consent where the law or channel
            requires it; and
          </li>
          <li>
            collect only the data reasonably necessary for the approved purpose.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Outreach is draft-only",
    body: (
      <>
        <p>
          Athreix may generate cold-email, LinkedIn, follow-up, or WhatsApp copy
          for human review. It does not authorize a message, validate consent,
          or automatically send bulk campaigns.
        </p>
        <p>
          You are responsible for checking the recipient, context, accuracy,
          channel rules, identity disclosures, opt-out mechanism, frequency, and
          local requirements before sending anything.
        </p>
      </>
    ),
  },
  {
    title: "Prohibited targeting and conduct",
    body: (
      <>
        <p>You may not use Athreix to:</p>
        <ul>
          <li>
            target, profile, infer, or exclude people using sensitive traits
            such as health, biometrics, precise location, religion, political
            views, sexual orientation, union membership, or similarly protected
            data;
          </li>
          <li>identify, target, or build profiles of minors;</li>
          <li>
            make or materially support high-impact decisions about employment,
            housing, credit, insurance, education, healthcare, or legal services
            without appropriate safeguards and independent legal review;
          </li>
          <li>
            facilitate discrimination, stalking, doxxing, intimidation, fraud,
            phishing, impersonation, or deceptive practices;
          </li>
          <li>
            bypass access controls, robots exclusions, rate limits, source
            restrictions, or technical safeguards; or
          </li>
          <li>
            resell or republish personal data in a way that is unauthorized,
            unexpected, or incompatible with the original purpose.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Consumer targeting is not launched",
    body: (
      <p>
        The initial service is limited to B2B professional research. Do not use
        it to target consumer audiences or infer sensitive traits. Any future
        consumer workflow would require separately approved sources, purpose,
        permission, minimization, retention, suppression, export, and legal
        controls before it is offered to customers.
      </p>
    ),
  },
  {
    title: "Rights, opt-outs, and suppression",
    body: (
      <>
        <p>
          You must promptly honor applicable access, correction, deletion,
          objection, restriction, and marketing opt-out requests. Suppressed
          contacts must not be reintroduced by a later search or export.
        </p>
        <p>
          To submit a rights or suppression request involving Athreix, contact
          the relevant workspace owner and email{" "}
          <a href="mailto:privacy@athreix.ai">privacy@athreix.ai</a>. Include
          enough context to locate the record, but do not send unnecessary
          identity documents by ordinary email.
        </p>
      </>
    ),
  },
  {
    title: "Enforcement and questions",
    body: (
      <>
        <p>
          We may limit, suspend, or terminate access; preserve relevant audit
          records; and cooperate with valid legal requests when we reasonably
          believe this policy or applicable law has been violated.
        </p>
        <p>
          Report suspected misuse to{" "}
          <a href="mailto:trust@athreix.ai">trust@athreix.ai</a>. This draft
          will be updated as source configurations, launch regions, and
          regulatory obligations are finalized.
        </p>
      </>
    ),
  },
];

export default function ResponsibleUsePage() {
  return (
    <LegalPage
      title="Responsible Use"
      summary="Clear limits for B2B prospect research and AI-assisted outreach drafts. Trust is a workflow requirement, not a footer promise."
      sections={sections}
    />
  );
}
