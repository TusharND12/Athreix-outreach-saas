export type RawProspect = Record<string, unknown>;

export type SourceProvenance = {
  sourceType: "APIFY" | "DEMO";
  provider: string;
  actorId?: string;
  actorCreator?: string;
  permissionReview?: {
    approved: boolean;
    reviewedAt?: string;
    expiresAt?: string;
    termsVersion?: string;
    reviewVersion?: string;
    modes?: Array<"B2B" | "B2C">;
    jurisdictions?: string[];
    permissions?: string[];
    sourceReference?: string;
  };
  datasetId?: string;
  runId?: string;
  sourceUrl?: string;
  collectedAt: string;
};

export type ProviderSearchInput = {
  workspaceId: string;
  mode: "B2B" | "B2C";
  query: string;
  purpose: string;
  lawfulBasis?: string;
  audienceSource?: "FIRST_PARTY_UPLOAD" | "PERMISSIONED_PARTNER";
  audienceSourceReference?: string;
  jurisdiction?: string;
  filters: Record<string, unknown>;
  targetCount: number;
  checkpoint?: {
    provider: "apify";
    runId: string;
    datasetId: string;
  };
};

export type ProviderResult = {
  items: RawProspect[];
  provenance: SourceProvenance;
};

export interface ProspectProvider {
  search(input: ProviderSearchInput): Promise<ProviderResult>;
}
