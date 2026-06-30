function getSampleInsiderTransactions(date) {
  return [
    {
      code: "AAPL.US",
      ticker: "AAPL.US",
      transactionType: "P",
      transactionDate: date,
      transactionValue: 350000,
      ownerName: "Sample Insider One",
    },
    {
      code: "AAPL.US",
      ticker: "AAPL.US",
      transactionType: "P",
      transactionDate: date,
      transactionValue: 300000,
      ownerName: "Sample Insider Two",
    },
    {
      code: "AAPL.US",
      ticker: "AAPL.US",
      transactionType: "P",
      transactionDate: date,
      transactionValue: 275000,
      ownerName: "Sample Insider Three",
    },
  ];
}

function getSampleXSocialSignals(date) {
  return [
    {
      id: `sample-x-${date}-semis`,
      source: "sample_x_social",
      sourceType: "x_social",
      sourceAccount: "@sample_researcher",
      sourceUrl: "https://x.example/sample/nvda-ai-demand",
      capturedAt: `${date}T13:00:00.000Z`,
      rawText: "$NVDA checks suggest AI accelerator demand remains strong into earnings. Verify with filings, channel data, and valuation.",
      tickers: ["NVDA"],
      companies: ["NVIDIA"],
      people: ["@sample_researcher"],
      themes: ["ai_infrastructure", "earnings_catalyst"],
      signalType: "earnings_catalyst",
      category: "earnings_catalyst",
      claim: "Sample social/media chatter says AI accelerator demand remains strong into earnings.",
      initialConfidence: 0.62,
      sourceQuality: "high_signal",
      signalStrength: 4,
      actionabilityScore: 78,
      verificationNeeded: true,
      primarySourceNeeded: true,
      requiredVerification: [
        "Verify source track record",
        "Check company filings and earnings materials",
        "Compare valuation and demand claims against independent data",
      ],
      recommendedNextStep: "send_to_research",
      relatedTickers: ["NVDA"],
      relatedThemes: ["ai_infrastructure", "earnings_catalyst"],
      timeSensitivity: "high",
      projectTags: ["portfolio_manager"],
      status: "new",
      sourceTrail: [
        {
          source: "sampleData",
          detail: "Dry-run sample X/social signal",
        },
      ],
      tradingRestriction: "research_only",
    },
    {
      id: `sample-x-${date}-codex-workflow`,
      source: "sample_x_social",
      sourceType: "x_social",
      sourceAccount: "@sample_builder",
      sourceUrl: "https://x.example/sample/codex-workflow",
      capturedAt: `${date}T13:05:00.000Z`,
      rawText: "New Codex workflow idea: save reusable agent checklists for PR verification, deployment notes, and no-secret audits.",
      tickers: [],
      companies: [],
      people: ["@sample_builder"],
      themes: ["codex", "workflow", "ai"],
      signalType: "ai_tool_or_workflow",
      category: "ai_tool_or_workflow",
      claim: "Reusable Codex checklists could improve PR verification and deployment reviews.",
      initialConfidence: 0.56,
      sourceQuality: "unknown",
      signalStrength: 3,
      actionabilityScore: 36,
      verificationNeeded: true,
      primarySourceNeeded: false,
      requiredVerification: ["Try the workflow before adopting it"],
      recommendedNextStep: "add_to_general_intelligence_brief",
      relatedTickers: [],
      relatedThemes: ["codex", "workflow", "ai"],
      timeSensitivity: "low",
      projectTags: ["henry_intelligence", "ai_tools"],
      status: "new",
      sourceTrail: [
        {
          source: "sampleData",
          detail: "Dry-run sample general X intelligence signal",
        },
      ],
      tradingRestriction: "research_only",
    },
  ];
}

function getSampleFundamentals(ticker) {
  const normalized = String(ticker || "").toUpperCase();
  if (normalized === "NVDA") {
    return {
      fundamentals: {
        metric: {
          peNormalizedAnnual: 42.5,
          "52WeekHigh": 140,
          "52WeekLow": 80,
          revenueGrowthTTMYoy: 0.18,
          epsGrowthTTMYoy: 0.22,
        },
      },
      profile: {
        name: "NVIDIA Corporation",
        finnhubIndustry: "Semiconductors",
        exchange: "NASDAQ",
        marketCapitalization: 3000000,
      },
      earnings: [{ surprise: 0.21, period: "2026-Q1" }],
      recommendations: [{ period: "2026-06-01", buy: 30, hold: 8, sell: 1 }],
    };
  }

  return {
    fundamentals: {
      metric: {
        peNormalizedAnnual: 27.4,
        "52WeekHigh": 220,
        "52WeekLow": 160,
        revenueGrowthTTMYoy: 0.06,
        epsGrowthTTMYoy: 0.08,
      },
    },
    profile: {
      name: "Apple Inc.",
      finnhubIndustry: "Technology",
      exchange: "NASDAQ",
      marketCapitalization: 3000000,
    },
    earnings: [{ surprise: 0.14, period: "2026-Q1" }],
    recommendations: [{ period: "2026-06-01", buy: 20, hold: 8, sell: 1 }],
  };
}

module.exports = {
  getSampleInsiderTransactions,
  getSampleXSocialSignals,
  getSampleFundamentals,
};
