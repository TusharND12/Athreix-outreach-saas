import type { Metadata } from "next";

import {
  LegalPage,
  type LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Pre-launch terms of service template for Athreix Prospect AI.",
};

const sections: LegalSection[] = [
  {
    title: "Agreement and eligibility",
    body: (
      <>
        <p>
          These draft terms describe the expected rules for accessing Athreix
          Prospect AI. The binding agreement, contracting entity, governing law,
          launch regions, and order-of-precedence terms will be confirmed before
          paid use.
        </p>
        <p>
          You must be legally able to enter a business agreement, use the
          service for legitimate professional purposes, and have authority to
          bind the organization you represent.
        </p>
      </>
    ),
  },
  {
    title: "Accounts and security",
    body: (
      <p>
        You are responsible for accurate account information, protecting
        credentials, assigning appropriate roles, and promptly reporting
        unauthorized access. You must not share individual credentials,
        circumvent plan limits, or interfere with service security.
      </p>
    ),
  },
  {
    title: "Permitted use and customer responsibility",
    body: (
      <>
        <p>
          You may use Athreix to conduct authorized prospect research, manage
          appropriate lists, review AI analysis, create personalized outreach
          drafts, and export records you are permitted to process.
        </p>
        <p>
          You are responsible for your instructions, source configuration, data,
          recipients, messages, exports, legal basis, notices, consent, and
          compliance. You must follow the{" "}
          <a href="/responsible-use">Responsible Use Policy</a>.
        </p>
      </>
    ),
  },
  {
    title: "Third-party sources and AI output",
    body: (
      <>
        <p>
          The service may rely on Apify, configured actors, AI providers, and
          other third-party services. Their availability, terms, and data may
          change. You must comply with their terms and may not direct Athreix to
          obtain data you are not authorized to access.
        </p>
        <p>
          AI scores, summaries, and drafts can be incomplete or incorrect. They
          are decision support, not legal, financial, employment, credit, or
          other professional advice. Review evidence and output before acting.
        </p>
      </>
    ),
  },
  {
    title: "Credits, plans, and preview service",
    body: (
      <p>
        Planned tiers show proposed credit caps for preview purposes; they do
        not promise automatic grants, renewals, or payment availability. Final
        pricing, credit-grant cadence, failed-job, duplicate-record, refund,
        tax, and cancellation rules will be stated in the applicable order form
        before billing begins. Preview access may be changed or discontinued
        with reasonable notice.
      </p>
    ),
  },
  {
    title: "Customer data and confidentiality",
    body: (
      <>
        <p>
          You retain rights in customer-provided content and grant Athreix the
          limited rights needed to operate, secure, support, and improve the
          service as permitted by the final agreement. Athreix will not claim
          ownership of your prospect lists or outreach drafts.
        </p>
        <p>
          Confidentiality, data-processing, deletion, export, and subprocessor
          commitments will be documented in the final terms and data-processing
          agreement.
        </p>
      </>
    ),
  },
  {
    title: "Suspension and termination",
    body: (
      <p>
        We may restrict or suspend access to protect people, sources, customers,
        or the service; respond to legal requirements; prevent fraud or security
        incidents; address non-payment; or investigate a material breach. Final
        notice, cure, export, and deletion periods will be specified before
        launch.
      </p>
    ),
  },
  {
    title: "Disclaimers and liability framework",
    body: (
      <p>
        The final terms will include jurisdiction-appropriate service
        warranties, disclaimers, indemnities, liability exclusions and caps,
        dispute rules, and mandatory consumer or statutory rights. Those
        provisions require counsel review and are intentionally not invented in
        this product draft.
      </p>
    ),
  },
  {
    title: "Contact and updates",
    body: (
      <p>
        Questions about these draft terms can be sent to{" "}
        <a href="mailto:legal@athreix.ai">legal@athreix.ai</a>. A final version
        will identify the contracting entity, physical notice address, effective
        date, and change-notice process.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="The operating rules Athreix expects to apply to accounts, prospect research, AI output, credits, and responsible use. Final terms will follow counsel review."
      sections={sections}
    />
  );
}
