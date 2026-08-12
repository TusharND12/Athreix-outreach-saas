import type { Metadata } from "next";

import {
  LegalPage,
  type LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description:
    "How Athreix collects, uses, shares, protects, and retains account, service, and customer-directed prospect data.",
};

const sections: LegalSection[] = [
  {
    title: "Scope and roles",
    body: (
      <>
        <p>
          This Privacy Notice explains how Athreix handles personal data for its
          website, accounts, support, security, billing integration, and
          prospect-intelligence Service.
        </p>
        <p>
          Athreix generally acts as a controller for account, website, security,
          billing-reference, and support data. For prospect data that a
          workspace directs us to process, Athreix may act as a processor or
          service provider and the workspace customer remains responsible for
          its instructions, notices, lawful basis, and data-subject requests.
        </p>
      </>
    ),
  },
  {
    title: "Data we process",
    body: (
      <ul>
        <li>
          account and profile information such as name, business email,
          authentication records, organization, roles, and preferences;
        </li>
        <li>
          customer instructions, search briefs, filters, saved lists, notes,
          outreach drafts, and export settings;
        </li>
        <li>
          business and professional prospect information from customer input and
          authorized sources, together with provenance, confidence, and
          freshness metadata;
        </li>
        <li>
          usage, credits, device, security, audit, error, cookie, and support
          information; and
        </li>
        <li>
          Paddle customer, subscription, transaction, price, and status
          references needed to provide paid plans. Complete payment-card details
          are handled by Paddle and are not stored by Athreix.
        </li>
      </ul>
    ),
  },
  {
    title: "Sources of data",
    body: (
      <p>
        We receive data directly from users and workspace administrators; from
        use of the Service; from configured providers such as Apify and public
        business sources that a customer is authorized to use; from security and
        infrastructure providers; and from Paddle for billing and subscription
        administration. Source access and downstream use must comply with
        applicable law and source terms.
      </p>
    ),
  },
  {
    title: "Purposes and legal grounds",
    body: (
      <>
        <p>We process personal data to:</p>
        <ul>
          <li>
            create and administer accounts and provide requested features;
          </li>
          <li>
            run authorized research instructions, manage credits, and produce
            customer-directed results;
          </li>
          <li>
            authenticate users, prevent abuse, investigate incidents, and keep
            audit records;
          </li>
          <li>
            administer subscriptions, provide support, and communicate about the
            account;
          </li>
          <li>improve reliability, accessibility, and service quality; and</li>
          <li>comply with legal obligations and enforce our policies.</li>
        </ul>
        <p>
          Depending on the context and your location, our legal ground may be
          contract performance, legitimate interests, consent, or legal
          obligation. Customers must independently establish an appropriate
          legal basis for prospect data and outreach activities they direct.
        </p>
      </>
    ),
  },
  {
    title: "Service providers and sharing",
    body: (
      <>
        <p>
          We disclose only the data reasonably needed to providers that help us
          host, secure, authenticate, operate, support, analyze, or bill for the
          Service. These may include Google Cloud and Firebase, Paddle, Apify,
          configured AI providers, email providers, and professional advisers.
          Providers process data under their own terms and applicable data
          protection obligations.
        </p>
        <p>
          We may also disclose data to a workspace administrator; at your
          direction; during a corporate transaction subject to appropriate
          safeguards; or when reasonably necessary to comply with law, protect
          rights and safety, investigate abuse, or secure the Service.
        </p>
        <p>
          Payment information submitted through Paddle Checkout is governed by
          the{" "}
          <a href="https://www.paddle.com/legal/privacy">
            Paddle Privacy Notice
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "Retention and deletion",
    body: (
      <>
        <p>
          We retain data only for as long as reasonably needed to provide the
          Service, fulfill customer instructions, maintain security and audit
          records, resolve disputes, enforce agreements, and meet legal or
          accounting obligations. Retention depends on the data category,
          workspace settings, source restrictions, account status, and legal
          requirements.
        </p>
        <p>
          When data is no longer required, we delete, anonymize, or securely
          isolate it. Backup copies may remain for a limited period until
          overwritten. A workspace may request export or deletion subject to
          authentication, other users’ rights, fraud prevention, and mandatory
          retention duties.
        </p>
      </>
    ),
  },
  {
    title: "Security and international processing",
    body: (
      <>
        <p>
          Safeguards include encrypted network transport, encryption at rest
          provided by our cloud infrastructure, additional protection for
          designated sensitive fields, access controls, validation, rate
          limiting, audit logging, secure session controls, backups, and
          incident-response procedures. No system can guarantee absolute
          security.
        </p>
        <p>
          Athreix and its providers may process data in countries other than
          yours. Where required, we use contractual or other recognized
          safeguards for international transfers, while recognizing that local
          laws may differ.
        </p>
      </>
    ),
  },
  {
    title: "Cookies and account choices",
    body: (
      <p>
        We use essential cookies and similar storage for authentication, account
        security, preferences, and core Service operation. Disabling essential
        cookies may prevent sign-in or other features from working. If optional
        analytics or marketing technologies are introduced, we will provide
        notices and choices required by applicable law.
      </p>
    ),
  },
  {
    title: "Your rights",
    body: (
      <>
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, restrict, object, port, withdraw consent, or appeal certain
          decisions. You may also request suppression from future prospect
          workflows and opt out of marketing communications.
        </p>
        <p>
          Send a request to{" "}
          <a href="mailto:tech@athreix.com">tech@athreix.com</a> or contact the
          relevant workspace owner. We may request proportionate information to
          verify the request and will not ask for unnecessary identity documents
          by ordinary email. You may also complain to your local data protection
          authority.
        </p>
      </>
    ),
  },
  {
    title: "Children, sensitive data, and updates",
    body: (
      <>
        <p>
          Athreix is not intended for children, and its prospecting tools must
          not be used to identify or target minors. Customers must not upload or
          infer sensitive personal data unless a narrowly authorized workflow
          and all necessary legal and security safeguards apply.
        </p>
        <p>
          We may update this notice as the Service, providers, or law changes.
          Material updates will show a new effective date and will be
          communicated where required. Privacy questions may be sent to{" "}
          <a href="mailto:tech@athreix.com">tech@athreix.com</a>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      summary="How Athreix collects, uses, shares, protects, and retains account, service, billing-reference, and customer-directed prospect data."
      sections={sections}
    />
  );
}
