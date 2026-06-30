const {
  fetchBasicFinancials,
  fetchCompanyProfile,
  fetchEarningsSurprises,
  fetchRecommendationTrends,
} = require("../utils/fetchFundamentals");
const { getSampleFundamentals } = require("../utils/sampleData");

const DEFAULT_RESEARCH_LIMIT = 10;

async function researchCandidates(researchQueue, options = {}) {
  const limit = Number(process.env.RESEARCH_QUEUE_LIMIT || options.limit || DEFAULT_RESEARCH_LIMIT);
  const selectedTasks = researchQueue.slice(0, limit);

  const theses = await Promise.all(selectedTasks.map((task) => researchCandidate(task, options)));

  return {
    theses,
    skippedTasks: researchQueue.slice(limit),
    auditTrail: [
      {
        agent: "Equity Research Agent",
        action: "Built concise investment theses",
        researchedCount: theses.length,
        skippedCount: Math.max(researchQueue.length - theses.length, 0),
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function researchCandidate(task, options = {}) {
  if (options.useSampleData) {
    return researchCandidateFromSampleData(task);
  }

  const [fundamentalsResult, profileResult, earningsResult, recommendationsResult] = await Promise.allSettled([
    fetchBasicFinancials(task.ticker),
    fetchCompanyProfile(task.ticker),
    fetchEarningsSurprises(task.ticker, 4),
    fetchRecommendationTrends(task.ticker),
  ]);

  const fundamentals = valueOrNull(fundamentalsResult);
  const profile = valueOrNull(profileResult);
  const earnings = valueOrArray(earningsResult);
  const recommendations = valueOrArray(recommendationsResult);
  const fetchErrors = collectFetchErrors({
    fundamentals: fundamentalsResult,
    profile: profileResult,
    earnings: earningsResult,
    recommendations: recommendationsResult,
  });

  const metric = fundamentals?.metric || {};
  const requiredVerification = [...task.requiredVerification];
  if (fetchErrors.length > 0) {
    requiredVerification.push("Resolve missing or failed Finnhub enrichment before increasing confidence");
  }

  return {
    id: `research-${task.id}`,
    ticker: task.ticker,
    displayTicker: task.displayTicker || task.ticker,
    sourceTaskId: task.id,
    sourceType: task.sourceType,
    priority: task.priority,
    businessSummary: buildBusinessSummary(task, profile),
    valuationContext: buildValuationContext(metric, profile),
    catalyst: task.catalyst,
    risk: buildResearchRisks(task, metric, earnings, fetchErrors),
    timeHorizon: task.sourceType === "insider_transactions" ? "3 to 12 months" : "Research first; no allocation horizon yet",
    requiredVerification,
    confidenceInputs: buildConfidenceInputs(task, metric, profile, earnings),
    evidence: {
      insiderScore: task.rawCandidate?.score || null,
      profile,
      fundamentals,
      earnings,
      recommendations,
      fetchErrors,
    },
    sourceTrail: [
      ...task.sourceTrail,
      { source: "Finnhub basic financials", status: fundamentals ? "ok" : "missing" },
      { source: "Finnhub company profile", status: profile ? "ok" : "missing" },
      { source: "Finnhub earnings", status: earnings.length > 0 ? "ok" : "missing" },
    ],
  };
}

function researchCandidateFromSampleData(task) {
  const sample = getSampleFundamentals(task.ticker);
  const fundamentals = sample.fundamentals;
  const profile = sample.profile;
  const earnings = sample.earnings;
  const recommendations = sample.recommendations;
  const metric = fundamentals.metric || {};

  return {
    id: `research-${task.id}`,
    ticker: task.ticker,
    displayTicker: task.displayTicker || task.ticker,
    sourceTaskId: task.id,
    sourceType: task.sourceType,
    priority: task.priority,
    businessSummary: buildBusinessSummary(task, profile),
    valuationContext: buildValuationContext(metric, profile),
    catalyst: task.catalyst,
    risk: buildResearchRisks(task, metric, earnings, []),
    timeHorizon: task.sourceType === "insider_transactions" ? "3 to 12 months" : "Research first; no allocation horizon yet",
    requiredVerification: [...task.requiredVerification, "Dry-run sample thesis; replace with live data before real review"],
    confidenceInputs: buildConfidenceInputs(task, metric, profile, earnings),
    evidence: {
      insiderScore: task.rawCandidate?.score || null,
      profile,
      fundamentals,
      earnings,
      recommendations,
      fetchErrors: [],
      dryRunSampleData: true,
    },
    sourceTrail: [
      ...task.sourceTrail,
      { source: "Sample fundamentals", status: "sample" },
      { source: "Sample company profile", status: "sample" },
      { source: "Sample earnings", status: "sample" },
    ],
  };
}

function buildBusinessSummary(task, profile) {
  const name = profile?.name || task.displayTicker || task.ticker;
  const industry = profile?.finnhubIndustry || "industry not available";
  const exchange = profile?.exchange ? ` listed on ${profile.exchange}` : "";
  return `${name} is a ${industry} company${exchange}. This thesis was opened from ${task.sourceType.replace("_", " ")} and still requires independent verification.`;
}

function buildValuationContext(metric, profile) {
  const parts = [];
  const pe = metric.peNormalizedAnnual ?? metric.peTTM;
  const revenueGrowth = metric.revenueGrowthTTMYoy;
  const epsGrowth = metric.epsGrowthTTMYoy;

  if (profile?.marketCapitalization != null) parts.push(`market cap about ${formatUsd(profile.marketCapitalization * 1_000_000)}`);
  if (pe != null) parts.push(`normalized P/E ${Number(pe).toFixed(1)}`);
  if (metric["52WeekHigh"] != null && metric["52WeekLow"] != null) {
    parts.push(`52-week range ${formatUsd(metric["52WeekLow"])} to ${formatUsd(metric["52WeekHigh"])}`);
  }
  if (revenueGrowth != null) parts.push(`revenue growth ${(Number(revenueGrowth) * 100).toFixed(1)}% YoY`);
  if (epsGrowth != null) parts.push(`EPS growth ${(Number(epsGrowth) * 100).toFixed(1)}% YoY`);

  return parts.length > 0 ? parts.join("; ") : "Valuation context unavailable from current fundamentals pull.";
}

function buildResearchRisks(task, metric, earnings, fetchErrors) {
  const risks = [];
  const pe = metric.peNormalizedAnnual ?? metric.peTTM;

  if (task.sourceType === "x_social") {
    risks.push("Social/media signals can be promotional, crowded, stale, or manipulated.");
  }
  if (pe != null && Number(pe) > 45) {
    risks.push(`Valuation risk: P/E is elevated at ${Number(pe).toFixed(1)}.`);
  }
  if (earnings[0]?.surprise != null && Number(earnings[0].surprise) < 0) {
    risks.push("Recent earnings surprise was negative.");
  }
  if (fetchErrors.length > 0) {
    risks.push("One or more enrichment calls failed, reducing confidence.");
  }
  if (risks.length === 0) {
    risks.push("No decisive disconfirming evidence found in the limited daily data pull.");
  }

  return risks;
}

function buildConfidenceInputs(task, metric, profile, earnings) {
  return {
    signalPriority: task.priority,
    insiderScore: task.rawCandidate?.score?.total ?? null,
    hasProfile: Boolean(profile?.name),
    hasFundamentals: Object.keys(metric).length > 0,
    latestEarningsSurprise: earnings[0]?.surprise ?? null,
  };
}

function collectFetchErrors(results) {
  return Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([name, result]) => ({ name, message: result.reason.message }));
}

function valueOrNull(result) {
  return result.status === "fulfilled" ? result.value : null;
}

function valueOrArray(result) {
  return result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [];
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

module.exports = { researchCandidates };
