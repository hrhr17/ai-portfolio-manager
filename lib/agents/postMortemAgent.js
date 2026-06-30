function runPostMortemReview({ portfolioSnapshot, approvedPaperTrades, rejectedRecommendations }) {
  const hasHistory = Boolean(process.env.PAPER_PORTFOLIO_HISTORY_JSON);
  const priorHistory = parseHistory();

  return {
    status: hasHistory ? "history_loaded" : "not_enough_history",
    benchmarkComparisons: buildBenchmarkComparisons(priorHistory),
    sourceReliabilityUpdates: buildSourceReliabilityUpdates(approvedPaperTrades, rejectedRecommendations),
    agentProcessFlags: buildProcessFlags(approvedPaperTrades, rejectedRecommendations),
    lessons: buildLessons(hasHistory, portfolioSnapshot),
    auditTrail: [
      {
        agent: "Post-Mortem / Learning Agent",
        action: "Reviewed available history and process quality",
        historyAvailable: hasHistory,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function parseHistory() {
  if (!process.env.PAPER_PORTFOLIO_HISTORY_JSON) return [];
  try {
    const parsed = JSON.parse(process.env.PAPER_PORTFOLIO_HISTORY_JSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[post-mortem-agent] Could not parse PAPER_PORTFOLIO_HISTORY_JSON:", err.message);
    return [];
  }
}

function buildBenchmarkComparisons(history) {
  if (history.length === 0) {
    return [
      {
        benchmark: "SPY",
        status: "pending",
        note: "No stored paper-portfolio performance history yet.",
      },
      {
        benchmark: "QQQ",
        status: "pending",
        note: "No stored paper-portfolio performance history yet.",
      },
    ];
  }

  return history.map((entry) => ({
    date: entry.date,
    portfolioReturnPct: entry.portfolioReturnPct,
    spyReturnPct: entry.spyReturnPct,
    qqqReturnPct: entry.qqqReturnPct,
    note: entry.note || "Historical comparison loaded from PAPER_PORTFOLIO_HISTORY_JSON.",
  }));
}

function buildSourceReliabilityUpdates(approvedPaperTrades, rejectedRecommendations) {
  return [
    {
      source: "EODHD insider transactions",
      status: approvedPaperTrades.some((trade) => trade.sourceTrail.some((item) => item.source.includes("EODHD")))
        ? "active"
        : "no_new_approved_signals",
      note: "Reliability should be updated after subsequent price and thesis outcomes are stored.",
    },
    {
      source: "X/social",
      status: rejectedRecommendations.some((item) => item.sourceType === "x_social") ? "research_only_blocked" : "inactive",
      note: "Social sources remain research-only until verified against primary evidence.",
    },
  ];
}

function buildProcessFlags(approvedPaperTrades, rejectedRecommendations) {
  const flags = [];

  if (approvedPaperTrades.length === 0) {
    flags.push("No paper trades approved today; check whether the scout is too restrictive or data was sparse.");
  }
  if (rejectedRecommendations.length > 0) {
    flags.push("Risk or skeptic review rejected ideas; review objections before revisiting.");
  }
  if (flags.length === 0) {
    flags.push("No immediate process exceptions detected.");
  }

  return flags;
}

function buildLessons(hasHistory, portfolioSnapshot) {
  const lessons = [
    "Keep social/media signals in the research queue until independently verified.",
    "Do not allocate before the Skeptic Agent records objections.",
  ];

  if (!hasHistory) {
    lessons.push("Add persistent performance history before claiming process improvement from outcomes.");
  }
  if ((portfolioSnapshot.positions || []).length === 0) {
    lessons.push("Paper portfolio is empty or not configured; allocation review is operating from a blank snapshot.");
  }

  return lessons;
}

module.exports = { runPostMortemReview };
