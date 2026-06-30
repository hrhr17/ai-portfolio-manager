const DEFAULT_CAPABILITIES = [
  "monitored_accounts",
  "bookmarks",
  "lists",
  "cashtags",
  "unusual_alert_accounts",
  "trader_researcher_accounts",
];

/**
 * Placeholder for future X/Twitter ingestion.
 *
 * This module intentionally does not connect to X unless credentials and an
 * implementation are added later. Social data is allowed to create research
 * tasks only; it must never create direct trades.
 */
async function fetchXSocialSignals({ date } = {}) {
  if (process.env.X_SOURCE_MOCK_SIGNALS === "true") {
    return buildMockSignals(date);
  }

  return [];
}

function getXSourceStatus() {
  return {
    enabled: false,
    mode: process.env.X_SOURCE_MOCK_SIGNALS === "true" ? "mock" : "disabled",
    capabilities: DEFAULT_CAPABILITIES,
    safetyRule: "X/social inputs may only create research tasks, not trades.",
    requiredForLiveIngestion: [
      "API credentials",
      "monitored account/list configuration",
      "rate-limit handling",
      "source reliability scoring",
      "duplicate and manipulation checks",
    ],
  };
}

function buildMockSignals(date) {
  return [
    {
      id: `x-mock-${date || "today"}-semis`,
      source: "x_social_mock",
      sourceType: "x_social",
      ticker: "NVDA",
      theme: "AI infrastructure",
      catalyst: "Repeated mock mentions of AI accelerator demand",
      signal: "Mock social chatter spike from monitored researcher accounts",
      observedAt: new Date().toISOString(),
      reliability: "mock_only",
      sourceTrail: [
        {
          source: "xSourceAgent",
          detail: "Mock signal enabled by X_SOURCE_MOCK_SIGNALS=true",
        },
      ],
      tradingRestriction: "research_only",
    },
  ];
}

module.exports = { fetchXSocialSignals, getXSourceStatus };
