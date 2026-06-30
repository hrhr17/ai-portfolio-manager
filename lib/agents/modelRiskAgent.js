function reviewModelRisk(quantResearchOutput = {}, validationOutput = {}) {
  const hypotheses = quantResearchOutput.hypotheses || [];
  const flags = [];
  const challengeChecklist = [
    "look-ahead bias",
    "survivorship bias",
    "overfitting",
    "data leakage",
    "multiple comparisons",
    "weak sample size",
    "transaction cost realism",
    "regime dependency",
    "factor crowding",
    "missing economic rationale",
  ];

  for (const hypothesis of hypotheses) {
    flags.push({
      factorName: hypothesis.factorName,
      severity: "medium",
      category: "unvalidated_factor",
      concern: "Factor hypothesis has not been backtested or reviewed out of sample.",
    });

    if ((hypothesis.observedToday || 0) < 30) {
      flags.push({
        factorName: hypothesis.factorName,
        severity: "high",
        category: "weak_sample_size",
        concern: "Observed signal count is too small for statistical confidence.",
      });
    }

    if (!hypothesis.economicRationale || hypothesis.economicRationale.includes("must be documented")) {
      flags.push({
        factorName: hypothesis.factorName,
        severity: "high",
        category: "missing_economic_rationale",
        concern: "Economic rationale is missing or too generic for model promotion.",
      });
    }

    if (hypothesis.canDirectlyTrade !== false || hypothesis.allowedAction !== "research_only") {
      flags.push({
        factorName: hypothesis.factorName,
        severity: "blocker",
        category: "unsafe_action_scope",
        concern: "Factor hypothesis must remain research-only and cannot directly trade.",
      });
    }
  }

  return {
    status: "placeholder_only",
    purpose: "Adversarially challenge factor hypotheses before they can move beyond research-only status.",
    challengeChecklist,
    globalRisks: [...challengeChecklist, "spurious correlation", "black-box reasoning"],
    flags,
    validationStatus: validationOutput.status || "not_started",
    canDirectlyTrade: false,
    auditTrail: [
      {
        agent: "Model Risk Agent",
        action: "Flagged placeholder model-risk concerns for factor hypotheses",
        flagCount: flags.length,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { reviewModelRisk };
