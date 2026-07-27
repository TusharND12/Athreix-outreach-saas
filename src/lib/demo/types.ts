import type { LeadRecord } from "@/lib/leads/columns";

export type ResearchMode = "b2b" | "b2c";

export type SearchStatus = "processing" | "complete" | "failed" | "queued";

export type Prospect = {
  id: string;
  companyId?: string;
  mode: ResearchMode;
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  email: string;
  phone?: string;
  linkedin: string;
  website: string;
  score: number;
  status: "Verified" | "Review" | "Limited";
  intent: "High" | "Medium" | "Low";
  companySize: string;
  decisionConfidence: number;
  channel: "Email" | "LinkedIn" | "Phone";
  summary: string;
  reasons: string[];
  offer: string;
  technologies: string[];
  leadFields?: LeadRecord;
  evidence: Array<{
    label: string;
    value: string;
    source: string;
    freshness: string;
    confidence: number;
  }>;
  consumer?: {
    relationship: string;
    consentStatus: "Confirmed" | "Review";
    source: string;
    collectedAt: string;
    retentionUntil: string;
    purpose: string;
    suppressionChecked: string;
    allowedChannels: Array<"Email" | "LinkedIn" | "Phone" | "WhatsApp">;
    permissionExpires: string;
  };
};

export type SearchRecord = {
  id: string;
  query: string;
  mode: ResearchMode;
  status: SearchStatus;
  count: number;
  highQuality: number;
  createdAt: string;
  owner: string;
};

export type ExportRecord = {
  id: string;
  searchId?: string;
  listId?: string;
  name: string;
  format: "CSV" | "XLSX" | "JSON" | "PDF" | "CRM" | "AI_REPORT";
  records: number;
  status: "Ready" | "Preparing" | "Expired";
  createdAt: string;
  scope: string;
  createdBy: string;
};

export type SavedFolder = {
  id: string;
  name: string;
  description: string;
  count: number;
  updatedAt: string;
  shared: boolean;
  prospectIds: string[];
};
