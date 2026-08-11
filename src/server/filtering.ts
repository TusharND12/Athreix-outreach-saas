import type { NormalizedProspect } from "@/server/normalize";

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalized(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsAny(value: string | undefined, requested: string[]) {
  const haystack = normalized(value);
  return Boolean(
    haystack &&
    requested.some((item) => {
      const needle = normalized(item);
      return needle && haystack.includes(needle);
    }),
  );
}

// Match the broad operator-facing labels that are translated into provider
// taxonomies before a run. Post-filtering must use the same semantics or a
// provider-approved record can be rejected solely because its label differs.
const industryAliases = new Map<string, string[]>([
  ["saas", ["computer software"]],
  ["software", ["computer software"]],
  ["software startup", ["computer software"]],
  ["architecture", ["architecture & planning"]],
  ["manufacturing", ["mechanical or industrial engineering", "machinery"]],
  ["manufacturer", ["mechanical or industrial engineering", "machinery"]],
  ["industrial", ["mechanical or industrial engineering"]],
  ["agency", ["marketing & advertising"]],
  ["healthcare", ["hospital & health care", "health care"]],
  ["health care", ["hospital & health care"]],
  ["fintech", ["financial services"]],
  ["e commerce", ["internet", "retail"]],
  ["ecommerce", ["internet", "retail"]],
]);

function containsIndustry(value: string | undefined, requested: string[]) {
  return requested.some((item) => {
    const key = normalized(item);
    return containsAny(value, [item, ...(industryAliases.get(key) ?? [])]);
  });
}

function exact(value: string | undefined, requested: unknown) {
  return (
    typeof requested === "string" && normalized(value) === normalized(requested)
  );
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function rangeNumbers(value?: string) {
  if (!value) return null;
  const values = [...value.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*([kmb])?/gi)].map(
    (match) => {
      const amount = Number(match[1]);
      const multiplier =
        match[2]?.toLowerCase() === "b"
          ? 1_000_000_000
          : match[2]?.toLowerCase() === "m"
            ? 1_000_000
            : match[2]?.toLowerCase() === "k"
              ? 1_000
              : 1;
      return amount * multiplier;
    },
  );
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function explicitTextRatio(actual: string[], requested: string[]) {
  if (!requested.length) return null;
  const haystack = normalized(actual.join(" "));
  if (!haystack) return 0;
  return (
    requested.filter((item) => haystack.includes(normalized(item))).length /
    requested.length
  );
}

export function structuredFilterDecision(
  item: NormalizedProspect,
  filters: Record<string, unknown>,
) {
  const reasons: string[] = [];
  const locations = strings(filters.locations);
  const excludedLocations = strings(filters.excludedLocations);
  const industries = strings(filters.industries);
  const jobTitles = strings(filters.jobTitles);
  const keywords = strings(filters.keywords);
  const technologies = strings(filters.technologies);
  const fundingStages = strings(filters.fundingStages);
  const websiteKeywords = strings(filters.websiteKeywords);
  const linkedinKeywords = strings(filters.linkedinKeywords);
  const interests = strings(filters.interests);

  if (item.mode === "B2C") {
    const location = [
      item.consumer.location,
      item.consumer.city,
      item.consumer.country,
    ].join(" ");
    if (locations.length && !containsAny(location, locations))
      reasons.push("location");
    if (filters.country && !exact(item.consumer.country, filters.country))
      reasons.push("country");
    if (filters.city && !exact(item.consumer.city, filters.city))
      reasons.push("city");
    if (filters.state && !containsAny(location, [String(filters.state)]))
      reasons.push("state");
    if (filters.ageBand && !exact(item.consumer.ageBand, filters.ageBand))
      reasons.push("age_band");
    if (
      interests.length &&
      explicitTextRatio(item.consumer.interests, interests) === 0
    ) {
      reasons.push("interests");
    }
    if (
      industries.length ||
      jobTitles.length ||
      technologies.length ||
      fundingStages.length ||
      excludedLocations.length ||
      numeric(filters.employeeMin) !== undefined ||
      numeric(filters.employeeMax) !== undefined ||
      numeric(filters.revenueMin) !== undefined ||
      numeric(filters.revenueMax) !== undefined ||
      numeric(filters.foundedAfter) !== undefined ||
      numeric(filters.foundedBefore) !== undefined ||
      typeof filters.isHiring === "boolean" ||
      typeof filters.hasEmail === "boolean" ||
      typeof filters.hasWebsite === "boolean"
    ) {
      reasons.push("unsupported_consumer_filter");
    }
    return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
  }

  const companyLocation = [
    item.company.location,
    item.company.city,
    item.company.country,
    item.contact.location,
    item.contact.country,
  ].join(" ");
  const companyText = [
    item.company.name,
    item.company.industry,
    item.company.description,
    ...item.company.keywords,
  ].join(" ");
  if (industries.length && !containsIndustry(item.company.industry, industries))
    reasons.push("industry");
  if (locations.length && !containsAny(companyLocation, locations))
    reasons.push("location");
  if (
    excludedLocations.length &&
    containsAny(companyLocation, excludedLocations)
  )
    reasons.push("excluded_location");
  if (
    filters.country &&
    !exact(item.company.country ?? item.contact.country, filters.country)
  )
    reasons.push("country");
  if (filters.city && !exact(item.company.city, filters.city))
    reasons.push("city");
  if (filters.state && !containsAny(companyLocation, [String(filters.state)]))
    reasons.push("state");

  const employeeMin = numeric(filters.employeeMin);
  const employeeMax = numeric(filters.employeeMax);
  const employeeRange =
    item.company.employeeCount !== undefined
      ? { min: item.company.employeeCount, max: item.company.employeeCount }
      : rangeNumbers(item.company.employeeRange);
  if (
    (employeeMin !== undefined || employeeMax !== undefined) &&
    (!employeeRange ||
      (employeeMin !== undefined && employeeRange.max < employeeMin) ||
      (employeeMax !== undefined && employeeRange.min > employeeMax))
  )
    reasons.push("employee_count");

  const revenueMin = numeric(filters.revenueMin);
  const revenueMax = numeric(filters.revenueMax);
  const revenueRange = rangeNumbers(item.company.revenueRange);
  if (
    (revenueMin !== undefined || revenueMax !== undefined) &&
    (!revenueRange ||
      (revenueMin !== undefined && revenueRange.max < revenueMin) ||
      (revenueMax !== undefined && revenueRange.min > revenueMax))
  )
    reasons.push("revenue");

  const foundedAfter = numeric(filters.foundedAfter);
  const foundedBefore = numeric(filters.foundedBefore);
  if (
    (foundedAfter !== undefined || foundedBefore !== undefined) &&
    (item.company.foundedYear === undefined ||
      (foundedAfter !== undefined &&
        item.company.foundedYear <= foundedAfter) ||
      (foundedBefore !== undefined &&
        item.company.foundedYear >= foundedBefore))
  )
    reasons.push("founded_year");
  if (jobTitles.length && !containsAny(item.contact.title, jobTitles))
    reasons.push("job_title");
  if (
    typeof filters.hasEmail === "boolean" &&
    Boolean(item.contact.email) !== filters.hasEmail
  )
    reasons.push("email_availability");
  if (
    typeof filters.hasWebsite === "boolean" &&
    Boolean(item.company.website) !== filters.hasWebsite
  )
    reasons.push("website_availability");
  if (keywords.length && !containsAny(companyText, keywords))
    reasons.push("keywords");
  if (
    technologies.length &&
    explicitTextRatio(item.company.technologies, technologies) === 0
  )
    reasons.push("technologies");
  if (
    fundingStages.length &&
    !containsAny(item.company.fundingStage, fundingStages)
  )
    reasons.push("funding_stage");
  // The product exposes hiring as a positive-only toggle. `false` means that
  // no hiring constraint was requested; only `true` is a hard requirement.
  if (filters.isHiring === true && item.company.isHiring !== true)
    reasons.push("hiring");
  if (websiteKeywords.length && !containsAny(companyText, websiteKeywords))
    reasons.push("website_keywords");
  if (linkedinKeywords.length && !containsAny(companyText, linkedinKeywords))
    reasons.push("linkedin_keywords");
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function explicitFilterRatios(
  item: NormalizedProspect,
  filters: Record<string, unknown>,
) {
  if (item.mode === "B2C") {
    return {
      interests: explicitTextRatio(
        item.consumer.interests,
        strings(filters.interests),
      ),
      location: strings(filters.locations).length
        ? containsAny(item.consumer.location, strings(filters.locations))
          ? 1
          : 0
        : null,
      industry: null,
      technologies: null,
      keywords: null,
      title: null,
    };
  }
  return {
    interests: null,
    industry: industriesRatio(
      item.company.industry,
      strings(filters.industries),
    ),
    technologies: explicitTextRatio(
      item.company.technologies,
      strings(filters.technologies),
    ),
    keywords: explicitTextRatio(
      [item.company.description ?? "", ...item.company.keywords],
      strings(filters.keywords),
    ),
    title: industriesRatio(item.contact.title, strings(filters.jobTitles)),
    location: strings(filters.locations).length
      ? containsAny(item.company.location, strings(filters.locations))
        ? 1
        : 0
      : null,
  };
}

function industriesRatio(value: string | undefined, requested: string[]) {
  return explicitTextRatio(value ? [value] : [], requested);
}
