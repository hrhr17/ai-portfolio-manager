const { getFactorByName, getFactorLibrary } = require("../factors/factorLibrary");

const IDEA_STATES = [
  "captured",
  "normalized",
  "hypothesis_created",
  "researching",
  "challenged",
  "validated",
  "paper_trading",
  "human_review",
  "approved",
  "rejected",
  "monitoring",
  "retired",
];

const ALLOWED_ACTIONS = ["research_only", "watch", "paper_candidate"];

const HYPOTHESIS_TEMPLATES = {
  insider_cluster_buying: {
    title: "Clustered insider buying after filing date",
    hypothesis:
      "Stocks with at least 3 open-market insider purchases by at least 2 distinct insiders within 30 calendar days outperform SPY over the next 63 trading days measured from public filing date.",
    economicRationale:
      "Multiple insiders buying with their own capital can indicate private confidence, but the test must use public filing dates and control for sector and size effects.",
    factorDefinition:
      "Signal equals 1 when distinct insider buyers >= 2, purchase count >= 3, and aggregate purchase value >= $250,000 over the prior 30 calendar days by filing date.",
    entryRules: ["Enter the research sample at the close after the qualifying public filing date."],
    exitRules: ["Exit after 63 trading days or when the factor no longer qualifies in a sensitivity test."],
    riskControls: ["Compare against SPY and sector ETF", "Cap single-name paper exposure if ever promoted beyond research"],
    decayConditions: ["No positive excess return after costs", "Signal only works in one sector", "Filing-date lag removes the edge"],
  },
  politician_trade_following: {
    title: "Delayed politician trade disclosure follow-through",
    hypothesis:
      "Stocks disclosed as politician purchases outperform SPY and QQQ over 21 to 126 trading days after disclosure date, net of realistic delay and crowding assumptions.",
    economicRationale:
      "Disclosures may reflect informed policy exposure or thematic positioning, but any edge must survive public disclosure delay and crowding.",
    factorDefinition:
      "Signal equals 1 after a public disclosure of a purchase, excluding ambiguous option/mixed transactions and using disclosure date rather than transaction date.",
    entryRules: ["Enter the research sample at the close after public disclosure is available."],
    exitRules: ["Exit at 21, 63, and 126 trading-day checkpoints for sensitivity analysis."],
    riskControls: ["Exclude illiquid names", "Benchmark against SPY and QQQ", "Track disclosure delay"],
    decayConditions: ["Performance disappears after disclosure delay", "Returns concentrate in a few viral names", "Crowding reverses the effect"],
  },
  unusual_options_flow: {
    title: "Unusual options alert follow-through after liquidity controls",
    hypothesis:
      "Equities with independently verified unusual options activity outperform their underlying benchmark over 5 to 20 trading days only when spreads, open interest, and news timing pass quality filters.",
    economicRationale:
      "Options flow can reflect informed demand, but alerts are often noisy, multi-leg, stale, or expensive to follow after spreads.",
    factorDefinition:
      "Signal equals 1 when options volume is unusually high versus open interest and history, bid-ask spread is acceptable, and the alert timestamp precedes the measured move.",
    entryRules: ["Enter only in the underlying equity research sample, never options, after the alert timestamp is observable."],
    exitRules: ["Exit after 5, 10, and 20 trading-day checkpoints or after the catalyst passes."],
    riskControls: ["Use equity-only paper simulation", "Include slippage", "Exclude wide-spread or low-liquidity underlyings"],
    decayConditions: ["Edge vanishes after transaction costs", "Alerts are mostly post-move", "Performance depends on one alert source"],
  },
  earnings_revision_momentum: {
    title: "Analyst revision momentum before earnings",
    hypothesis:
      "Stocks with positive net earnings estimate revisions and improving recommendation trends outperform sector ETFs over the next 1 to 3 months.",
    economicRationale:
      "Estimate revisions can proxy for improving fundamentals before they are fully reflected in price.",
    factorDefinition:
      "Signal ranks stocks by net positive EPS/revenue revisions and recommendation trend improvement over the prior 30 to 90 days.",
    entryRules: ["Enter the research sample after revision data is timestamped and available."],
    exitRules: ["Exit after earnings, after 63 trading days, or when revisions turn negative."],
    riskControls: ["Neutralize sector exposure", "Check earnings-date clustering", "Include realistic rebalance frequency"],
    decayConditions: ["Returns only appear before timestamp availability", "Effect collapses after sector adjustment", "Crowding reverses near earnings"],
  },
  social_research_density: {
    title: "High-quality social research density as a research-prior",
    hypothesis:
      "Tickers mentioned by at least 3 high-quality research sources within 7 days produce a better research hit rate than one-off social mentions, but should only create research tasks until independently validated.",
    economicRationale:
      "Repeated independent research mentions may identify themes worth investigating, while direct social trading is exposed to promotion and crowding risk.",
    factorDefinition:
      "Signal counts distinct high-quality sources, unique claims, and source reliability over a 7-day window, excluding promotional or duplicate posts.",
    entryRules: ["Open a research task only after source and claim deduplication."],
    exitRules: ["Remove from active research if no primary-source confirmation appears within 14 days."],
    riskControls: ["Never create BUY or SELL directly", "Require primary filings/news/fundamentals", "Flag promotion and duplicate narratives"],
    decayConditions: ["No primary-source confirmation", "Source reliability deteriorates", "Mentions become promotional or crowded"],
  },
  post_earnings_drift: {
    title: "Post-earnings drift after verified surprise",
    hypothesis:
      "Stocks with positive earnings surprise and constructive guidance outperform SPY, QQQ, and sector ETFs over 10 to 63 trading days after the earnings reaction.",
    economicRationale:
      "Markets can underreact to earnings information, especially when revisions and guidance confirm the surprise.",
    factorDefinition:
      "Signal equals 1 when reported surprise is positive, guidance is non-negative, and the post-event price reaction does not fully reverse within 2 trading days.",
    entryRules: ["Enter the research sample after earnings data, guidance notes, and next-close price are available."],
    exitRules: ["Exit after 10, 21, and 63 trading-day checkpoints or when guidance is contradicted."],
    riskControls: ["Use event-time timestamps", "Compare to sector ETF", "Track gap risk and liquidity"],
    decayConditions: ["Effect disappears after timestamp discipline", "Only works in one earnings season", "Returns reverse after transaction costs"],
  },
};

function buildQuantResearchRoadmap({ inputs, scoutOutput } = {}) {
  const signals = collectSignals(inputs, scoutOutput);
  const candidateFactorNames = identifyCandidateFactors(signals);
  const hypotheses = candidateFactorNames.map((factorName) => buildHypothesis(factorName, signals));
  const factorBacklog = getFactorLibrary();

  return {
    status: "research_scaffold_only",
    purpose: "Convert repeated investment ideas into testable factor hypotheses. Output research hypotheses, not trades.",
    orchestratorRoadmap: {
      status: "documented_placeholder",
      ideaStates: IDEA_STATES,
      currentState: hypotheses.length > 0 ? "hypothesis_created" : "captured",
      note: "Future versions should move ideas through an explicit state machine before paper or live use.",
    },
    hypothesisSchema: [
      "id",
      "title",
      "sourceSignals",
      "hypothesis",
      "economicRationale",
      "factorDefinition",
      "requiredData",
      "benchmark",
      "holdingPeriod",
      "entryRules",
      "exitRules",
      "riskControls",
      "decayConditions",
      "knownBiases",
      "validationStatus",
      "allowedAction",
      "canDirectlyTrade",
    ],
    hypotheses,
    factorBacklog,
    safetyRules: [
      "Factors cannot directly create BUY or SELL recommendations.",
      "Every factor must pass research, skeptic/challenger review, validation, portfolio review, deterministic Risk Engine checks, and human review before allocation use.",
      "No black-box live trading, brokerage execution, margin, options, crypto, or paid-data dependency is enabled here.",
    ],
    auditTrail: [
      {
        agent: "Quant Research Agent",
        action: "Mapped current ideas to research-only factor hypotheses",
        hypothesisCount: hypotheses.length,
        factorBacklogCount: factorBacklog.length,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function collectSignals(inputs = {}, scoutOutput = {}) {
  const insiderTransactions = inputs.raw?.insiderTransactions || [];
  const xSocialSignals = inputs.raw?.xSocialSignals || [];
  const researchQueue = scoutOutput.researchQueue || [];

  return {
    insiderTransactions,
    xSocialSignals,
    researchQueue,
    sourceTypes: new Set([
      ...researchQueue.map((task) => task.sourceType),
      ...(insiderTransactions.length > 0 ? ["insider_transactions"] : []),
      ...(xSocialSignals.length > 0 ? ["x_social"] : []),
    ]),
    categories: new Set(xSocialSignals.map((signal) => signal.category).filter(Boolean)),
  };
}

function identifyCandidateFactors(signals) {
  const names = new Set();

  if (signals.insiderTransactions.length > 0) names.add("insider_cluster_buying");
  if (signals.xSocialSignals.length > 0) names.add("social_research_density");
  if (signals.categories.has("politician_trading")) names.add("politician_trade_following");
  if (signals.categories.has("unusual_options_flow")) names.add("unusual_options_flow");
  if (signals.categories.has("earnings_catalyst")) names.add("post_earnings_drift");

  return [...names];
}

function buildHypothesis(factorName, signals) {
  const factor = getFactorByName(factorName);
  const sourceCount = countSourcesForFactor(factor, signals);
  const template = HYPOTHESIS_TEMPLATES[factor.name] || buildFallbackTemplate(factor);

  return {
    id: `factor-hypothesis-${factor.name}`,
    title: template.title,
    factorName: factor.name,
    sourceSignals: buildSourceSignals(factor, signals),
    hypothesis: template.hypothesis,
    economicRationale: template.economicRationale,
    factorDefinition: template.factorDefinition,
    rationale: buildRationale(factor, sourceCount),
    requiredData: [...factor.requiredData],
    benchmark: factor.benchmark,
    holdingPeriod: factor.expectedHoldingPeriod,
    entryRules: [...template.entryRules],
    exitRules: [...template.exitRules],
    riskControls: [...template.riskControls],
    decayConditions: [...template.decayConditions],
    expectedEdge: "Unknown. Must be estimated through out-of-sample research before any portfolio use.",
    knownBiases: [...factor.knownBiases],
    validationStatus: "not_started",
    allowedAction: "research_only",
    paperTradingStatus: "research_only",
    canDirectlyTrade: false,
    sourceTypes: [...factor.sourceTypes],
    observedToday: sourceCount,
    sourceTrail: [
      {
        source: "Quant Research Agent",
        detail: "Hypothesis generated from current committee signals for future validation only.",
      },
    ],
  };
}

function buildSourceSignals(factor, signals) {
  const sourceSignals = [];

  if (factor.sourceTypes.includes("insider_transactions") && signals.insiderTransactions.length > 0) {
    sourceSignals.push({
      sourceType: "insider_transactions",
      count: signals.insiderTransactions.length,
      note: "Raw insider records observed in today's Data Agent inputs.",
    });
  }

  if (factor.sourceTypes.includes("x_social") && signals.xSocialSignals.length > 0) {
    sourceSignals.push({
      sourceType: "x_social",
      count: signals.xSocialSignals.length,
      note: "X/social signals are research-only idea inputs and cannot directly create trades.",
    });
  }

  if (factor.sourceTypes.includes("fundamentals") && signals.researchQueue.length > 0) {
    sourceSignals.push({
      sourceType: "fundamentals",
      count: signals.researchQueue.length,
      note: "Fundamental enrichment may support future factor validation after timestamp checks.",
    });
  }

  return sourceSignals;
}

function buildFallbackTemplate(factor) {
  return {
    title: `${factor.name} research hypothesis`,
    hypothesis: `${factor.description} The effect must outperform ${factor.benchmark} over ${factor.expectedHoldingPeriod} in an out-of-sample validation set.`,
    economicRationale: "Economic rationale must be documented before this factor can move beyond research-only status.",
    factorDefinition: `Transparent factor definition based on ${factor.sourceTypes.join(", ")} inputs and timestamped data availability.`,
    entryRules: ["Define entry only after all required data is observable at decision time."],
    exitRules: ["Define exit by a pre-registered holding period before validation."],
    riskControls: ["Compare against benchmark", "Check sector concentration", "Include transaction costs"],
    decayConditions: ["No out-of-sample edge", "Weak economic rationale", "Unstable performance across regimes"],
  };
}

function countSourcesForFactor(factor, signals) {
  if (!factor) return 0;

  let count = 0;
  if (factor.sourceTypes.includes("insider_transactions")) count += signals.insiderTransactions.length;
  if (factor.sourceTypes.includes("x_social")) count += signals.xSocialSignals.length;
  if (factor.sourceTypes.includes("fundamentals")) {
    count += signals.researchQueue.filter((task) => task.sourceType === "insider_transactions" || task.sourceType === "x_social").length;
  }
  return count;
}

function buildRationale(factor, sourceCount) {
  return `${factor.description} Observed ${sourceCount} related input(s) today; treat this as a hypothesis prompt, not evidence of edge.`;
}

module.exports = {
  ALLOWED_ACTIONS,
  IDEA_STATES,
  buildQuantResearchRoadmap,
};
