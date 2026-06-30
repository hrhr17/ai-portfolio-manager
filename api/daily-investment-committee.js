const { collectDailyInputs } = require("../lib/agents/dataAgent");
const { buildHenryIntelligenceBrief, buildXSignalDesk } = require("../lib/sources/xSourceAgent");
const { buildResearchQueue } = require("../lib/agents/signalScoutAgent");
const { researchCandidates } = require("../lib/agents/equityResearchAgent");
const { challengeTheses } = require("../lib/agents/skepticAgent");
const { buildPaperRecommendations } = require("../lib/agents/portfolioManagerAgent");
const { buildDailyCommitteeReport, writeCommitteeReport } = require("../lib/agents/reportingAgent");
const { runPostMortemReview } = require("../lib/agents/postMortemAgent");
const { runRiskReview } = require("../lib/risk/riskEngine");
const { loadPaperPortfolioSnapshot, applyPaperRecommendations } = require("../lib/portfolio/paperPortfolio");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method || "GET")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const date = req.query?.date || getTodayInTimeZone("America/New_York");
    const dryRun = req.query?.dryRun === "true";
    const writeReport = dryRun ? req.query?.writeReport === "true" : true;
    const result = await runDailyInvestmentCommittee({ date, writeReport, useSampleData: dryRun });

    return res.status(200).json({
      success: true,
      dryRun,
      usedSampleData: dryRun,
      wroteReport: Boolean(result.docUrl),
      date,
      docUrl: result.docUrl,
      summary: result.summary,
      safetyNotice: result.riskOutput.safetyNotice,
      auditTrail: result.auditTrail,
      pipelineOutputs: dryRun ? buildDryRunPipelineOutputs(result) : undefined,
      reportPreview: dryRun ? result.reportBody.slice(0, 4000) : undefined,
    });
  } catch (err) {
    console.error("[daily-investment-committee] Fatal error:", err);
    return res.status(500).json({ error: err.message });
  }
};

async function runDailyInvestmentCommittee({ date, writeReport = true, useSampleData = false } = {}) {
  const runDate = date || getTodayInTimeZone("America/New_York");
  console.log(`[daily-investment-committee] Running committee for ${runDate}`);

  const startingPortfolio = loadPaperPortfolioSnapshot();
  const inputs = await collectDailyInputs({ date: runDate, useSampleData });
  const scoutOutput = buildResearchQueue(inputs);
  const researchOutput = await researchCandidates(scoutOutput.researchQueue, { useSampleData });
  const skepticOutput = challengeTheses(researchOutput.theses);
  const portfolioOutput = buildPaperRecommendations(skepticOutput.reviewedTheses, startingPortfolio);
  const riskOutput = runRiskReview(portfolioOutput.recommendations, startingPortfolio, getRiskRuleOverrides());
  const projectedPortfolio = applyPaperRecommendations(startingPortfolio, riskOutput.approvedPaperTrades);
  const postMortemOutput = runPostMortemReview({
    portfolioSnapshot: startingPortfolio,
    approvedPaperTrades: riskOutput.approvedPaperTrades,
    rejectedRecommendations: riskOutput.rejectedRecommendations,
  });

  const reportContext = {
    date: runDate,
    inputs,
    scoutOutput,
    researchOutput,
    skepticOutput,
    portfolioOutput,
    riskOutput,
    startingPortfolio,
    projectedPortfolio,
    postMortemOutput,
  };
  const reportBody = buildDailyCommitteeReport(reportContext);
  const driveResult = writeReport ? await writeCommitteeReport({ date: runDate, reportBody }) : null;

  const auditTrail = [
    ...inputs.auditTrail,
    ...scoutOutput.auditTrail,
    ...researchOutput.auditTrail,
    ...skepticOutput.auditTrail,
    ...portfolioOutput.auditTrail,
    ...riskOutput.auditTrail,
    ...postMortemOutput.auditTrail,
  ];

  return {
    date: runDate,
    docId: driveResult?.docId || null,
    docUrl: driveResult?.docUrl || null,
    reportBody,
    inputs,
    scoutOutput,
    researchOutput,
    skepticOutput,
    portfolioOutput,
    riskOutput,
    startingPortfolio,
    projectedPortfolio,
    postMortemOutput,
    auditTrail,
    summary: {
      insiderTransactions: inputs.raw.insiderTransactions.length,
      xSocialSignals: inputs.raw.xSocialSignals.length,
      researchTasks: scoutOutput.researchQueue.length,
      researchedTheses: researchOutput.theses.length,
      recommendations: portfolioOutput.recommendations.length,
      riskApproved: riskOutput.approvedPaperTrades.length,
      riskRejected: riskOutput.rejectedRecommendations.length,
      projectedPositions: projectedPortfolio.positions.length,
    },
  };
}

function buildDryRunPipelineOutputs(result) {
  return {
    dataAgent: {
      sourceStatus: result.inputs.sourceStatus,
      rawCounts: {
        insiderTransactions: result.inputs.raw.insiderTransactions.length,
        xSocialSignals: result.inputs.raw.xSocialSignals.length,
      },
    },
    signalScoutAgent: {
      newSignals: result.scoutOutput.newSignals,
      researchQueue: result.scoutOutput.researchQueue,
    },
    equityResearchAgent: {
      theses: result.researchOutput.theses,
      skippedTasks: result.researchOutput.skippedTasks,
    },
    skepticAgent: {
      reviewedTheses: result.skepticOutput.reviewedTheses,
    },
    portfolioManagerAgent: {
      recommendations: result.portfolioOutput.recommendations,
      rejectedIdeas: result.portfolioOutput.rejectedIdeas,
    },
    riskEngine: {
      rules: result.riskOutput.rules,
      approvedPaperTrades: result.riskOutput.approvedPaperTrades,
      rejectedRecommendations: result.riskOutput.rejectedRecommendations,
      resizedRecommendations: result.riskOutput.resizedRecommendations,
    },
    reportingAgent: {
      docUrl: result.docUrl,
      reportPreview: result.reportBody.slice(0, 4000),
    },
    xSocialSignalDesk: buildXSignalDesk(result.inputs.raw.xSocialSignals),
    henryXIntelligenceBrief: buildHenryIntelligenceBrief(result.inputs.raw.xSocialSignals),
    postMortemAgent: result.postMortemOutput,
    paperPortfolio: {
      startingPortfolio: result.startingPortfolio,
      projectedPortfolio: result.projectedPortfolio,
    },
  };
}

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  return authHeader === `Bearer ${cronSecret}`;
}

function getRiskRuleOverrides() {
  return {
    maxSinglePositionTargetWeightPct: numberFromEnv("MAX_SINGLE_POSITION_TARGET_WEIGHT_PCT"),
    maxNewPositionsPerDay: numberFromEnv("MAX_NEW_POSITIONS_PER_DAY"),
    maxDailyTurnoverPct: numberFromEnv("MAX_DAILY_TURNOVER_PCT"),
    maxSectorConcentrationPct: numberFromEnv("MAX_SECTOR_CONCENTRATION_PCT"),
    maxThemeConcentrationPct: numberFromEnv("MAX_THEME_CONCENTRATION_PCT"),
  };
}

function numberFromEnv(name) {
  const value = process.env[name];
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getTodayInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

module.exports.runDailyInvestmentCommittee = runDailyInvestmentCommittee;
module.exports.getTodayInTimeZone = getTodayInTimeZone;
module.exports.buildDryRunPipelineOutputs = buildDryRunPipelineOutputs;
