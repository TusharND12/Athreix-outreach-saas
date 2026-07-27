export type EvidenceItem = {
  id: string;
  label: string;
  excerpt: string;
  source: string;
  sourceUrl?: string;
  observedAt: string;
  confidence: number;
  reference: string;
};

export type IntelligenceScores = {
  overall: number;
  website: number;
  seo: number;
  accessibility: number;
  performance: number;
  branding: number;
  technology: number;
  businessGrowth: number;
  buyingIntent: number;
  digitalMaturity: number;
  decisionMakers: number;
  confidence: number;
};

export type CompanyIntelligence = {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  logoUrl?: string;
  screenshotUrl?: string;
  location?: string;
  industry?: string;
  categories: string[];
  employeeRange?: string;
  foundedYear?: number;
  description: string;
  lastResearchedAt: string;
  researchStatus: "ready" | "researching" | "partial";
  scores: IntelligenceScores;
  summary: {
    oneLiner: string;
    businessModel: string;
    products: string[];
    services: string[];
    targetCustomers: string[];
    strengths: string[];
    weaknesses: string[];
    technologyMaturity: number;
    aiReadiness: number;
    overallHealth: number;
  };
  websiteAnalysis: {
    analyzedPages: string[];
    scores: Omit<
      IntelligenceScores,
      | "overall"
      | "technology"
      | "businessGrowth"
      | "buyingIntent"
      | "digitalMaturity"
      | "decisionMakers"
      | "confidence"
    > & {
      ux: number;
      ui: number;
      content: number;
      responsiveness: number;
      callsToAction: number;
      trustSignals: number;
      forms: number;
      security: number;
    };
    issues: Array<{
      title: string;
      severity: "low" | "medium" | "high" | "critical";
      businessImpact: string;
      evidenceRefs: string[];
      confidence: number;
    }>;
    recommendations: Array<{
      title: string;
      outcome: string;
      evidenceRefs: string[];
    }>;
    opportunities: string[];
    missingFeatures: string[];
  };
  technologies: Array<{
    name: string;
    category: string;
    version?: string;
    confidence: number;
    evidenceRefs: string[];
  }>;
  contacts: {
    email?: string;
    phone?: string;
    address?: string;
    socialLinks: Array<{ label: string; url: string }>;
  };
  reviews: {
    rating?: number;
    count?: number;
    themes: string[];
    confidence: number;
  };
  buyingSignals: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    strength: "weak" | "moderate" | "strong";
    observedAt: string;
    confidence: number;
    evidenceRefs: string[];
  }>;
  painPoints: Array<{
    id: string;
    category: string;
    title: string;
    problem: string;
    businessImpact: string;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
    evidenceRefs: string[];
  }>;
  decisionMakers: Array<{
    id: string;
    name: string;
    role: string;
    publicProfile?: string;
    email?: string;
    confidence: number;
    reasonToContact: string;
    evidenceRefs: string[];
  }>;
  salesStrategy: {
    whyValuable: string;
    bestApproach: string;
    recommendedServices: string[];
    channelPlan: Array<{
      channel: string;
      angle: string;
      priority: number;
      evidenceRefs: string[];
    }>;
    whyItWillWork: string;
    risks: string[];
  };
  recommendations: Array<{
    title: string;
    detail: string;
    impact: "low" | "medium" | "high";
    evidenceRefs: string[];
  }>;
  timeline: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    occurredAt: string;
    confidence: number;
    evidenceRefs: string[];
  }>;
  outreach: {
    coldEmail: { subject: string; body: string };
    linkedinMessage: string;
    followUpEmail: { subject: string; body: string };
    meetingInvitation: string;
    websiteAudit: string;
    proposal: string;
  };
  evidence: EvidenceItem[];
  industryInsights: {
    overview: string;
    growth: string;
    competition: string;
    technologyAdoption: string;
    digitalMaturity: number;
    buyingTrends: string[];
    salesOpportunities: string[];
  };
};

export type CompanyChatAnswer = {
  answer: string;
  evidenceRefs: string[];
  confidence: number;
  followUpQuestions: string[];
};
