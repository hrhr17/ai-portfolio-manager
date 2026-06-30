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
      ticker: "NVDA",
      theme: "AI infrastructure",
      catalyst: "Sample repeated mentions of AI accelerator demand",
      signal: "Sample social/media chatter from monitored researcher accounts",
      observedAt: `${date}T13:00:00.000Z`,
      reliability: "sample_only",
      sourceTrail: [
        {
          source: "sampleData",
          detail: "Dry-run sample X/social signal",
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
