import type { z } from "zod";
import type { createSearchSchema } from "@/server/schemas";
import { AppError } from "@/lib/server/errors";
import type { LawfulBasis } from "@prisma/client";
import type { NormalizedB2CProspect } from "@/server/normalize";

type SearchInput = z.infer<typeof createSearchSchema>;

const sensitivePatterns: Array<[RegExp, string]> = [
  [/\b(race|racial|ethnicity|ethnic origin|caste)\b/i, "race or ethnicity"],
  [/\b(religion|religious belief|faith)\b/i, "religion or belief"],
  [
    /\b(sexual orientation|gay|lesbian|bisexual|transgender)\b/i,
    "sexual orientation or gender identity",
  ],
  [
    /\b(health condition|medical condition|diagnosis|disability|pregnan(t|cy))\b/i,
    "health data",
  ],
  [/\b(political opinion|political affiliation|voter)\b/i, "political opinion"],
  [
    /\b(biometric|facial recognition|fingerprint|genetic)\b/i,
    "biometric or genetic data",
  ],
  [/\b(trade union|union member)\b/i, "trade-union membership"],
  [/\b(criminal record|conviction|offender)\b/i, "criminal-history data"],
  [
    /\b(financial hardship|credit score|bank balance)\b/i,
    "highly sensitive financial data",
  ],
];

const minorPattern =
  /\b(?:child(?:ren)?|kids?|teen(?:s|agers?)?|minors?|under\s*18|school ?age|age[sd]?\s*(?:[0-9]|1[0-7]))\b/i;
const prohibitedMessagingPattern =
  /\b(blast|mass message|bulk message|spam|scrape and email everyone|unsolicited campaign)\b/i;

export function inspectTargeting(input: SearchInput) {
  // Inspect the complete validated request, not only the headline query.
  // Purpose, name, retention rationale, free-text filters, and other supporting
  // fields reach downstream providers or describe the intended campaign and
  // therefore cannot be allowed to bypass targeting policy.
  const text = JSON.stringify(input);
  const sensitive = sensitivePatterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label);
  return {
    sensitive: [...new Set(sensitive)],
    targetsMinors: minorPattern.test(text),
    suggestsMassMessaging: prohibitedMessagingPattern.test(text),
  };
}

function sensitiveCategoriesInText(text: string) {
  return sensitivePatterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label);
}

export function assertSearchCompliant(input: SearchInput) {
  const inspection = inspectTargeting(input);
  if (inspection.suggestsMassMessaging) {
    throw new AppError(
      "PROHIBITED_USE",
      "Athreix cannot be used to prepare unsolicited mass messaging. Narrow the research to relevant records and review each outreach draft manually.",
      422,
    );
  }
  if (inspection.sensitive.length) {
    throw new AppError(
      "SENSITIVE_TARGETING_BLOCKED",
      "Prospect searches may not target sensitive or special-category traits.",
      422,
      { categories: inspection.sensitive },
    );
  }

  if (input.mode === "B2C") {
    if (!input.purpose || input.purpose.trim().length < 10) {
      throw new AppError(
        "PURPOSE_REQUIRED",
        "Consumer research requires a specific, documented purpose.",
        422,
      );
    }
    if (!input.lawfulBasis) {
      throw new AppError(
        "LAWFUL_BASIS_REQUIRED",
        "Select and document the lawful basis for this consumer-data use.",
        422,
      );
    }
    if (input.lawfulBasis !== "CONSENT") {
      throw new AppError(
        "CONSENT_REQUIRED",
        "The live consumer MVP accepts only current, purpose-specific consent as its lawful basis.",
        422,
      );
    }
    if (
      !input.audienceSource ||
      !input.audienceSourceReference ||
      !input.jurisdiction
    ) {
      throw new AppError(
        "B2C_SOURCE_CONTEXT_REQUIRED",
        "Consumer research requires a first-party or permissioned-partner source and a documented jurisdiction.",
        422,
      );
    }
    if (!input.attestations) {
      throw new AppError(
        "ATTESTATIONS_REQUIRED",
        "Confirm authority, adult-only and non-sensitive targeting, current suppression controls, and draft-only outreach.",
        422,
      );
    }
    if ((input.retentionDays ?? 30) > 90) {
      throw new AppError(
        "RETENTION_TOO_LONG",
        "Consumer prospect retention cannot exceed 90 days.",
        422,
      );
    }
    if ((input.retentionDays ?? 30) > 30 && !input.retentionJustification) {
      throw new AppError(
        "RETENTION_JUSTIFICATION_REQUIRED",
        "Explain why this consumer campaign needs more than 30 days of retention.",
        422,
      );
    }
    if (inspection.targetsMinors) {
      throw new AppError(
        "MINOR_TARGETING_BLOCKED",
        "Consumer searches may not target children or people under 18.",
        422,
      );
    }
  }

  return {
    retentionDays: input.retentionDays ?? (input.mode === "B2C" ? 30 : 90),
    notice:
      "Athreix records your declared purpose and controls; you remain responsible for confirming that collection, processing, outreach, and export are lawful for your context.",
  };
}

export function screenConsumerRecord(item: NormalizedB2CProspect) {
  const allowedAdultBands = new Set([
    "18-24",
    "25-34",
    "35-44",
    "45-54",
    "55-64",
    "65+",
  ]);
  if (!item.consumer.ageBand || !allowedAdultBands.has(item.consumer.ageBand)) {
    return { eligible: false as const, reason: "minor_or_ambiguous_age_band" };
  }
  const categories = sensitiveCategoriesInText(
    [
      item.consumer.ageBand,
      item.consumer.location,
      ...item.consumer.interests,
    ].join(" "),
  );
  if (categories.length) {
    return {
      eligible: false as const,
      reason: "sensitive_category_signal",
      categories: [...new Set(categories)],
    };
  }
  return { eligible: true as const };
}

export function evaluateConsumerPermission(
  item: NormalizedB2CProspect,
  lawfulBasis: LawfulBasis | null,
  now = new Date(),
) {
  if (lawfulBasis !== "CONSENT") {
    return {
      status:
        item.consumer.consentStatus === "DENIED" ||
        item.consumer.consentStatus === "WITHDRAWN"
          ? item.consumer.consentStatus
          : ("NOT_REQUIRED" as const),
      channels: [] as NormalizedB2CProspect["consumer"]["consentChannels"],
      proofValid: false,
    };
  }
  const capturedAt = item.consumer.consentCapturedAt
    ? new Date(item.consumer.consentCapturedAt)
    : null;
  const expiresAt = item.consumer.consentExpiresAt
    ? new Date(item.consumer.consentExpiresAt)
    : null;
  const dateValid = Boolean(
    capturedAt &&
    Number.isFinite(capturedAt.getTime()) &&
    capturedAt <= now &&
    capturedAt >= new Date(now.getTime() - 2 * 365 * 86_400_000),
  );
  const expiryValid = Boolean(
    expiresAt &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt > now &&
    (!capturedAt || expiresAt > capturedAt),
  );
  const sourcePermissioned =
    item.provenance.sourceType === "DEMO" ||
    Boolean(
      item.provenance.permissionReview?.approved &&
      item.provenance.permissionReview.permissions?.some((permission) =>
        ["first_party_data", "permissioned_consumer_data"].includes(
          permission.toLowerCase(),
        ),
      ),
    );
  const proofValid = Boolean(
    item.consumer.consentStatus === "GRANTED" &&
    item.consumer.consentChannels.length &&
    item.consumer.consentProofReference &&
    item.consumer.consentSource &&
    dateValid &&
    expiryValid &&
    sourcePermissioned,
  );
  return {
    status: proofValid
      ? ("GRANTED" as const)
      : item.consumer.consentStatus === "DENIED" ||
          item.consumer.consentStatus === "WITHDRAWN"
        ? item.consumer.consentStatus
        : ("UNKNOWN" as const),
    channels: proofValid ? item.consumer.consentChannels : [],
    proofValid,
    capturedAt: proofValid ? capturedAt! : undefined,
    expiresAt: proofValid ? expiresAt! : undefined,
    proof: proofValid
      ? {
          reference: item.consumer.consentProofReference!,
          source: item.consumer.consentSource!,
          actorId: item.provenance.actorId,
          actorCreator: item.provenance.actorCreator,
        }
      : undefined,
  };
}

export function assertManualOutreach(input: {
  manualIntent: boolean;
  isSuppressed: boolean;
}) {
  if (!input.manualIntent) {
    throw new AppError(
      "MANUAL_REVIEW_REQUIRED",
      "Confirm manual, per-record outreach review.",
      422,
    );
  }
  if (input.isSuppressed) {
    throw new AppError(
      "SUPPRESSED",
      "This record is suppressed and cannot be used for outreach.",
      409,
    );
  }
}
