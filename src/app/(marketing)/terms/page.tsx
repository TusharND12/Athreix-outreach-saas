import type { Metadata } from "next";

import {
  LegalPage,
  type LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing access to and use of Athreix Prospect AI, including subscriptions, billing, credits, and responsible use.",
};

const sections: LegalSection[] = [
  {
    title: "Agreement and eligibility",
    body: (
      <>
        <p>
          These Terms of Service govern access to and use of Athreix Prospect AI
          (the “Service”). By creating an account, purchasing a plan, or using
          the Service, you agree to these terms and our{" "}
          <a href="/responsible-use">Responsible Use Policy</a>.
        </p>
        <p>
          You must be at least 18, legally able to enter a binding agreement,
          and use the Service for legitimate professional purposes. If you use
          the Service for an organization, you confirm that you have authority
          to bind it to these terms.
        </p>
      </>
    ),
  },
  {
    title: "Accounts and security",
    body: (
      <p>
        You must provide accurate account information, protect your credentials,
        assign appropriate workspace access, and promptly report suspected
        unauthorized use. You may not share individual credentials, evade plan
        limits, access another user’s account, probe the Service for
        vulnerabilities, or interfere with its security or operation.
      </p>
    ),
  },
  {
    title: "Permitted use and customer responsibility",
    body: (
      <>
        <p>
          You may use Athreix for authorized B2B prospect research, list
          management, review of AI-assisted analysis, personalized outreach
          drafts, and exports that you are lawfully permitted to process.
        </p>
        <p>
          You are responsible for your instructions, source configuration, data,
          recipients, messages, exports, legal basis, notices, consent,
          suppression obligations, and compliance with applicable law and
          third-party terms. Public availability of information does not by
          itself authorize its collection or use.
        </p>
      </>
    ),
  },
  {
    title: "Plans, billing, and credits",
    body: (
      <>
        <p>
          Current plan features, prices, billing intervals, and included credits
          are shown before checkout. A completed plan purchase grants the
          applicable account entitlements. Research credits are Service usage
          units, have no cash value, and cannot be transferred or resold. One
          delivered eligible prospect normally uses one credit; failed searches
          and undelivered reserved results are not intended to consume credits.
        </p>
        <p>
          Paddle is our authorized reseller and Merchant of Record for paid
          transactions. Paddle processes payment details, taxes, receipts,
          renewals, and eligible refunds. A purchase through Paddle is also
          subject to the{" "}
          <a href="https://www.paddle.com/legal/buyer-terms">
            Paddle Buyer Terms
          </a>
          . Athreix does not receive or store your complete card details.
        </p>
      </>
    ),
  },
  {
    title: "Subscriptions, cancellation, and refunds",
    body: (
      <>
        <p>
          Paid subscriptions renew automatically for the billing interval shown
          at checkout until canceled. You authorize Paddle to charge the payment
          method associated with your subscription for each renewal and
          applicable taxes.
        </p>
        <p>
          You may cancel at any time from the Athreix billing page or Paddle
          customer portal. Unless law or checkout terms require otherwise,
          cancellation takes effect at the end of the current paid billing
          period, access continues until then, and no further renewal is
          charged. Refund requests are governed by our{" "}
          <a href="/refund-policy">Refund Policy</a> and Paddle’s applicable
          buyer terms.
        </p>
      </>
    ),
  },
  {
    title: "Third-party sources and AI output",
    body: (
      <>
        <p>
          The Service may rely on customer-configured sources, Apify actors, AI
          providers, hosting providers, and other third-party services. Their
          availability, terms, and data may change. You must comply with their
          terms and may not direct Athreix to obtain data you are not authorized
          to access.
        </p>
        <p>
          AI scores, summaries, classifications, and drafts may be incomplete,
          outdated, or incorrect. They are decision support and are not legal,
          financial, employment, credit, healthcare, or other professional
          advice. You must review source evidence and output before acting.
        </p>
      </>
    ),
  },
  {
    title: "Customer data and privacy",
    body: (
      <>
        <p>
          You retain your rights in content you provide. You grant Athreix a
          limited right to host, process, transmit, and display that content as
          necessary to provide, secure, support, and maintain the Service and to
          comply with law. You confirm that you have the rights and permissions
          needed for any data you submit or direct us to process.
        </p>
        <p>
          Our processing of personal data is described in the{" "}
          <a href="/privacy">Privacy Notice</a>. We do not claim ownership of
          your prospect lists or outreach drafts.
        </p>
      </>
    ),
  },
  {
    title: "Availability, suspension, and termination",
    body: (
      <>
        <p>
          We work to keep the Service available but do not guarantee
          uninterrupted or error-free operation. Features may change to improve
          safety, reliability, legal compliance, or third-party compatibility.
        </p>
        <p>
          We may restrict or suspend access to protect people, sources,
          customers, or the Service; address non-payment; prevent fraud or
          security incidents; comply with legal requirements; or investigate a
          material breach. You may stop using the Service at any time. Sections
          that by their nature should survive termination continue to apply.
        </p>
      </>
    ),
  },
  {
    title: "Intellectual property",
    body: (
      <p>
        Athreix and its licensors own the Service, software, design, branding,
        documentation, and related intellectual property, excluding customer
        content. Subject to these terms, we grant you a limited, non-exclusive,
        non-transferable, revocable right to use the Service during your
        account’s authorized access period. You may not copy, resell, reverse
        engineer, or create derivative services except where applicable law
        expressly permits it.
      </p>
    ),
  },
  {
    title: "Disclaimers and responsibility",
    body: (
      <>
        <p>
          To the extent permitted by law, the Service is provided “as is” and
          “as available.” We disclaim implied warranties that cannot reasonably
          apply to an evolving, third-party-dependent research service. Nothing
          in these terms excludes rights or liabilities that cannot legally be
          excluded.
        </p>
        <p>
          You remain responsible for decisions, outreach, and other actions
          based on Service output. Athreix is not responsible for indirect or
          consequential loss caused by unauthorized use, customer instructions,
          third-party source changes, or reliance on unreviewed AI output, to
          the extent such limits are permitted by law.
        </p>
      </>
    ),
  },
  {
    title: "Changes and contact",
    body: (
      <>
        <p>
          We may update these terms as the Service, law, or providers change.
          Material changes will be dated and communicated where required. Your
          continued use after an update takes effect means you accept the
          updated terms, except where applicable law requires express consent.
        </p>
        <p>
          Questions about these terms or the Service can be sent to{" "}
          <a href="mailto:umerkhan@athreix.com">umerkhan@athreix.com</a>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="The rules for Athreix accounts, B2B research, AI-assisted output, subscriptions, credits, billing, and responsible use."
      sections={sections}
    />
  );
}
