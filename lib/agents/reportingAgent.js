const { writeDailyReportToDrive } = require("../utils/writeToDrive");
const { buildHenryIntelligenceBrief, buildXSignalDesk } = require("../sources/xSourceAgent");

function buildDailyCommitteeReport(context) {
  const lines = [];
  const {
    date,
    inputs,
    scoutOutput,
    quantResearchOutput,
    backtestValidationOutput,
    modelRiskOutput,
    monitoringOutput,
    researchOutput,
    portfolioOutput,
    riskOutput,
    startingPortfolio,
    projectedPortfolio,
    postMortemOutput,
  } = context;

  lines.push("AI INVESTMENT COMMITTEE DAILY REPORT");
  lines.push(`Date: ${date}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("Paper portfolio only. No live trading, margin, options, or crypto.");
  lines.push("");

  section(lines, "Executive Summary", [
    `Raw insider transactions: ${inputs.raw.insiderTransactions.length}`,
    `X/social signals: ${inputs.raw.xSocialSignals.length}`,
    `Quant factor hypotheses opened: ${quantResearchOutput?.hypotheses?.length || 0}`,
    `Research tasks opened: ${scoutOutput.researchQueue.length}`,
    `Theses researched: ${researchOutput.theses.length}`,
    `Paper recommendations reviewed: ${portfolioOutput.recommendations.length}`,
    `Risk-approved paper actions/watch items: ${riskOutput.approvedPaperTrades.length}`,
    `Risk-rejected ideas: ${riskOutput.rejectedRecommendations.length}`,
  ]);

  section(lines, "New Signals", formatNewSignals(scoutOutput.newSignals));
  section(lines, "X/Social/Bookmark Signals", formatXSignals(inputs.raw.xSocialSignals, inputs.sourceStatus.xSocial));
  section(lines, "X / Social Signal Desk", formatXSignalDesk(inputs.raw.xSocialSignals, scoutOutput));
  section(lines, "Henry X Intelligence Brief", formatHenryIntelligenceBrief(inputs.raw.xSocialSignals));
  section(lines, "Research Queue", formatResearchQueue(scoutOutput.researchQueue, researchOutput.skippedTasks));
  section(lines, "Quant Research / Factor Lab", formatQuantResearchLab(quantResearchOutput, backtestValidationOutput, modelRiskOutput, monitoringOutput));
  section(lines, "Approved Paper Trades", formatApprovedTrades(riskOutput.approvedPaperTrades));
  section(lines, "Rejected Ideas and Why", formatRejectedIdeas(portfolioOutput.rejectedIdeas, riskOutput.rejectedRecommendations));
  section(lines, "Risk Committee Output", formatRiskOutput(riskOutput));
  section(lines, "Portfolio Review", formatPortfolioReview(startingPortfolio, projectedPortfolio));
  section(lines, "Performance Review", formatPerformanceReview(postMortemOutput));
  section(lines, "Mistakes / Lessons / Process Improvements", postMortemOutput.lessons);
  section(lines, "Watchlist", formatWatchlist(riskOutput.approvedPaperTrades, portfolioOutput.recommendations));
  section(lines, "Audit Trail", formatAuditTrail(context));

  lines.push("--- End of Report ---");
  return lines.join("\n");
}

async function writeCommitteeReport({ date, reportBody }) {
  const title = `AI Investment Committee Report - ${date}`;
  return writeDailyReportToDrive(title, reportBody);
}

function section(lines, title, content) {
  lines.push("=".repeat(72));
  lines.push(title);
  lines.push("=".repeat(72));
  const items = Array.isArray(content) ? content : [content];
  if (items.length === 0) lines.push("None.");
  for (const item of items) lines.push(item || "None.");
  lines.push("");
}

function formatNewSignals(newSignals) {
  const lines = [
    `High conviction insider signals: ${newSignals.insider.high.length}`,
    `Medium conviction insider signals: ${newSignals.insider.medium.length}`,
    `Low conviction insider signals: ${newSignals.insider.low.length}`,
  ];

  for (const candidate of [...newSignals.insider.high, ...newSignals.insider.medium].slice(0, 12)) {
    lines.push(
      `- ${candidate.ticker}: ${candidate.score.conviction}, score ${candidate.score.total}, ${candidate.transactionCount} buy(s), ${formatUsd(candidate.score.totalValue)} total value`
    );
  }

  return lines;
}

function formatXSignals(signals, status) {
  if (signals.length === 0) {
    return [
      `Status: ${status.mode}. No live X integration is enabled.`,
      "Future interface supports monitored accounts, bookmarks, lists, cashtags, unusual-alert accounts, and trader/researcher accounts.",
      "Rule: social data can create research tasks only; it cannot create trades.",
    ];
  }

  return signals.map((signal) => `- ${formatSignalLabel(signal)}: ${signal.claim || signal.signal || signal.catalyst}`);
}

function formatXSignalDesk(signals, scoutOutput) {
  if (signals.length === 0) return ["No X/social signals available today."];

  const desk = buildXSignalDesk(signals);
  const lines = [];
  lines.push("Top finance signals:");
  lines.push(...formatSignalList(desk.topFinanceSignals, "No finance signals."));
  lines.push("Ignored/noisy finance signals:");
  lines.push(...formatSignalList(desk.ignoredOrNoisyFinanceSignals, "No ignored/noisy finance signals."));
  lines.push("Research candidates:");
  lines.push(...formatSignalList(desk.researchCandidates, "No X-derived research candidates."));
  lines.push("Watchlist additions:");
  lines.push(...formatSignalList(desk.watchlistAdditions, "No X-derived watchlist additions."));
  lines.push("Research queue tasks opened from X/social:");
  lines.push(
    ...scoutOutput.researchQueue
      .filter((task) => task.sourceType === "x_social")
      .map((task) => `- ${task.ticker}: ${task.xRecommendedNextStep || "watch"} - ${task.catalyst}`)
  );
  if (!scoutOutput.researchQueue.some((task) => task.sourceType === "x_social")) lines.push("- None.");
  lines.push("Required verification:");
  lines.push(...(desk.requiredVerification.length > 0 ? desk.requiredVerification.map((item) => `- ${item}`) : ["- None."]));
  return lines;
}

function formatHenryIntelligenceBrief(signals) {
  if (signals.length === 0) return ["No general X intelligence signals available today."];

  const brief = buildHenryIntelligenceBrief(signals);
  return [
    "Useful AI tools/resources:",
    ...formatSignalList(brief.usefulAiToolsAndResources, "None."),
    "Startups to watch:",
    ...formatSignalList(brief.startupsToWatch, "None."),
    "Business/revenue ideas:",
    ...formatSignalList(brief.businessRevenueIdeas, "None."),
    "Codex/ChatGPT workflow upgrades:",
    ...formatSignalList(brief.codexChatgptWorkflowUpgrades, "None."),
    "Learning resources:",
    ...formatSignalList(brief.learningResources, "None."),
    "Content ideas:",
    ...formatSignalList(brief.contentIdeas, "None."),
    "Things to ignore:",
    ...formatSignalList(brief.thingsToIgnore, "None."),
  ];
}

function formatSignalList(signals, emptyText) {
  if (!signals || signals.length === 0) return [`- ${emptyText}`];
  return signals.slice(0, 8).map((signal) => {
    return `- ${formatSignalLabel(signal)} [${signal.category}; ${signal.sourceQuality}; strength ${signal.signalStrength}/5; next: ${signal.recommendedNextStep}] ${signal.claim}`;
  });
}

function formatSignalLabel(signal) {
  const ticker = signal.relatedTickers?.[0] || signal.tickers?.[0] || signal.ticker || signal.cashtag;
  return ticker || signal.sourceAccount || signal.source || "X/social";
}

function formatResearchQueue(queue, skippedTasks) {
  const lines = queue.slice(0, 15).map((task) => `- ${task.ticker}: ${task.priority} ${task.sourceType} - ${task.catalyst}`);
  if (skippedTasks.length > 0) lines.push(`Skipped for today due to queue limit: ${skippedTasks.length}`);
  return lines;
}

function formatQuantResearchLab(quantResearchOutput, backtestValidationOutput, modelRiskOutput, monitoringOutput) {
  if (!quantResearchOutput) return ["Factor Lab not run for this report."];

  const lines = [
    `Status: ${quantResearchOutput.status}`,
    "Purpose: repeated ideas become testable factor hypotheses, not trades.",
    "Rule: factors cannot directly create BUY or SELL recommendations.",
    "Human gate: permanent requirement before any live capital; no brokerage execution is enabled.",
    `Starter factor library: ${quantResearchOutput.factorBacklog.length} factor(s).`,
  ];

  lines.push("Future orchestrator states:");
  lines.push(`- ${quantResearchOutput.orchestratorRoadmap.ideaStates.join(" -> ")}`);
  lines.push("Hypotheses opened today:");
  if (quantResearchOutput.hypotheses.length === 0) {
    lines.push("- None. Continue collecting repeated ideas.");
  } else {
    for (const hypothesis of quantResearchOutput.hypotheses.slice(0, 8)) {
      lines.push(
        `- ${hypothesis.title}: ${hypothesis.validationStatus}; allowed ${hypothesis.allowedAction}; direct trade ${hypothesis.canDirectlyTrade}`
      );
      lines.push(`  Hypothesis: ${hypothesis.hypothesis}`);
      lines.push(`  Economic rationale: ${hypothesis.economicRationale}`);
      lines.push(`  Factor definition: ${hypothesis.factorDefinition}`);
      lines.push(`  Benchmark/holding period: ${hypothesis.benchmark}; ${hypothesis.holdingPeriod}`);
      lines.push(`  Entry rules: ${hypothesis.entryRules.join(" | ")}`);
      lines.push(`  Exit rules: ${hypothesis.exitRules.join(" | ")}`);
      lines.push(`  Research risk controls: ${hypothesis.riskControls.join(" | ")}`);
      lines.push(`  Decay conditions: ${hypothesis.decayConditions.join(" | ")}`);
      lines.push(`  Required data: ${hypothesis.requiredData.join(", ")}`);
      lines.push(`  Known biases: ${hypothesis.knownBiases.join(", ")}`);
    }
  }

  lines.push("Validation placeholder:");
  lines.push(`- ${backtestValidationOutput?.status || "not_started"}; checks: ${(backtestValidationOutput?.validationChecks || []).join(", ")}`);
  lines.push("Model risk placeholder:");
  lines.push(
    `- ${modelRiskOutput?.status || "not_started"}; flags: ${modelRiskOutput?.flags?.length || 0}; checklist: ${(modelRiskOutput?.challengeChecklist || []).join(", ")}`
  );
  lines.push("Monitoring placeholder:");
  lines.push(
    `- ${monitoringOutput?.status || "not_started"}; checks: ${(monitoringOutput?.monitoringChecks || []).join(", ")}; human review required: ${monitoringOutput?.humanReviewRequired === true}`
  );

  return lines;
}

function formatApprovedTrades(trades) {
  if (trades.length === 0) return ["No paper trades or watch items approved by risk review."];

  return trades.map((trade) => {
    const objections = trade.skepticObjections.map((item) => `${item.severity}: ${item.objection}`).join(" | ");
    return [
      `- ${trade.ticker}: ${trade.action}, target ${trade.targetWeightPct}%, confidence ${Math.round(trade.confidence * 100)}%, risk decision ${trade.riskDecision}`,
      `  Thesis: ${trade.thesis}`,
      `  Reasoning: ${trade.reasoning}`,
      `  Risk notes: ${trade.riskNotes.join(" | ")}`,
      `  Skeptic objections: ${objections}`,
      `  Review trigger: ${trade.reviewTrigger}`,
      `  Source trail: ${formatSourceTrail(trade.sourceTrail)}`,
    ].join("\n");
  });
}

function formatRejectedIdeas(portfolioRejected, riskRejected) {
  const lines = [];
  for (const item of portfolioRejected) {
    lines.push(`- ${item.ticker}: ${item.reason}. Objections: ${item.objections.map((objection) => objection.objection).join(" | ")}`);
  }
  for (const item of riskRejected) {
    lines.push(`- ${item.ticker}: Risk rejected - ${item.rejectionReasons.join(" | ")}`);
  }
  return lines;
}

function formatRiskOutput(riskOutput) {
  const rules = riskOutput.rules;
  const lines = [
    riskOutput.safetyNotice,
    `Max single position: ${rules.maxSinglePositionTargetWeightPct}%`,
    `Max new positions/day: ${rules.maxNewPositionsPerDay}`,
    `Max daily turnover: ${rules.maxDailyTurnoverPct}%`,
    `Max sector/theme concentration: ${rules.maxSectorConcentrationPct}% / ${rules.maxThemeConcentrationPct}%`,
    `Projected turnover: ${riskOutput.projectedTurnoverPct}%`,
  ];

  for (const resize of riskOutput.resizedRecommendations) {
    lines.push(`Resized ${resize.ticker}: ${resize.fromTargetWeightPct}% to ${resize.toTargetWeightPct}% (${resize.reason})`);
  }

  return lines;
}

function formatPortfolioReview(startingPortfolio, projectedPortfolio) {
  const lines = [
    `Starting cash weight: ${startingPortfolio.cashWeightPct}%`,
    `Projected cash weight: ${projectedPortfolio.cashWeightPct}%`,
  ];

  if (projectedPortfolio.positions.length === 0) {
    lines.push("Projected portfolio has no open paper positions.");
  } else {
    for (const position of projectedPortfolio.positions) {
      lines.push(`- ${position.ticker}: ${position.weightPct}% (${position.sector}; ${position.theme})`);
    }
  }

  return [...lines, ...(projectedPortfolio.notes || [])];
}

function formatPerformanceReview(postMortemOutput) {
  const lines = [`Status: ${postMortemOutput.status}`];
  for (const comparison of postMortemOutput.benchmarkComparisons) {
    lines.push(`- ${comparison.benchmark || comparison.date}: ${comparison.note}`);
  }
  for (const update of postMortemOutput.sourceReliabilityUpdates) {
    lines.push(`- Source ${update.source}: ${update.status}. ${update.note}`);
  }
  for (const flag of postMortemOutput.agentProcessFlags) lines.push(`- Process flag: ${flag}`);
  return lines;
}

function formatWatchlist(approvedTrades, recommendations) {
  const watchItems = recommendations.filter((item) => item.action === "WATCH");
  const approvedWatchItems = approvedTrades.filter((item) => item.action === "WATCH");
  const items = [...watchItems, ...approvedWatchItems];
  const unique = new Map(items.map((item) => [item.ticker, item]));

  if (unique.size === 0) return ["No watchlist additions today."];
  return [...unique.values()].map((item) => `- ${item.ticker}: ${item.catalyst}. Trigger: ${item.reviewTrigger}`);
}

function formatAuditTrail(context) {
  return [
    ...context.inputs.auditTrail,
    ...context.scoutOutput.auditTrail,
    ...(context.quantResearchOutput?.auditTrail || []),
    ...(context.backtestValidationOutput?.auditTrail || []),
    ...(context.modelRiskOutput?.auditTrail || []),
    ...(context.monitoringOutput?.auditTrail || []),
    ...context.researchOutput.auditTrail,
    ...context.skepticOutput.auditTrail,
    ...context.portfolioOutput.auditTrail,
    ...context.riskOutput.auditTrail,
    ...context.postMortemOutput.auditTrail,
  ].map((entry) => `- ${entry.timestamp}: ${entry.agent} - ${entry.action}`);
}

function formatSourceTrail(sourceTrail) {
  return sourceTrail.map((item) => item.source || item.detail || JSON.stringify(item)).join(" -> ");
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

module.exports = { buildDailyCommitteeReport, writeCommitteeReport };
