function runMonitoringReview({ inputs, quantResearchOutput, backtestValidationOutput, modelRiskOutput } = {}) {
  const xSignals = inputs?.raw?.xSocialSignals || [];
  const insiderTransactions = inputs?.raw?.insiderTransactions || [];
  const hypotheses = quantResearchOutput?.hypotheses || [];
  const modelRiskFlags = modelRiskOutput?.flags || [];

  return {
    status: "placeholder_only",
    purpose: "Future monitoring should watch signal, performance, data, and process health before any strategy promotion. This is placeholder reporting, not live model monitoring.",
    monitoringChecks: [
      "signal health",
      "performance health",
      "data health",
      "drawdown breaches",
      "Sharpe degradation",
      "signal inactivity",
      "stale/missing inputs",
      "human-review escalation",
    ],
    healthSnapshot: {
      signalHealth: hypotheses.length > 0 ? "hypotheses_observed" : "no_factor_hypotheses_today",
      dataHealth: insiderTransactions.length > 0 || xSignals.length > 0 ? "inputs_observed" : "no_inputs_observed",
      validationHealth: backtestValidationOutput?.status || "not_started",
      modelRiskHealth: modelRiskFlags.some((flag) => flag.severity === "blocker") ? "blocker_flagged" : "advisory_only",
      performanceHealth: "not_available_until_paper_history_exists",
    },
    escalationRules: [
      "Escalate to human review when model-risk blockers appear.",
      "Escalate to human review when signal inactivity or stale inputs persist.",
      "Escalate to human review when paper drawdown, Sharpe degradation, or benchmark underperformance breaches are detected.",
    ],
    humanReviewRequired: true,
    canDirectlyTrade: false,
    auditTrail: [
      {
        agent: "Monitoring Agent",
        action: "Recorded placeholder monitoring requirements for future factor and paper-strategy health checks",
        monitoringCheckCount: 8,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { runMonitoringReview };
