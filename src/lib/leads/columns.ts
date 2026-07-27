export const LEAD_COLUMN_DEFINITIONS = [
  { key: "first_name", label: "First name", width: 150 },
  { key: "last_name", label: "Last name", width: 150 },
  { key: "email", label: "Email", width: 280 },
  { key: "personal_email", label: "Personal email", width: 280 },
  { key: "mobile_number", label: "Mobile number", width: 170 },
  { key: "full_name", label: "Full name", width: 200 },
  { key: "job_title", label: "Job title", width: 220 },
  { key: "linkedin", label: "LinkedIn", width: 240 },
  { key: "company_name", label: "Company name", width: 220 },
  { key: "company_website", label: "Company website", width: 220 },
  { key: "industry", label: "Industry", width: 200 },
  { key: "company_size", label: "Company size", width: 150 },
  { key: "headline", label: "Headline", width: 280 },
  { key: "seniority_level", label: "Seniority level", width: 170 },
  { key: "functional_level", label: "Functional level", width: 180 },
  { key: "city", label: "City", width: 160 },
  { key: "state", label: "State", width: 170 },
  { key: "country", label: "Country", width: 170 },
  { key: "company_linkedin", label: "Company LinkedIn", width: 240 },
  {
    key: "company_linkedin_uid",
    label: "Company LinkedIn UID",
    width: 190,
  },
  { key: "company_founded_year", label: "Company founded year", width: 190 },
  { key: "company_domain", label: "Company domain", width: 200 },
  { key: "company_phone", label: "Company phone", width: 170 },
  {
    key: "company_street_address",
    label: "Company street address",
    width: 260,
  },
  {
    key: "company_full_address",
    label: "Company full address",
    width: 300,
  },
  { key: "company_state", label: "Company state", width: 170 },
  { key: "company_city", label: "Company city", width: 170 },
  { key: "company_country", label: "Company country", width: 180 },
  {
    key: "company_postal_code",
    label: "Company postal code",
    width: 190,
  },
  { key: "keywords", label: "Keywords", width: 260 },
  {
    key: "company_description",
    label: "Company description",
    width: 340,
  },
  {
    key: "company_annual_revenue",
    label: "Company annual revenue",
    width: 210,
  },
  {
    key: "company_annual_revenue_clean",
    label: "Company annual revenue clean",
    width: 250,
  },
  {
    key: "company_total_funding",
    label: "Company total funding",
    width: 210,
  },
  {
    key: "company_total_funding_clean",
    label: "Company total funding clean",
    width: 250,
  },
  {
    key: "company_technologies",
    label: "Company technologies",
    width: 300,
  },
] as const;

export type LeadColumnKey = (typeof LEAD_COLUMN_DEFINITIONS)[number]["key"];
export type LeadRecordValue = string | number | null;
export type LeadRecord = Partial<Record<LeadColumnKey, LeadRecordValue>>;

export const LEAD_COLUMN_GROUPS = [
  {
    label: "Person and role",
    keys: [
      "first_name",
      "last_name",
      "full_name",
      "job_title",
      "headline",
      "seniority_level",
      "functional_level",
    ],
  },
  {
    label: "Contact and location",
    keys: [
      "email",
      "personal_email",
      "mobile_number",
      "linkedin",
      "city",
      "state",
      "country",
    ],
  },
  {
    label: "Company",
    keys: [
      "company_name",
      "company_website",
      "industry",
      "company_size",
      "company_linkedin",
      "company_linkedin_uid",
      "company_founded_year",
      "company_domain",
      "company_phone",
    ],
  },
  {
    label: "Company location",
    keys: [
      "company_street_address",
      "company_full_address",
      "company_state",
      "company_city",
      "company_country",
      "company_postal_code",
    ],
  },
  {
    label: "Company intelligence",
    keys: [
      "keywords",
      "company_description",
      "company_annual_revenue",
      "company_annual_revenue_clean",
      "company_total_funding",
      "company_total_funding_clean",
      "company_technologies",
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  keys: readonly LeadColumnKey[];
}>;

export const LEAD_COLUMN_KEYS = LEAD_COLUMN_DEFINITIONS.map(
  (column) => column.key,
) as LeadColumnKey[];

export const SENSITIVE_LEAD_COLUMN_KEYS = [
  "email",
  "personal_email",
  "mobile_number",
] as const satisfies readonly LeadColumnKey[];

const leadColumnSet = new Set<string>(LEAD_COLUMN_KEYS);

export function displayLeadValue(value: LeadRecordValue | undefined): string {
  return value === undefined || value === null || value === ""
    ? "null"
    : String(value);
}

export function isMaskedContactValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/[\u2022*]/.test(value) || /\u00e2(?:\u0080|\u20ac)\u00a2/.test(value))
  );
}

export function compactLeadRecord(
  input: Record<string, unknown> | null | undefined,
): LeadRecord {
  if (!input) return {};
  const output: LeadRecord = {};
  for (const [key, value] of Object.entries(input)) {
    if (!leadColumnSet.has(key)) continue;
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) output[key as LeadColumnKey] = normalized;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      output[key as LeadColumnKey] = value;
    }
  }
  return output;
}

export function leadRecordWithoutSensitiveValues(
  record: LeadRecord | undefined,
) {
  if (!record) return {};
  const sensitive = new Set<string>(SENSITIVE_LEAD_COLUMN_KEYS);
  return compactLeadRecord(
    Object.fromEntries(
      Object.entries(record).filter(([key]) => !sensitive.has(key)),
    ),
  );
}
