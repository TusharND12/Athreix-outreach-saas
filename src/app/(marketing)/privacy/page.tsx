import type { Metadata } from "next";

import {
  LegalPage,
  type LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Pre-launch privacy notice template for Athreix Prospect AI.",
};

const sections: LegalSection[] = [
  {
    title: "Scope and roles",
    body: (
      <>
        <p>
          This notice describes how Athreix expects to handle personal data for
          its website, accounts, support, security, and prospect-intelligence
          service.
        </p>
        <p>
          Depending on the workflow and launch jurisdiction, Athreix may act as
          a controller for account and service-operation data and as a processor
          or service provider for customer-directed prospect data. The final
          role allocation will be documented in the launch terms and
          data-processing agreement.
        </p>
      </>
    ),
  },
  {
    title: "Data we may process",
    body: (
      <ul>
        <li>
          account and profile details, such as name, business email,
          authentication records, company, and preferences;
        </li>
        <li>
          customer instructions, search briefs, filters, saved lists, notes,
          outreach drafts, and export settings;
        </li>
        <li>
          business and professional prospect data from customer-configured,
          authorized sources, including provenance, confidence, and freshness
          metadata;
        </li>
        <li>
          permission-appropriate consumer-audience data when B2C controls and an
          authorized purpose apply;
        </li>
        <li>
          usage, credit, device, security, audit, error, and support
          information; and
        </li>
        <li>
          billing and subscription references when payment processing is
          introduced.
        </li>
      </ul>
    ),
  },
  {
    title: "Purposes and legal grounds",
    body: (
      <>
        <p>
          We expect to process data to provide and secure the service, run
          customer instructions, support users, prevent abuse, manage credits,
          improve reliability, comply with law, and communicate about the
          account.
        </p>
        <p>
          The applicable legal ground may include contract performance,
          legitimate interests, consent, or legal obligation. Customers must
          independently establish the lawful basis for the prospect data and
          outreach activities they direct.
        </p>
      </>
    ),
  },
  {
    title: "Sources and service providers",
    body: (
      <>
        <p>
          Prospect data may come from customer input and configured providers
          such as Apify actors. Source access and downstream use must comply
          with Apify’s terms, each underlying source’s terms, and applicable
          law.
        </p>
        <p>
          Expected infrastructure and service providers include hosting,
          database, storage, authentication, queue, analytics, support, email,
          and AI providers. The final subprocessor list and
          international-transfer safeguards will be published before launch.
        </p>
      </>
    ),
  },
  {
    title: "Retention, security, and minimization",
    body: (
      <>
        <p>
          We intend to keep personal data only as long as needed for the
          documented purpose, account obligations, security, disputes, and
          applicable law. B2C data should use shorter, explicit retention
          windows and restricted exports.
        </p>
        <p>
          Planned safeguards include role-based access, encryption in transit
          and for designated sensitive fields at rest, rate limiting, audit
          logs, validation, secure session controls, backups, and incident
          response. No system can guarantee absolute security.
        </p>
      </>
    ),
  },
  {
    title: "Your choices and rights",
    body: (
      <>
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, restrict, object, port, withdraw consent, or appeal certain
          decisions. You may also opt out of marketing communications and
          request suppression from future prospect workflows.
        </p>
        <p>
          Contact <a href="mailto:privacy@athreix.ai">privacy@athreix.ai</a> or
          the relevant workspace owner. We may need proportionate information to
          verify a request and will not ask for unnecessary identity material.
        </p>
      </>
    ),
  },
  {
    title: "Children, sensitive data, and changes",
    body: (
      <>
        <p>
          Athreix is not intended for children, and its prospecting tools must
          not be used to target minors. Customers must not upload or infer
          sensitive personal data unless a narrowly authorized workflow and all
          necessary safeguards have been approved in writing.
        </p>
        <p>
          This template will change after counsel review, launch-region
          selection, vendor configuration, and completion of the data-protection
          impact assessment. Material updates will be dated and communicated as
          required.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      summary="How Athreix plans to handle account, service, and customer-directed prospect data. This is a transparent pre-launch draft, not the final legal notice."
      sections={sections}
    />
  );
}
