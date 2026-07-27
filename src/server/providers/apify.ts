import { actorReviewAllows, approvedB2CSource, env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import {
  compactLeadRecord,
  type LeadRecord,
  type LeadRecordValue,
} from "@/lib/leads/columns";
import type {
  ProspectProvider,
  ProviderSearchInput,
  RawProspect,
} from "@/server/providers/types";
import { enrichCompaniesWithApifyResearch } from "@/server/providers/apify-research";

function actorReview(actorId: string) {
  return env.actorReviews.find((review) => review.actorId === actorId);
}

export function apifyRunDisposition(status: string) {
  if (status === "SUCCEEDED") return "READ" as const;
  if (status === "READY" || status === "RUNNING") return "ABORT" as const;
  return "REJECT" as const;
}

export const COMPASS_GOOGLE_MAPS_ACTOR =
  "compass/google-maps-extractor" as const;
export const CODE_CRAFTER_LEADS_ACTOR = "code_crafter/leads-finder" as const;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(source: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
}

function scalar(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
): LeadRecordValue | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
}

function listText(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const normalized = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
      if (normalized.length) return normalized.join(", ");
    }
  }
}

function joinedText(values: unknown[]) {
  const joined = values
    .filter(
      (value): value is string | number =>
        (typeof value === "string" && Boolean(value.trim())) ||
        (typeof value === "number" && Number.isFinite(value)),
    )
    .join(", ");
  return joined || undefined;
}

function numeric(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
}

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function actorChoice(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

const actorCountryLocations = new Set(
  `
united states
germany
india
united kingdom
russia
france
china
canada
netherlands
mexico
belgium
japan
brazil
australia
poland
thailand
sweden
portugal
spain
czech republic
taiwan
south africa
colombia
italy
vietnam
nigeria
singapore
hong kong
ireland
israel
switzerland
turkey
romania
south korea
indonesia
united arab emirates
saudi arabia
austria
philippines
peru
malaysia
argentina
ukraine
ghana
denmark
norway
finland
puerto rico
qatar
macau
new zealand
hungary
luxembourg
kuwait
egypt
slovakia
greece
kenya
bulgaria
costa rica
chile
venezuela
afghanistan
bangladesh
malta
guatemala
pakistan
lithuania
panama
morocco
uruguay
serbia
bolivia
angola
dominican republic
ecuador
oman
jamaica
zambia
lebanon
tanzania
jordan
algeria
gibraltar
paraguay
cambodia
uganda
mozambique
ethiopia
belarus
croatia
jersey
iraq
isle of man
el salvador
estonia
latvia
côte d'ivoire
tunisia
sierra leone
senegal
sri lanka
cyprus
kazakhstan
guernsey
bermuda
mali
honduras
bahrain
slovenia
papua new guinea
iceland
mauritius
iran
niger
rwanda
moldova
democratic republic of the congo
liechtenstein
fiji
kyrgyzstan
azerbaijan
madagascar
trinidad and tobago
lesotho
nicaragua
cameroon
barbados
armenia
haiti
maldives
guam
laos
nepal
brunei
reunion
macedonia (fyrom)
swaziland
liberia
uzbekistan
sudan
anguilla
cuba
cayman islands
seychelles
saint kitts and nevis
suriname
bosnia and herzegovina
malawi
the bahamas
botswana
syria
burundi
guadeloupe
namibia
burkina faso
somalia
greenland
equatorial guinea
chad
monaco
republic of the congo
u.s. virgin islands
mayotte
french polynesia
french guiana
andorra
new caledonia
central african republic
myanmar (burma)
belize
aland islands
solomon islands
kosovo
gabon
benin
bonaire, sint eustatius and saba
martinique
tonga
south sudan
cook islands
georgia
mauritania
turkmenistan
libya
falkland islands (islas malvinas)
bhutan
tajikistan
northern mariana islands
western sahara
guyana
dominica
vanuatu
kiribati
togo
nauru
samoa
mongolia
myanmar
yemen
albania
montenegro
`
    .trim()
    .split("\n"),
);

const actorLocationAliases = new Map<string, string>([
  ["us", "united states"],
  ["u.s.", "united states"],
  ["usa", "united states"],
  ["u.s.a.", "united states"],
  ["united states of america", "united states"],
  ["america", "united states"],
  ["uk", "united kingdom"],
  ["u.k.", "united kingdom"],
  ["great britain", "united kingdom"],
  ["uae", "united arab emirates"],
  ["u.a.e.", "united arab emirates"],
  ["czechia", "czech republic"],
  ["ivory coast", "côte d'ivoire"],
  ["bahamas", "the bahamas"],
  ["korea", "south korea"],
  ["republic of korea", "south korea"],
  ["viet nam", "vietnam"],
  ["russian federation", "russia"],
]);

function partitionActorLocations(values: string[]) {
  const regions: string[] = [];
  const cities: string[] = [];
  for (const value of values) {
    const normalized = actorChoice(value);
    if (!normalized) continue;
    const aliased = actorLocationAliases.get(normalized) ?? normalized;
    (actorCountryLocations.has(aliased) ? regions : cities).push(aliased);
  }
  return {
    regions: Array.from(new Set(regions)),
    cities: Array.from(new Set(cities)),
  };
}

const actorIndustryAliases = new Map<string, string[]>([
  ["saas", ["computer software"]],
  ["software", ["computer software"]],
  ["software startup", ["computer software"]],
  ["computer software", ["computer software"]],
  ["architecture", ["architecture & planning"]],
  ["architecture & planning", ["architecture & planning"]],
  ["manufacturing", ["mechanical or industrial engineering", "machinery"]],
  ["manufacturer", ["mechanical or industrial engineering", "machinery"]],
  ["industrial", ["mechanical or industrial engineering"]],
  [
    "mechanical or industrial engineering",
    ["mechanical or industrial engineering"],
  ],
  ["machinery", ["machinery"]],
  ["construction", ["construction"]],
  ["agency", ["marketing & advertising"]],
  ["marketing & advertising", ["marketing & advertising"]],
  ["healthcare", ["hospital & health care"]],
  ["health care", ["hospital & health care"]],
  ["hospital & health care", ["hospital & health care"]],
  ["retail", ["retail"]],
  ["fintech", ["financial services"]],
  ["financial services", ["financial services"]],
  ["e-commerce", ["internet", "retail"]],
  ["ecommerce", ["internet", "retail"]],
  ["internet", ["internet"]],
  ["mining & metals", ["mining & metals"]],
  ["building materials", ["building materials"]],
]);

function partitionActorIndustries(values: string[]) {
  const industries: string[] = [];
  const keywords: string[] = [];
  for (const value of values) {
    const normalized = actorChoice(value);
    const mapped = actorIndustryAliases.get(normalized);
    if (mapped) industries.push(...mapped);
    else if (normalized) keywords.push(normalized);
  }
  return {
    industries: Array.from(new Set(industries)),
    keywords: Array.from(new Set(keywords)),
  };
}

const actorFundingAliases = new Map<string, string | null>([
  ["pre-seed", "seed"],
  ["pre seed", "seed"],
  ["seed", "seed"],
  ["seed round", "seed"],
  ["angel", "angel"],
  ["angel round", "angel"],
  ["series a", "series_a"],
  ["series b", "series_b"],
  ["series c", "series_c"],
  ["series c+", "series_c"],
  ["series d", "series_d"],
  ["series e", "series_e"],
  ["series f", "series_f"],
  ["venture round", "venture_round"],
  ["debt financing", "debt_financing"],
  ["convertible note", "convertible_note"],
  ["private equity", "private_equity_round"],
  ["private equity round", "private_equity_round"],
  ["other", "other_round"],
  ["other round", "other_round"],
  ["bootstrapped", null],
  ["self-funded", null],
]);

function partitionActorFunding(values: string[]) {
  const funding: string[] = [];
  const keywords: string[] = [];
  for (const value of values) {
    const normalized = actorChoice(value).replace(/[\s_]+/g, " ");
    const mapped = actorFundingAliases.get(normalized);
    if (mapped) funding.push(mapped);
    else if (normalized) keywords.push(normalized);
  }
  return {
    funding: Array.from(new Set(funding)),
    keywords: Array.from(new Set(keywords)),
  };
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export function apifyActorInput(actorId: string, input: ProviderSearchInput) {
  if (actorId === CODE_CRAFTER_LEADS_ACTOR) {
    const jobTitles = stringList(input.filters.jobTitles);
    const includedLocationParts = partitionActorLocations([
      ...stringList(input.filters.locations),
      ...[text(input.filters, "state"), text(input.filters, "country")].filter(
        (value): value is string => Boolean(value),
      ),
    ]);
    const excludedLocationParts = partitionActorLocations(
      stringList(input.filters.excludedLocations),
    );
    const explicitCity = text(input.filters, "city");
    const cities = Array.from(
      new Set([
        ...(explicitCity ? [actorChoice(explicitCity)] : []),
        ...includedLocationParts.cities,
      ]),
    );
    const actorIndustries = partitionActorIndustries(
      stringList(input.filters.industries),
    );
    const actorFunding = partitionActorFunding(
      stringList(input.filters.fundingStages),
    );
    const companyKeywords = Array.from(
      new Set([
        ...actorIndustries.keywords,
        ...actorFunding.keywords,
        ...stringList(input.filters.keywords),
        ...stringList(input.filters.technologies),
        ...stringList(input.filters.websiteKeywords),
      ]),
    );
    return compact({
      // The Actor defaults to 100,000. Always send an explicit bounded value.
      fetch_count: Math.min(input.targetCount, 1_000),
      file_name: "Athreix prospects",
      contact_job_title: jobTitles.length ? jobTitles : [input.query],
      contact_city: cities.length ? cities : undefined,
      contact_location:
        cities.length || !includedLocationParts.regions.length
          ? undefined
          : includedLocationParts.regions,
      contact_not_city: excludedLocationParts.cities.length
        ? excludedLocationParts.cities
        : undefined,
      contact_not_location: excludedLocationParts.cities.length
        ? undefined
        : excludedLocationParts.regions.length
          ? excludedLocationParts.regions
          : undefined,
      email_status:
        input.filters.hasEmail === true
          ? ["validated"]
          : ["validated", "not_validated", "unknown"],
      company_industry: actorIndustries.industries.length
        ? actorIndustries.industries
        : undefined,
      company_keywords: companyKeywords.length ? companyKeywords : undefined,
      funding: actorFunding.funding.length ? actorFunding.funding : undefined,
    });
  }

  if (actorId !== COMPASS_GOOGLE_MAPS_ACTOR) {
    return {
      query: input.query,
      filters: input.filters,
      maxItems: input.targetCount,
      purpose: input.purpose,
      lawfulBasis: input.lawfulBasis,
      audienceSource: input.audienceSource,
      audienceSourceReference: input.audienceSourceReference,
      jurisdiction: input.jurisdiction,
    };
  }

  const locations = stringList(input.filters.locations);
  const configuredLocation =
    text(input.filters, "city", "state", "country") ?? locations[0];
  return compact({
    searchStringsArray: [input.query],
    locationQuery: configuredLocation,
    maxCrawledPlacesPerSearch: Math.min(input.targetCount, 100),
    language: "en",
    website: "withWebsite",
    skipClosedPlaces: true,
    scrapePlaceDetailPage: false,
    scrapeContacts: true,
    maximumLeadsEnrichmentRecords: 1,
    verifyLeadsEnrichmentEmails: input.filters.hasEmail === true,
  });
}

function completeLeadRecord(
  place: Record<string, unknown>,
  lead: Record<string, unknown>,
): LeadRecord {
  const firstName = text(lead, "first_name", "firstName");
  const lastName = text(lead, "last_name", "lastName");
  const fullName =
    text(lead, "full_name", "fullName", "name") ??
    [firstName, lastName].filter(Boolean).join(" ");
  return compactLeadRecord({
    first_name: firstName,
    last_name: lastName,
    email: text(lead, "email", "workEmail", "work_email"),
    personal_email: text(lead, "personal_email", "personalEmail"),
    mobile_number: text(
      lead,
      "mobile_number",
      "mobileNumber",
      "phoneNumber",
      "firstPhone",
      "phone",
    ),
    full_name: fullName,
    job_title: text(lead, "job_title", "jobTitle", "title"),
    linkedin: text(
      lead,
      "linkedin",
      "linkedinUrl",
      "linkedinProfile",
      "linkedinProfileUrl",
    ),
    company_name:
      text(lead, "company_name", "companyName") ?? text(place, "title", "name"),
    company_website:
      text(lead, "company_website", "companyWebsite", "website") ??
      text(place, "website"),
    industry:
      text(lead, "industry", "companyIndustry") ?? text(place, "categoryName"),
    company_size: scalar(
      lead,
      "company_size",
      "companySize",
      "companyEmployees",
      "companyEmployeeCount",
      "employees",
    ),
    headline: text(lead, "headline"),
    seniority_level: text(
      lead,
      "seniority_level",
      "seniorityLevel",
      "seniority",
    ),
    functional_level: text(
      lead,
      "functional_level",
      "functionalLevel",
      "department",
    ),
    city: text(lead, "city"),
    state: text(lead, "state"),
    country: text(lead, "country"),
    company_linkedin: text(
      lead,
      "company_linkedin",
      "companyLinkedin",
      "companyLinkedinUrl",
    ),
    company_linkedin_uid: scalar(
      lead,
      "company_linkedin_uid",
      "companyLinkedinUid",
      "companyLinkedinId",
    ),
    company_founded_year: scalar(
      lead,
      "company_founded_year",
      "companyFoundedYear",
      "foundedYear",
    ),
    company_domain: text(lead, "company_domain", "companyDomain", "domain"),
    company_phone:
      text(lead, "company_phone", "companyPhone") ??
      text(place, "phone", "phoneUnformatted"),
    company_street_address: text(
      lead,
      "company_street_address",
      "companyStreetAddress",
    ),
    company_full_address:
      text(lead, "company_full_address", "companyFullAddress") ??
      text(place, "address"),
    company_state: text(lead, "company_state", "companyState"),
    company_city:
      text(lead, "company_city", "companyCity") ?? text(place, "city"),
    company_country:
      text(lead, "company_country", "companyCountry") ??
      text(place, "countryCode"),
    company_postal_code: scalar(
      lead,
      "company_postal_code",
      "companyPostalCode",
      "companyZip",
    ),
    keywords:
      listText(lead, "keywords", "companyKeywords") ??
      listText(place, "categories"),
    company_description:
      text(lead, "company_description", "companyDescription") ??
      text(place, "description"),
    company_annual_revenue: scalar(
      lead,
      "company_annual_revenue",
      "companyAnnualRevenue",
      "annualRevenue",
      "revenue",
    ),
    company_annual_revenue_clean: scalar(
      lead,
      "company_annual_revenue_clean",
      "companyAnnualRevenueClean",
    ),
    company_total_funding: scalar(
      lead,
      "company_total_funding",
      "companyTotalFunding",
      "totalFunding",
    ),
    company_total_funding_clean: scalar(
      lead,
      "company_total_funding_clean",
      "companyTotalFundingClean",
    ),
    company_technologies: listText(
      lead,
      "company_technologies",
      "companyTechnologies",
      "technologies",
      "techStack",
    ),
  });
}

function codeCrafterLead(item: Record<string, unknown>): RawProspect | null {
  const leadFields = completeLeadRecord(item, item);
  const fullName = String(leadFields.full_name ?? "").trim();
  const companyName = String(leadFields.company_name ?? "").trim();
  if (!fullName || !companyName) return null;
  const companySize = leadFields.company_size;
  const companyWebsite =
    typeof leadFields.company_website === "string"
      ? leadFields.company_website
      : undefined;
  const linkedin =
    typeof leadFields.linkedin === "string" ? leadFields.linkedin : undefined;
  return compact({
    companyName,
    domain:
      typeof leadFields.company_domain === "string"
        ? leadFields.company_domain
        : undefined,
    website: companyWebsite,
    companyLinkedinUrl:
      typeof leadFields.company_linkedin === "string"
        ? leadFields.company_linkedin
        : undefined,
    companyDescription:
      typeof leadFields.company_description === "string"
        ? leadFields.company_description
        : undefined,
    industry:
      typeof leadFields.industry === "string" ? leadFields.industry : undefined,
    companyCity:
      typeof leadFields.company_city === "string"
        ? leadFields.company_city
        : undefined,
    companyCountry:
      typeof leadFields.company_country === "string"
        ? leadFields.company_country
        : undefined,
    companyLocation:
      typeof leadFields.company_full_address === "string"
        ? leadFields.company_full_address
        : joinedText([
            leadFields.company_city,
            leadFields.company_state,
            leadFields.company_country,
          ]),
    employeeCount:
      typeof companySize === "number"
        ? companySize
        : numeric(item, "company_size", "companySize"),
    employeeRange: typeof companySize === "string" ? companySize : undefined,
    revenueRange:
      leadFields.company_annual_revenue === undefined
        ? undefined
        : String(leadFields.company_annual_revenue),
    foundedYear: numeric(item, "company_founded_year", "companyFoundedYear"),
    technologies: stringList(leadFields.company_technologies).slice(0, 50),
    // Keep the actor's complete string in leadFields while bounding the
    // canonical analysis list at the normalization trust boundary.
    keywords: stringList(leadFields.keywords).slice(0, 50),
    contactName: fullName,
    firstName:
      typeof leadFields.first_name === "string"
        ? leadFields.first_name
        : undefined,
    lastName:
      typeof leadFields.last_name === "string"
        ? leadFields.last_name
        : undefined,
    title:
      typeof leadFields.job_title === "string"
        ? leadFields.job_title
        : undefined,
    seniority:
      typeof leadFields.seniority_level === "string"
        ? leadFields.seniority_level
        : undefined,
    contactLocation: joinedText([
      leadFields.city,
      leadFields.state,
      leadFields.country,
    ]),
    contactCountry:
      typeof leadFields.country === "string" ? leadFields.country : undefined,
    email: typeof leadFields.email === "string" ? leadFields.email : undefined,
    phone:
      typeof leadFields.mobile_number === "string"
        ? leadFields.mobile_number
        : undefined,
    linkedinUrl: linkedin,
    sourceUrl: linkedin ?? companyWebsite,
    _athreixLeadFields: leadFields,
  });
}

function compassLead(
  place: Record<string, unknown>,
  lead: Record<string, unknown>,
): RawProspect | null {
  const firstName = text(lead, "firstName", "first_name");
  const lastName = text(lead, "lastName", "last_name");
  const fullName =
    text(lead, "fullName", "full_name", "name") ??
    [firstName, lastName].filter(Boolean).join(" ");
  if (!fullName) return null;

  const website =
    text(lead, "companyWebsite", "company_website", "website") ??
    text(place, "website");
  const companySize = lead.companySize ?? lead.company_size;
  const companyEmployeeCount =
    numeric(lead, "companyEmployees", "companyEmployeeCount", "employees") ??
    (typeof companySize === "number" ? companySize : undefined);
  const companyEmployeeRange =
    typeof companySize === "string" ? companySize : undefined;
  const companyRevenue = numeric(
    lead,
    "companyAnnualRevenue",
    "annualRevenue",
    "revenue",
  );
  const leadFields = completeLeadRecord(place, lead);

  return compact({
    companyName:
      text(lead, "companyName", "company_name") ?? text(place, "title", "name"),
    domain: text(lead, "companyDomain", "company_domain"),
    website,
    companyLinkedinUrl: text(
      lead,
      "companyLinkedinUrl",
      "companyLinkedin",
      "company_linkedin",
    ),
    companyDescription: text(place, "description"),
    industry:
      text(lead, "companyIndustry", "industry") ?? text(place, "categoryName"),
    companyCity:
      text(lead, "companyCity", "company_city") ?? text(place, "city"),
    companyCountry:
      text(lead, "companyCountry", "company_country", "country") ??
      text(place, "countryCode"),
    companyLocation:
      text(lead, "companyLocation", "company_location") ??
      text(place, "address"),
    employeeCount: companyEmployeeCount,
    employeeRange: companyEmployeeRange,
    revenueRange:
      companyRevenue === undefined
        ? undefined
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(companyRevenue),
    foundedYear: numeric(lead, "companyFoundedYear", "foundedYear"),
    keywords: stringList(place.categories),
    fundingStage: text(
      lead,
      "companyLatestFunding",
      "latestFunding",
      "fundingStage",
    ),
    contactName: fullName,
    firstName,
    lastName,
    title: text(lead, "jobTitle", "title", "headline"),
    seniority: text(lead, "seniority"),
    contactLocation:
      text(lead, "location") ??
      joinedText([
        text(lead, "city"),
        text(lead, "state"),
        text(lead, "country"),
      ]),
    contactCountry: text(lead, "country"),
    email: text(lead, "email", "workEmail", "work_email"),
    phone:
      text(lead, "mobileNumber", "phoneNumber", "firstPhone", "phone") ??
      text(place, "phone", "phoneUnformatted"),
    linkedinUrl: text(
      lead,
      "linkedinUrl",
      "linkedinProfile",
      "linkedinProfileUrl",
      "linkedin",
    ),
    sourceUrl:
      text(lead, "linkedinUrl", "linkedinProfile", "linkedinProfileUrl") ??
      website ??
      text(place, "url"),
    _athreixLeadFields: leadFields,
  });
}

export function adaptApifyDatasetItems(actorId: string, items: RawProspect[]) {
  if (actorId === CODE_CRAFTER_LEADS_ACTOR) {
    return items.flatMap((rawItem) => {
      const item = record(rawItem);
      if (!item) return [];
      const adapted = codeCrafterLead(item);
      return adapted ? [adapted] : [];
    });
  }
  if (actorId !== COMPASS_GOOGLE_MAPS_ACTOR) return items;
  return items.flatMap((rawItem) => {
    const place = record(rawItem);
    if (!place) return [];
    const nestedLeads = Array.isArray(place.leadsEnrichment)
      ? place.leadsEnrichment
          .map(record)
          .filter((item): item is Record<string, unknown> => item !== undefined)
      : [];
    const leads =
      nestedLeads.length || !text(place, "fullName", "firstName", "lastName")
        ? nestedLeads
        : [place];
    return leads.flatMap((lead) => {
      const adapted = compassLead(place, lead);
      return adapted ? [adapted] : [];
    });
  });
}

type ApifyRunRecord = {
  id: string;
  status: string;
  defaultDatasetId?: string | null;
  startedAt?: string | Date;
  finishedAt?: string | Date;
};

const apifyApiBase = "https://api.apify.com/v2";

export function apifyPublicErrorMessage(message: string) {
  if (
    /Input is not valid:\s*Field input\.(?:contact_location|contact_not_location)/i.test(
      message,
    )
  ) {
    return "A location filter could not be understood. Enter cities, states, or countries separately (for example: Pune, India).";
  }
  if (/Input is not valid:\s*Field input\.company_industry/i.test(message)) {
    return "An industry filter is not supported by the live data provider. Use a broader industry or add the phrase as a company keyword.";
  }
  if (/Input is not valid:/i.test(message)) {
    return "One search filter is not supported by the live data provider. Adjust the highlighted search criteria and try again.";
  }
  return message.length > 500
    ? "The live data provider rejected the request. Adjust the search criteria and try again."
    : message;
}

async function apifyApi<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  if (!env.APIFY_TOKEN) {
    throw new AppError(
      "APIFY_NOT_CONFIGURED",
      "The prospect data provider is not configured.",
      503,
    );
  }
  const { timeoutMs = 30_000, headers, ...requestInit } = init;
  const response = await fetch(`${apifyApiBase}${path}`, {
    ...requestInit,
    headers: {
      authorization: `Bearer ${env.APIFY_TOKEN}`,
      accept: "application/json",
      ...(requestInit.body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    let message = `Apify API request failed with ${response.status}.`;
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      message = apifyPublicErrorMessage(payload.error?.message ?? message);
    } catch {
      // Keep the status-only message when the provider has no JSON body.
    }
    throw new AppError(
      response.status === 402
        ? "APIFY_ACCOUNT_LIMIT"
        : response.status === 429
          ? "APIFY_RATE_LIMITED"
          : "APIFY_API_ERROR",
      message,
      response.status === 402 ? 402 : response.status === 429 ? 503 : 502,
    );
  }
  return (await response.json()) as T;
}

async function deleteApifyArtifact(path: string) {
  if (!env.APIFY_TOKEN) return false;
  try {
    const response = await fetch(`${apifyApiBase}${path}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${env.APIFY_TOKEN}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function cleanupApifyRun(run: ApifyRunRecord) {
  const [datasetRemoved, runRemoved] = await Promise.all([
    run.defaultDatasetId
      ? deleteApifyArtifact(
          `/datasets/${encodeURIComponent(run.defaultDatasetId)}`,
        )
      : Promise.resolve(true),
    deleteApifyArtifact(`/actor-runs/${encodeURIComponent(run.id)}`),
  ]);
  return datasetRemoved && runRemoved;
}

async function getApifyRun(runId: string) {
  return (
    await apifyApi<{ data: ApifyRunRecord }>(
      `/actor-runs/${encodeURIComponent(runId)}`,
    )
  ).data;
}

async function waitForApifyRun(initialRun: ApifyRunRecord, deadline: number) {
  let run = initialRun;
  while (apifyRunDisposition(run.status) === "ABORT" && Date.now() < deadline) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(2_000, Math.max(0, deadline - Date.now()))),
    );
    run = await getApifyRun(run.id);
  }
  return run;
}

export class ApifyProspectProvider implements ProspectProvider {
  constructor() {
    if (!env.APIFY_TOKEN) {
      throw new AppError(
        "APIFY_NOT_CONFIGURED",
        "The prospect data provider is not configured.",
        503,
      );
    }
  }

  async search(input: ProviderSearchInput) {
    const actorId =
      input.mode === "B2C" ? env.APIFY_B2C_ACTOR_ID : env.APIFY_B2B_ACTOR_ID;
    if (!actorId || !env.actorAllowlist.has(actorId)) {
      throw new AppError(
        "ACTOR_NOT_APPROVED",
        "No allowlisted actor is configured for this research mode.",
        503,
      );
    }
    const review = actorReview(actorId);
    if (
      !review ||
      !actorReviewAllows(review, {
        mode: input.mode,
        jurisdiction: input.jurisdiction,
        termsVersion: env.APIFY_TERMS_VERSION,
      })
    ) {
      throw new AppError(
        "ACTOR_REVIEW_REQUIRED",
        "This actor requires a documented creator, permission, and data-use review before it can run.",
        503,
      );
    }
    const requiredB2CPermission =
      input.audienceSource === "FIRST_PARTY_UPLOAD"
        ? "first_party_data"
        : "permissioned_consumer_data";
    const sourceApproval =
      input.mode === "B2C"
        ? approvedB2CSource(env.approvedB2CSources, {
            reference: input.audienceSourceReference,
            audienceSource: input.audienceSource,
            actorId,
            workspaceId: input.workspaceId,
            jurisdiction: input.jurisdiction,
            termsVersion: env.APIFY_TERMS_VERSION,
          })
        : undefined;
    if (
      input.mode === "B2C" &&
      (input.lawfulBasis !== "CONSENT" ||
        !input.audienceSourceReference ||
        !review.creator ||
        !review.permissions.some(
          (permission) => permission.toLowerCase() === requiredB2CPermission,
        ) ||
        !sourceApproval)
    ) {
      throw new AppError(
        "B2C_ACTOR_NOT_PERMISSIONED",
        "Consumer actors must have a documented creator and an approved first-party or permissioned-data scope.",
        503,
      );
    }

    const readSucceededDataset = async (inputDataset: {
      runId: string;
      datasetId: string;
      collectedAt: string;
    }) => {
      const dataset = await apifyApi<RawProspect[]>(
        `/datasets/${encodeURIComponent(
          inputDataset.datasetId,
        )}/items?clean=true&limit=${input.targetCount}`,
      );
      const adaptedItems = adaptApifyDatasetItems(actorId, dataset);
      let items = adaptedItems;
      if (env.researchActors.length) {
        const { ApifyClient } = await import("apify-client");
        items = await enrichCompaniesWithApifyResearch(
          new ApifyClient({ token: env.APIFY_TOKEN }),
          adaptedItems,
          input,
        );
      }
      return {
        items,
        provenance: {
          sourceType: "APIFY" as const,
          provider: "apify",
          actorId,
          actorCreator: review.creator,
          permissionReview: {
            approved: review.approved,
            reviewedAt: review.reviewedAt,
            expiresAt: review.expiresAt,
            termsVersion: review.termsVersion,
            reviewVersion: review.reviewVersion,
            modes: review.modes,
            jurisdictions: review.jurisdictions,
            permissions: review.permissions,
            sourceReference: sourceApproval?.reference,
          },
          datasetId: inputDataset.datasetId,
          runId: inputDataset.runId,
          collectedAt: inputDataset.collectedAt,
        },
      };
    };

    if (input.checkpoint?.provider === "apify") {
      try {
        const checkpointRun = await getApifyRun(input.checkpoint.runId);
        if (
          checkpointRun &&
          apifyRunDisposition(checkpointRun.status) === "READ" &&
          checkpointRun.defaultDatasetId === input.checkpoint.datasetId
        ) {
          return await readSucceededDataset({
            runId: checkpointRun.id,
            datasetId: input.checkpoint.datasetId,
            collectedAt: new Date(
              checkpointRun.finishedAt ?? checkpointRun.startedAt ?? Date.now(),
            ).toISOString(),
          });
        }
      } catch (error) {
        console.warn(
          "Apify checkpoint could not be reused; starting a reviewed run",
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }

    const deadline = Date.now() + review.timeoutSecs * 1_000;
    const actorPath = actorId.replace("/", "~");
    const runOptions = new URLSearchParams({
      waitForFinish: String(Math.min(review.timeoutSecs, 300)),
      timeout: String(review.timeoutSecs),
      memory: String(review.maxMemoryMbytes),
      maxItems: String(input.targetCount),
      maxTotalChargeUsd: String(review.maxTotalChargeUsd),
      restartOnError: "false",
    });
    const started = await apifyApi<{ data: ApifyRunRecord }>(
      `/acts/${encodeURIComponent(actorPath)}/runs?${runOptions}`,
      {
        method: "POST",
        body: JSON.stringify(apifyActorInput(actorId, input)),
        timeoutMs: (Math.min(review.timeoutSecs, 300) + 15) * 1_000,
      },
    );
    const run = await waitForApifyRun(started.data, deadline);
    const disposition = apifyRunDisposition(run.status);
    if (disposition === "ABORT") {
      try {
        await apifyApi(
          `/actor-runs/${encodeURIComponent(run.id)}/abort?gracefully=false`,
          { method: "POST" },
        );
      } catch {
        // The run may have reached a terminal state between polling and abort.
      }
      if (!(await cleanupApifyRun(run))) {
        console.warn("Timed-out Apify run cleanup was incomplete", run.id);
      }
      throw new AppError(
        "PROVIDER_TIMEOUT",
        "The data provider did not finish within its approved runtime and was stopped. The search will retry.",
        504,
      );
    }
    if (disposition === "REJECT") {
      if (!(await cleanupApifyRun(run))) {
        console.warn("Failed Apify run cleanup was incomplete", run.id);
      }
      throw new AppError(
        "PROVIDER_RUN_FAILED",
        `The data provider finished with status ${run.status}.`,
        502,
      );
    }
    if (!run.defaultDatasetId) {
      await cleanupApifyRun(run);
      throw new AppError(
        "PROVIDER_EMPTY",
        "The data provider did not return a dataset.",
        502,
      );
    }
    return readSucceededDataset({
      runId: run.id,
      datasetId: run.defaultDatasetId,
      collectedAt: new Date().toISOString(),
    });
  }
}
