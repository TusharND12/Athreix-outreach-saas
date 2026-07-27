import { prospects } from "@/lib/demo/data";
import type { CompanyIntelligence } from "@/lib/intelligence/types";

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildDemoCompanyIntelligence(
  id = prospects[0]?.id ?? "prospect-1",
): CompanyIntelligence {
  const prospect =
    prospects.find(
      (item) =>
        item.id === id ||
        item.company.toLowerCase().replace(/[^a-z0-9]+/g, "-") === id,
    ) ?? prospects[0];
  if (!prospect) throw new Error("Demo intelligence fixture is unavailable");
  const index = Math.max(
    0,
    prospects.findIndex((item) => item.id === prospect.id),
  );
  const domain = prospect.website.replace(/^https?:\/\//, "");
  const base = bounded(84 - (index % 4) * 3);
  const evidence = [
    {
      id: "ev-website-home",
      label: "Homepage experience",
      excerpt:
        "The primary page uses a large visual hero but the main conversion action appears below the initial viewport on mobile.",
      source: "Apify website crawl · Homepage",
      sourceUrl: prospect.website,
      observedAt: "2026-07-24T08:42:00.000Z",
      confidence: 94,
      reference: "website/home#primary-cta",
    },
    {
      id: "ev-careers-growth",
      label: "Hiring activity",
      excerpt:
        "Open roles include customer success, revenue operations, and two engineering positions.",
      source: "Apify website crawl · Careers",
      sourceUrl: `${prospect.website}/careers`,
      observedAt: "2026-07-23T10:18:00.000Z",
      confidence: 96,
      reference: "careers/open-roles",
    },
    {
      id: "ev-tech-stack",
      label: "Public technology signals",
      excerpt: `Detected ${prospect.technologies.join(", ")} across public page assets and response headers.`,
      source: "Apify technology scan",
      sourceUrl: prospect.website,
      observedAt: "2026-07-24T08:44:00.000Z",
      confidence: 89,
      reference: "technology/public-assets",
    },
    {
      id: "ev-news-launch",
      label: "Recent company announcement",
      excerpt:
        "The company announced a new enterprise workflow and an expansion into two additional Indian markets.",
      source: "Apify Google News research",
      sourceUrl: `${prospect.website}/news/enterprise-workflow`,
      observedAt: "2026-07-18T09:30:00.000Z",
      confidence: 86,
      reference: "news/enterprise-workflow",
    },
    {
      id: "ev-about-model",
      label: "Business model",
      excerpt:
        "The company sells a recurring software subscription with implementation support for mid-market teams.",
      source: "Apify website crawl · About",
      sourceUrl: `${prospect.website}/about`,
      observedAt: "2026-07-24T08:43:00.000Z",
      confidence: 91,
      reference: "about/business-model",
    },
    {
      id: "ev-reviews",
      label: "Customer review themes",
      excerpt:
        "Public reviews praise implementation support while repeatedly mentioning onboarding complexity.",
      source: "Apify public reviews research",
      sourceUrl: `${prospect.website}/reviews`,
      observedAt: "2026-07-20T07:14:00.000Z",
      confidence: 78,
      reference: "reviews/theme-summary",
    },
  ];
  const firstName = prospect.name.split(" ")[0];

  return {
    id: prospect.id,
    name: prospect.company,
    domain,
    website: prospect.website,
    location: prospect.location,
    industry: prospect.industry,
    categories: [
      prospect.industry,
      "B2B",
      index % 2 ? "Growth stage" : "AI-enabled",
    ],
    employeeRange: prospect.companySize,
    foundedYear: 2018 + (index % 5),
    description: `${prospect.company} is a ${prospect.industry.toLowerCase()} company serving growth-stage teams with a recurring software and services model.`,
    lastResearchedAt: "2026-07-24T08:46:00.000Z",
    researchStatus: "ready",
    scores: {
      overall: prospect.score,
      website: base,
      seo: bounded(base - 12),
      accessibility: bounded(base - 17),
      performance: bounded(base - 9),
      branding: bounded(base - 5),
      technology: bounded(base + 3),
      businessGrowth: 91,
      buyingIntent: prospect.intent === "High" ? 92 : 76,
      digitalMaturity: bounded(base - 2),
      decisionMakers: prospect.decisionConfidence,
      confidence: 91,
    },
    summary: {
      oneLiner: `${prospect.company} helps mid-market teams modernize a core operational workflow through software and implementation support.`,
      businessModel:
        "Recurring B2B software subscription with onboarding and implementation services.",
      products: [
        "Workflow intelligence platform",
        "Operational analytics",
        "Team collaboration workspace",
      ],
      services: ["Implementation", "Workflow design", "Customer enablement"],
      targetCustomers: [
        "Mid-market operations teams",
        "Revenue leaders",
        "Digital-first service businesses",
      ],
      strengths: [
        "Clear vertical expertise",
        "Strong implementation support",
        "Visible hiring momentum",
      ],
      weaknesses: [
        "Onboarding complexity appears in public reviews",
        "Website conversion path is not consistently clear",
      ],
      technologyMaturity: bounded(base + 3),
      aiReadiness: 88,
      overallHealth: 89,
    },
    websiteAnalysis: {
      analyzedPages: [
        prospect.website,
        `${prospect.website}/about`,
        `${prospect.website}/services`,
        `${prospect.website}/careers`,
        `${prospect.website}/contact`,
      ],
      scores: {
        website: base,
        seo: bounded(base - 12),
        accessibility: bounded(base - 17),
        performance: bounded(base - 9),
        branding: bounded(base - 5),
        ux: bounded(base - 4),
        ui: bounded(base - 2),
        content: bounded(base - 7),
        responsiveness: bounded(base - 8),
        callsToAction: bounded(base - 18),
        trustSignals: bounded(base - 3),
        forms: bounded(base - 15),
        security: 94,
      },
      issues: [
        {
          title: "Primary CTA loses prominence on mobile",
          severity: "high",
          businessImpact:
            "High-intent visitors may not reach the demo or contact path quickly.",
          evidenceRefs: ["ev-website-home"],
          confidence: 93,
        },
        {
          title: "Accessibility coverage is incomplete",
          severity: "high",
          businessImpact:
            "Keyboard and screen-reader friction can reduce reach and introduce enterprise procurement risk.",
          evidenceRefs: ["ev-website-home"],
          confidence: 88,
        },
        {
          title: "SEO structure under-describes service intent",
          severity: "medium",
          businessImpact:
            "The site may miss qualified non-brand search demand.",
          evidenceRefs: ["ev-website-home", "ev-about-model"],
          confidence: 84,
        },
        {
          title: "No conversational qualification path detected",
          severity: "medium",
          businessImpact:
            "Visitors with complex questions have no guided route before booking.",
          evidenceRefs: ["ev-website-home"],
          confidence: 82,
        },
      ],
      recommendations: [
        {
          title: "Rebuild the mobile conversion hierarchy",
          outcome: "Make the primary commercial action visible and measurable.",
          evidenceRefs: ["ev-website-home"],
        },
        {
          title: "Add an evidence-backed interactive product story",
          outcome:
            "Connect product capabilities to customer outcomes and buying triggers.",
          evidenceRefs: ["ev-about-model", "ev-news-launch"],
        },
        {
          title: "Create an accessibility and technical SEO baseline",
          outcome:
            "Reduce procurement friction and expand qualified organic reach.",
          evidenceRefs: ["ev-website-home"],
        },
      ],
      opportunities: [
        "Premium website redesign",
        "AI-guided lead qualification",
        "Lifecycle CRM automation",
        "Technical SEO programme",
      ],
      missingFeatures: [
        "Conversational assistant",
        "Role-specific landing pages",
        "Interactive ROI proof",
        "Accessible form feedback",
      ],
    },
    technologies: prospect.technologies.map((name, technologyIndex) => ({
      name,
      category:
        technologyIndex === 0
          ? "Framework"
          : technologyIndex === 1
            ? "Analytics"
            : "Cloud",
      confidence: 93 - technologyIndex * 3,
      evidenceRefs: ["ev-tech-stack"],
    })),
    contacts: {
      email: `hello@${domain}`,
      phone: "+91 ••••• ••418",
      address: prospect.location,
      socialLinks: [
        { label: "LinkedIn", url: prospect.linkedin },
        { label: "Website", url: prospect.website },
      ],
    },
    reviews: {
      rating: 4.2,
      count: 87 + index * 4,
      themes: [
        "Responsive implementation team",
        "Strong workflow fit",
        "Onboarding can feel complex",
      ],
      confidence: 78,
    },
    buyingSignals: [
      {
        id: `${prospect.id}-signal-hiring`,
        type: "Hiring",
        title: "Revenue and customer success hiring",
        detail:
          "Open roles point to an active go-to-market and customer expansion programme.",
        strength: "strong",
        observedAt: "2026-07-23T10:18:00.000Z",
        confidence: 94,
        evidenceRefs: ["ev-careers-growth"],
      },
      {
        id: `${prospect.id}-signal-expansion`,
        type: "Expansion",
        title: "New market expansion announced",
        detail:
          "A new enterprise workflow and two-market expansion create implementation and positioning needs.",
        strength: "strong",
        observedAt: "2026-07-18T09:30:00.000Z",
        confidence: 86,
        evidenceRefs: ["ev-news-launch"],
      },
      {
        id: `${prospect.id}-signal-website`,
        type: "Digital",
        title: "Website trails current product maturity",
        detail:
          "The public experience does not fully communicate the newer enterprise positioning.",
        strength: "moderate",
        observedAt: "2026-07-24T08:42:00.000Z",
        confidence: 88,
        evidenceRefs: ["ev-website-home", "ev-news-launch"],
      },
    ],
    painPoints: [
      {
        id: "pain-conversion",
        category: "Conversion",
        title: "Weak mobile conversion hierarchy",
        problem:
          "The initial mobile viewport does not establish a single clear commercial next step.",
        businessImpact:
          "Qualified visitors may leave before reaching a demo or contact action.",
        severity: "high",
        confidence: 93,
        evidenceRefs: ["ev-website-home"],
      },
      {
        id: "pain-onboarding",
        category: "Customer experience",
        title: "Onboarding complexity",
        problem:
          "Public review themes suggest customers need more guided implementation support.",
        businessImpact:
          "Longer time-to-value can increase service load and expansion risk.",
        severity: "medium",
        confidence: 78,
        evidenceRefs: ["ev-reviews"],
      },
      {
        id: "pain-automation",
        category: "Automation",
        title: "No guided website qualification",
        problem:
          "Visitors with complex requirements must self-navigate or submit a generic form.",
        businessImpact:
          "Sales receives less structured context and higher qualification overhead.",
        severity: "medium",
        confidence: 82,
        evidenceRefs: ["ev-website-home"],
      },
    ],
    decisionMakers: [
      {
        id: prospect.id,
        name: prospect.name,
        role: prospect.title,
        publicProfile: prospect.linkedin,
        email: prospect.email,
        confidence: prospect.decisionConfidence,
        reasonToContact:
          "Owns a function directly connected to the observed growth and digital conversion opportunity.",
        evidenceRefs: ["ev-careers-growth", "ev-news-launch"],
      },
      {
        id: `${prospect.id}-cto`,
        name: `Neel ${prospect.name.split(" ").at(-1)}`,
        role: "Chief Technology Officer",
        publicProfile: `${prospect.linkedin}-technology`,
        confidence: 84,
        reasonToContact:
          "Likely sponsor for platform integration, accessibility, and automation architecture.",
        evidenceRefs: ["ev-tech-stack"],
      },
      {
        id: `${prospect.id}-marketing`,
        name: `Ira ${prospect.name.split(" ").at(-1)}`,
        role: "Director of Marketing",
        publicProfile: `${prospect.linkedin}-marketing`,
        confidence: 79,
        reasonToContact:
          "Likely owner of the website positioning and demand-generation conversion path.",
        evidenceRefs: ["ev-website-home", "ev-news-launch"],
      },
    ],
    salesStrategy: {
      whyValuable:
        "The company shows credible growth while its public conversion experience lags the maturity of its product and market expansion.",
      bestApproach:
        "Lead with a concise mobile conversion observation, connect it to the expansion announcement, and offer a narrow evidence-backed audit rather than a broad redesign pitch.",
      recommendedServices: [
        "Conversion-focused website redesign",
        "AI qualification assistant",
        "CRM and lifecycle automation",
        "Accessibility and technical SEO remediation",
      ],
      channelPlan: [
        {
          channel: "Email",
          angle: "Share two verified conversion findings and a one-page audit.",
          priority: 1,
          evidenceRefs: ["ev-website-home", "ev-news-launch"],
        },
        {
          channel: "LinkedIn",
          angle:
            "Congratulate the specific expansion and ask one relevant workflow question.",
          priority: 2,
          evidenceRefs: ["ev-news-launch"],
        },
        {
          channel: "Website proposal",
          angle:
            "Map the new enterprise positioning to a clearer mobile conversion journey.",
          priority: 3,
          evidenceRefs: ["ev-website-home", "ev-news-launch"],
        },
      ],
      whyItWillWork:
        "The recommendation is timely, specific to public evidence, and small enough to review without committing to a large project.",
      risks: [
        "The website may already be under active redesign.",
        "Public hiring does not prove an approved services budget.",
      ],
    },
    recommendations: [
      {
        title: "Offer a 20-minute evidence review",
        detail:
          "Walk through the three strongest findings and validate whether a redesign is already planned.",
        impact: "high",
        evidenceRefs: ["ev-website-home", "ev-news-launch"],
      },
      {
        title: "Lead with mobile conversion, not aesthetics",
        detail:
          "Tie the recommendation to measurable action visibility and qualification quality.",
        impact: "high",
        evidenceRefs: ["ev-website-home"],
      },
      {
        title: "Position automation as sales leverage",
        detail:
          "Connect the guided qualification opportunity to the active revenue hiring programme.",
        impact: "medium",
        evidenceRefs: ["ev-careers-growth", "ev-website-home"],
      },
    ],
    timeline: [
      {
        id: "timeline-website",
        type: "Website",
        title: "Public website research refreshed",
        detail:
          "Homepage, about, services, careers, and contact paths analyzed.",
        occurredAt: "2026-07-24T08:46:00.000Z",
        confidence: 96,
        evidenceRefs: ["ev-website-home", "ev-about-model"],
      },
      {
        id: "timeline-hiring",
        type: "Hiring",
        title: "Revenue hiring observed",
        detail: "Customer success and revenue operations roles are open.",
        occurredAt: "2026-07-23T10:18:00.000Z",
        confidence: 94,
        evidenceRefs: ["ev-careers-growth"],
      },
      {
        id: "timeline-launch",
        type: "Product",
        title: "Enterprise workflow announced",
        detail: "New workflow and two-market expansion announced publicly.",
        occurredAt: "2026-07-18T09:30:00.000Z",
        confidence: 86,
        evidenceRefs: ["ev-news-launch"],
      },
    ],
    outreach: {
      coldEmail: {
        subject: `A conversion observation for ${prospect.company}`,
        body: `Hi ${firstName},\n\nI noticed ${prospect.company} is expanding its enterprise workflow while the primary mobile CTA still sits below the initial viewport. That gap may be making the new positioning harder to convert.\n\nI put together a short evidence-backed audit with three specific improvements across conversion, accessibility, and qualification. Would it be useful if I sent it over?\n\nIf this is not relevant, let me know and I will not follow up.`,
      },
      linkedinMessage: `Hi ${firstName} — I saw the recent enterprise workflow expansion. I also noticed one specific mobile conversion gap on ${prospect.company}'s site. I have a concise evidence-backed observation if useful.`,
      followUpEmail: {
        subject: `Re: ${prospect.company} website observation`,
        body: `Hi ${firstName},\n\nOne useful detail from the audit: the strongest opportunity is not a visual refresh on its own—it is aligning the mobile conversion path with the newer enterprise positioning.\n\nHappy to send the one-page evidence summary if helpful. If not, I will close the loop.`,
      },
      meetingInvitation:
        "20 minutes to review the three strongest website and buying-signal findings, validate what is already planned, and decide whether a focused audit would be useful.",
      websiteAudit:
        "A concise audit covering mobile conversion hierarchy, accessibility, technical SEO, trust signals, and guided qualification—with a source reference and confidence score for every finding.",
      proposal:
        "Phase 1: evidence validation and conversion blueprint. Phase 2: premium responsive redesign. Phase 3: AI qualification and CRM automation. Each phase is independently measurable.",
    },
    evidence,
    industryInsights: {
      overview: `${prospect.industry} companies increasingly compete on time-to-value, integration quality, and proof of operational outcomes.`,
      growth:
        "Public hiring and product expansion indicate active investment, while buyers remain selective about implementation risk.",
      competition:
        "Category leaders differentiate through sharper vertical positioning, faster onboarding, and stronger evidence of customer outcomes.",
      technologyAdoption:
        "Modern web stacks and workflow automation are common; AI is increasingly used for qualification, support, and operational insight.",
      digitalMaturity: bounded(base + 1),
      buyingTrends: [
        "Preference for measurable pilots",
        "Demand for implementation clarity",
        "Higher accessibility and security expectations",
      ],
      salesOpportunities: [
        "Conversion-focused product storytelling",
        "AI-assisted qualification",
        "Lifecycle automation",
        "Accessibility and performance remediation",
      ],
    },
  };
}

export const demoCompanyIntelligence = prospects
  .slice(0, 8)
  .map((prospect) => buildDemoCompanyIntelligence(prospect.id));
