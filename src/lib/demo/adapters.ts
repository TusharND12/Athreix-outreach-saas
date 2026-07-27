import type {
  ExportRecord,
  Prospect,
  ResearchMode,
  SavedFolder,
  SearchRecord,
} from "./types";
import { compactLeadRecord, type LeadRecord } from "@/lib/leads/columns";

type ApiEvidence = {
  field?: string;
  provider?: string;
  sourceUrl?: string;
  observedAt?: string;
  confidence?: number;
};

export type ApiProspect = {
  id?: string;
  companyId?: string;
  mode?: "B2B" | "B2C";
  name?: string;
  title?: string;
  company?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  score?: number;
  status?: string;
  buyingIntent?: string;
  summary?: string;
  reasons?: string[];
  suggestedOffer?: string;
  decisionMakerConfidence?: number;
  recommendedChannel?: string;
  consentStatus?: string;
  evidence?: ApiEvidence[];
  leadFields?: LeadRecord;
  createdAt?: string;
};

function channel(value?: string): Prospect["channel"] {
  if (value === "LINKEDIN") return "LinkedIn";
  if (value === "PHONE") return "Phone";
  return "Email";
}

export function prospectFromApi(
  item: ApiProspect,
  fallbackMode: ResearchMode = "b2b",
): Prospect {
  const mode: ResearchMode =
    item.mode === "B2C" ? "b2c" : item.mode === "B2B" ? "b2b" : fallbackMode;
  const score = Math.max(0, Math.min(100, item.score ?? 0));
  const status: Prospect["status"] =
    item.status?.toLowerCase() === "verified"
      ? "Verified"
      : item.status?.toLowerCase() === "suppressed"
        ? "Limited"
        : "Review";
  const intent: Prospect["intent"] =
    item.buyingIntent === "HIGH"
      ? "High"
      : item.buyingIntent === "MEDIUM"
        ? "Medium"
        : "Low";
  const evidence =
    item.evidence?.map((source) => ({
      label: source.field?.replaceAll("_", " ") ?? "Source evidence",
      value: source.sourceUrl
        ? "Source record available for review"
        : "Provider evidence attached",
      source: source.provider ?? "Authorized provider",
      freshness: source.observedAt
        ? `Observed ${new Date(source.observedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
        : "Freshness unavailable",
      confidence: Math.round(
        (source.confidence ?? 0) <= 1
          ? (source.confidence ?? 0) * 100
          : (source.confidence ?? 0),
      ),
    })) ?? [];
  const rawName = item.name?.trim() || undefined;
  const name = rawName ?? "Unknown record";
  const nameParts = rawName?.split(/\s+/) ?? [];
  const leadFields =
    mode === "b2b"
      ? compactLeadRecord({
          ...item.leadFields,
          first_name: item.leadFields?.first_name ?? nameParts[0],
          last_name:
            item.leadFields?.last_name ??
            (nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined),
          full_name: item.leadFields?.full_name ?? rawName,
          job_title: item.leadFields?.job_title ?? item.title,
          company_name: item.leadFields?.company_name ?? item.company,
          industry: item.leadFields?.industry ?? item.industry,
          company_size: item.leadFields?.company_size ?? item.companySize,
          email: item.leadFields?.email ?? item.email,
          mobile_number: item.leadFields?.mobile_number ?? item.phone,
          linkedin: item.leadFields?.linkedin ?? item.linkedin,
          company_website: item.leadFields?.company_website ?? item.website,
        })
      : undefined;
  return {
    id: item.id ?? `api-${crypto.randomUUID()}`,
    companyId: item.companyId,
    mode,
    name,
    title:
      mode === "b2c"
        ? "Permissioned audience member"
        : (item.title ?? "Role not verified"),
    company:
      mode === "b2c"
        ? "Authorized audience source"
        : (item.company ?? "Company not available"),
    industry:
      item.industry ??
      (mode === "b2c" ? "Permissioned customer research" : "Not classified"),
    location: item.location ?? "Location not available",
    email: item.email ?? "Not available",
    phone: item.phone,
    linkedin: item.linkedin ?? "",
    website: item.website ?? "",
    score,
    status,
    intent,
    companySize: item.companySize ?? "Not available",
    decisionConfidence: Math.round(item.decisionMakerConfidence ?? score),
    channel: channel(item.recommendedChannel),
    summary:
      item.summary ?? "AI analysis is not available for this record yet.",
    reasons: item.reasons?.length
      ? item.reasons
      : ["Matches the confirmed search criteria"],
    offer:
      item.suggestedOffer ??
      (mode === "b2c"
        ? "A voluntary, purpose-appropriate invitation with a clear opt-out."
        : "A focused, relevant business introduction."),
    technologies: [],
    leadFields,
    evidence: evidence.length
      ? evidence
      : [
          {
            label: "Result provenance",
            value: "Source metadata retained by Athreix",
            source: "Search provider",
            freshness: "Check source record",
            confidence: 0,
          },
        ],
    consumer:
      mode === "b2c"
        ? {
            relationship: "Permissioned audience member",
            consentStatus:
              item.consentStatus === "GRANTED" ? "Confirmed" : "Review",
            source: evidence[0]?.source ?? "Authorized audience source",
            collectedAt:
              evidence[0]?.freshness.replace("Observed ", "") ??
              "See source record",
            retentionUntil: "See search retention policy",
            purpose: "Use only for the purpose documented on this search",
            suppressionChecked:
              status === "Limited"
                ? "Suppressed — do not contact"
                : "Checked during this search",
            allowedChannels: [],
            permissionExpires: "See consent record",
          }
        : undefined,
  };
}

type ApiSearch = {
  id?: string;
  query?: string;
  name?: string;
  mode?: "B2B" | "B2C";
  status?: string;
  resultCount?: number;
  chargedCredits?: number;
  createdAt?: string;
  createdBy?: { name?: string };
  _count?: { results?: number };
};

export function searchFromApi(item: ApiSearch): SearchRecord {
  const rawStatus = item.status?.toLowerCase();
  return {
    id: item.id ?? `search-${crypto.randomUUID()}`,
    query: item.query ?? item.name ?? "Untitled search",
    mode: item.mode === "B2C" ? "b2c" : "b2b",
    status:
      rawStatus === "complete"
        ? "complete"
        : rawStatus === "failed"
          ? "failed"
          : rawStatus === "queued"
            ? "queued"
            : "processing",
    count: item.resultCount ?? item._count?.results ?? item.chargedCredits ?? 0,
    highQuality: 0,
    createdAt: item.createdAt
      ? new Date(item.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Recently",
    owner: item.createdBy?.name ?? "Workspace",
  };
}

type ApiExport = {
  id?: string;
  searchId?: string;
  listId?: string;
  format?: "CSV" | "XLSX" | "JSON" | "PDF" | "CRM" | "AI_REPORT";
  status?: string;
  recordCount?: number;
  createdAt?: string;
};

export function exportFromApi(item: ApiExport): ExportRecord {
  return {
    id: item.id ?? `export-${crypto.randomUUID()}`,
    searchId: item.searchId,
    listId: item.listId,
    name: item.searchId
      ? `Search export · ${item.searchId.slice(0, 8)}`
      : item.listId
        ? `Saved list export · ${item.listId.slice(0, 8)}`
        : "Prospect export",
    format: item.format ?? "CSV",
    records: item.recordCount ?? 0,
    status:
      item.status === "READY"
        ? "Ready"
        : item.status === "EXPIRED"
          ? "Expired"
          : "Preparing",
    createdAt: item.createdAt
      ? new Date(item.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Recently",
    scope: "Authorized fields",
    createdBy: "Workspace",
  };
}

type ApiList = {
  id?: string;
  name?: string;
  description?: string | null;
  resultIds?: string[];
  updatedAt?: string;
  _count?: { items?: number };
};

export function listFromApi(item: ApiList): SavedFolder {
  const resultIds = item.resultIds ?? [];
  return {
    id: item.id ?? `list-${crypto.randomUUID()}`,
    name: item.name ?? "Untitled list",
    description: item.description ?? "Saved prospect list",
    count: item._count?.items ?? resultIds.length,
    updatedAt: item.updatedAt
      ? new Date(item.updatedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })
      : "Recently",
    shared: false,
    prospectIds: resultIds,
  };
}
