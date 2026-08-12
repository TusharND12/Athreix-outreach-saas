import type { Metadata } from "next";

import {
  LegalPage,
  type LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "How to cancel an Athreix subscription or request a refund through Paddle, Athreix's authorized reseller and Merchant of Record.",
};

const sections: LegalSection[] = [
  {
    title: "Who handles payments and refunds",
    body: (
      <>
        <p>
          Paddle is Athreix’s authorized reseller and Merchant of Record. Your
          paid transaction is completed with Paddle, which handles payment
          processing, receipts, applicable sales taxes, subscription billing,
          and approved refunds.
        </p>
        <p>
          This policy supplements the{" "}
          <a href="https://www.paddle.com/legal/refund-policy">
            Paddle Refund Policy
          </a>{" "}
          and{" "}
          <a href="https://www.paddle.com/legal/buyer-terms">
            Paddle Buyer Terms
          </a>
          . If those terms or applicable law provide stronger or non-waivable
          rights, those rights apply.
        </p>
      </>
    ),
  },
  {
    title: "Refund eligibility",
    body: (
      <>
        <p>
          Except where required by applicable law, provided by Paddle’s policy,
          or approved for a material product defect, completed subscription
          charges are non-refundable. Refund eligibility is reviewed using the
          transaction date, reason for the request, product access and usage,
          technical evidence, and applicable consumer rights.
        </p>
        <p>
          Some consumers have statutory withdrawal or cancellation rights,
          including time-limited rights in certain countries. Use Paddle’s
          current Refund Policy for the applicable eligibility window and
          exclusions. Nothing in this policy limits mandatory consumer rights.
        </p>
      </>
    ),
  },
  {
    title: "How to request a refund",
    body: (
      <>
        <p>You can request a refund using any of these routes:</p>
        <ul>
          <li>
            use the “View receipt” or “Manage subscription” link in your Paddle
            transaction email;
          </li>
          <li>open the customer portal from the Athreix Billing page; or</li>
          <li>
            visit <a href="https://paddle.net">paddle.net</a> and choose the
            refund-support option.
          </li>
        </ul>
        <p>
          Include the purchase email, transaction or receipt reference, date,
          plan, reason for the request, and any relevant technical details. Do
          not email complete card numbers or passwords.
        </p>
      </>
    ),
  },
  {
    title: "Technical or access problems",
    body: (
      <>
        <p>
          If a persistent technical issue or material defect prevents access to
          the paid Service, contact{" "}
          <a href="mailto:umerkhan@athreix.com">umerkhan@athreix.com</a> first
          so we can investigate, restore access, or document the problem for
          Paddle. Include the account email, approximate time, affected feature,
          and any non-sensitive error message.
        </p>
        <p>
          If the issue cannot be resolved, submit the refund request to Paddle
          with the support history. Paddle reviews and issues eligible refunds
          under its policy and applicable consumer law.
        </p>
      </>
    ),
  },
  {
    title: "Cancellation is different from a refund",
    body: (
      <p>
        You may cancel a subscription at any time from the Athreix Billing page,
        the Paddle customer portal, or the link in your Paddle receipt. Unless
        law or checkout terms require otherwise, cancellation takes effect at
        the end of the current billing period, you keep access until then, and
        Paddle will not charge the next renewal. Cancellation does not
        automatically refund charges already paid.
      </p>
    ),
  },
  {
    title: "Approved refunds and account access",
    body: (
      <p>
        Paddle normally returns an approved refund to the original payment
        method where possible. Bank processing time may vary. After Paddle
        confirms a full refund, Athreix may adjust the related subscription
        access and unused plan entitlements so that the account reflects the
        refunded transaction.
      </p>
    ),
  },
  {
    title: "Billing and tax questions",
    body: (
      <p>
        For a duplicate charge, unrecognized Paddle charge, receipt, payment
        method, sales-tax exemption, or tax-refund question, contact Paddle at{" "}
        <a href="https://paddle.net">paddle.net</a>. For questions about Athreix
        access or plan delivery, email{" "}
        <a href="mailto:umerkhan@athreix.com">umerkhan@athreix.com</a>.
      </p>
    ),
  },
  {
    title: "Policy updates",
    body: (
      <p>
        We may update this policy as the Service, Paddle terms, or law changes.
        The version in effect at the time of a transaction applies unless
        mandatory law or Paddle’s buyer terms require otherwise. Updates will
        show a new effective date on this page.
      </p>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      summary="How Athreix customers can cancel subscriptions, report service problems, and request eligible refunds through Paddle."
      sections={sections}
    />
  );
}
