function challengeTheses(theses) {
  const reviewedTheses = theses.map(challengeThesis);

  return {
    reviewedTheses,
    auditTrail: [
      {
        agent: "Skeptic Agent",
        action: "Challenged every thesis before allocation review",
        reviewedCount: reviewedTheses.length,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function challengeThesis(thesis) {
  const objections = [];
  const metric = thesis.evidence.fundamentals?.metric || {};
  const profile = thesis.evidence.profile || {};
  const insiderScore = thesis.evidence.insiderScore;
  const pe = metric.peNormalizedAnnual ?? metric.peTTM;

  objections.push({
    severity: "medium",
    category: "verification",
    objection: "The thesis is based on a daily data pull and has not been checked against the latest filings, news, transcript context, or price action.",
  });

  if (thesis.sourceType === "x_social") {
    objections.push({
      severity: "blocker",
      category: "source_quality",
      objection: "Social/media activity is research-only and cannot directly support an allocation recommendation.",
    });
  }

  if (!profile.name || Object.keys(metric).length === 0) {
    objections.push({
      severity: "blocker",
      category: "stale_or_missing_data",
      objection: "Fundamental enrichment is missing or incomplete.",
    });
  }

  if (pe != null && Number(pe) > 45) {
    objections.push({
      severity: "high",
      category: "valuation",
      objection: `Valuation may already discount strong outcomes; P/E is ${Number(pe).toFixed(1)}.`,
    });
  }

  if (profile.marketCapitalization != null && Number(profile.marketCapitalization) < 1000) {
    objections.push({
      severity: "high",
      category: "liquidity",
      objection: "Market capitalization appears below $1B, which may introduce liquidity and manipulation risk.",
    });
  }

  if (insiderScore && insiderScore.uniqueInsiders < 2) {
    objections.push({
      severity: "medium",
      category: "signal_quality",
      objection: "Insider signal may rely on a single insider rather than a broad cluster.",
    });
  }

  if (thesis.evidence.fetchErrors?.length > 0) {
    objections.push({
      severity: "high",
      category: "data_quality",
      objection: "One or more data enrichment calls failed.",
    });
  }

  const hasBlocker = objections.some((item) => item.severity === "blocker");

  return {
    ...thesis,
    skepticReview: {
      objections,
      allocationAllowed: !hasBlocker,
      decision: hasBlocker ? "NEEDS_MORE_RESEARCH" : "CAN_PROCEED_TO_RISK_REVIEW",
    },
  };
}

module.exports = { challengeTheses };
