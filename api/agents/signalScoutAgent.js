const { scoreCandidates } = require("../utils/scoreCandidates");

function buildResearchQueue(inputs) {
  const insiderScores = scoreCandidates(inputs.raw.insiderTransactions);
  const insiderTasks = [
    ...insiderScores.high.map((candidate) => buildInsiderTask(candidate, "HIGH")),
    ...insiderScores.medium.map((candidate) => buildInsiderTask(candidate, "MEDIUM")),
  ];

  const socialTasks = inputs.raw.xSocialSignals.map(buildSocialTask);
  const researchQueue = [...insiderTasks, ...socialTasks].sort(byPriority);

  return {
    newSignals: {
      insider: {
        high: insiderScores.high,
        medium: insiderScores.medium,
        low: insiderScores.low,
      },
      xSocial: inputs.raw.xSocialSignals,
    },
    researchQueue,
    auditTrail: [
      {
        agent: "Signal Scout Agent",
        action: "Converted raw inputs into research tasks",
        taskCount: researchQueue.length,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function buildInsiderTask(candidate, priority) {
  const symbol = normalizeTicker(candidate.ticker);
  return {
    id: `insider-${symbol}-${candidate.latestDate || "unknown"}`,
    ticker: symbol,
    displayTicker: candidate.ticker,
    sourceType: "insider_transactions",
    priority,
    theme: "Insider activity",
    catalyst: `${candidate.transactionCount} insider purchase(s), total value ${formatUsd(candidate.score.totalValue)}`,
    whyNow: `Conviction ${candidate.score.conviction} from EODHD insider transactions`,
    requiredVerification: [
      "Confirm transaction details and role of insiders",
      "Check recent filings/news for contradictory context",
      "Verify liquidity and valuation before any paper allocation",
    ],
    sourceTrail: [
      {
        source: "EODHD insider transactions",
        ticker: candidate.ticker,
        latestDate: candidate.latestDate,
        transactionCount: candidate.transactionCount,
      },
    ],
    rawCandidate: candidate,
  };
}

function buildSocialTask(signal) {
  const ticker = normalizeTicker(signal.ticker || signal.cashtag || "UNKNOWN");
  return {
    id: signal.id || `x-social-${ticker}-${Date.now()}`,
    ticker,
    displayTicker: signal.ticker || signal.cashtag || ticker,
    sourceType: "x_social",
    priority: "WATCH",
    theme: signal.theme || "Social/media signal",
    catalyst: signal.catalyst || signal.signal || "Social mention requires verification",
    whyNow: signal.signal || "X/social placeholder signal observed",
    requiredVerification: [
      "Verify source identity and track record",
      "Check for promotional or coordinated activity",
      "Confirm with filings, news, fundamentals, and price/liquidity data",
    ],
    sourceTrail: signal.sourceTrail || [
      {
        source: signal.source || "X/social placeholder",
        detail: "Future social ingestion placeholder",
      },
    ],
    tradingRestriction: "research_only",
    rawSignal: signal,
  };
}

function byPriority(a, b) {
  const rank = { HIGH: 0, MEDIUM: 1, WATCH: 2, LOW: 3 };
  return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .trim()
    .toUpperCase()
    .replace(/\.US$/, "")
    .replace("-", ".");
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

module.exports = { buildResearchQueue, normalizeTicker };
