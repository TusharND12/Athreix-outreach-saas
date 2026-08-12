export const DEFAULT_PRIVACY_NOTICE_VERSION = "2026-08-11";

export const PRIVACY_CONSENT_DATA = [
  {
    id: "identity_and_account",
    label: "Identity and account data",
    description: "name, work email, authentication and session identifiers",
  },
  {
    id: "service_activity",
    label: "Service activity",
    description:
      "search instructions, saved lists, exports, usage and security logs",
  },
  {
    id: "billing_references",
    label: "Billing references",
    description:
      "Paddle customer, subscription and transaction status if you buy a plan",
  },
] as const;

export const PRIVACY_CONSENT_PURPOSES = [
  "create_or_access_account",
  "authenticate_and_secure_workspace",
  "provide_requested_research_list_and_export_features",
  "manage_credits_subscriptions_and_support",
] as const;
