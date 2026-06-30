function buildPaperRecommendations(reviewedTheses, portfolioSnapshot) {
  const recommendations = reviewedTheses.map((thesis) => buildRecommendation(thesis, portfolioSnapshot));

  return {
    recommendations,
    rejectedIdeas: recommendations
      .filter((recommendation) => recommendation.action === "WATCH" && recommendation.blockedBySkeptic)
      .map((recommendation) => ({
        ticker: recommendation.ticker,
        reason: "Skeptic Agent blocked allocation review",
        objections: recommendation.skepticObjections,
        sourceTrail: recommendation.sourceTrail,
      })),
    auditTrail: [
      {
        agent: "Portfolio Manager Agent",
        action: "Converted reviewed theses into paper-portfolio recommendations",
        recommendationCount: recommendations.length,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function buildRecommendation(thesis, portfolioSnapshot) {
  const currentPosition = findPosition(portfolioSnapshot, thesis.ticker);
  const blockedBySkeptic = !thesis.skepticReview.allocationAllowed;
  const confidence = calculateConfidence(thesis);
  const action = chooseAction(thesis, currentPosition, confidence, blockedBySkeptic);
  const targetWeightPct = chooseTargetWeight(action, confidence, currentPosition);

  return {
    id: `paper-${action.toLowerCase()}-${thesis.ticker}`,
    paperOnly: true,
    execution: "none",
    instrumentType: "equity",
    ticker: thesis.ticker,
    action,
    targetWeightPct,
    confidence,
    thesis: thesis.catalyst,
    reasoning: buildReasoning(thesis, confidence),
    riskNotes: thesis.risk,
    catalyst: thesis.catalyst,
    reviewTrigger: buildReviewTrigger(thesis),
    sector: thesis.evidence.profile?.finnhubIndustry || "Unknown",
    theme: thesis.sourceType === "insider_transactions" ? "Insider activity" : thesis.theme || "Research watchlist",
    sourceTrail: thesis.sourceTrail,
    skepticObjections: thesis.skepticReview.objections,
    blockedBySkeptic,
  };
}

function chooseAction(thesis, currentPosition, confidence, blockedBySkeptic) {
  if (blockedBySkeptic) return "WATCH";
  if (currentPosition && confidence < 0.45) return "SELL";
  if (currentPosition) return "HOLD";
  if (thesis.priority === "HIGH" && confidence >= 0.6) return "BUY";
  return "WATCH";
}

function chooseTargetWeight(action, confidence, currentPosition) {
  if (action === "SELL" || action === "WATCH") return 0;
  if (action === "HOLD") return Number(currentPosition?.weightPct || 0);
  if (confidence >= 0.75) return 5;
  if (confidence >= 0.65) return 4;
  return 3;
}

function calculateConfidence(thesis) {
  let confidence = 0.4;
  const inputs = thesis.confidenceInputs;

  if (inputs.signalPriority === "HIGH") confidence += 0.16;
  if (inputs.signalPriority === "MEDIUM") confidence += 0.08;
  if (inputs.insiderScore != null) confidence += Math.min(inputs.insiderScore * 0.04, 0.2);
  if (inputs.hasProfile) confidence += 0.04;
  if (inputs.hasFundamentals) confidence += 0.04;
  if (Number(inputs.latestEarningsSurprise) > 0) confidence += 0.03;

  const highOrWorseObjections = thesis.skepticReview.objections.filter((item) =>
    ["high", "blocker"].includes(item.severity)
  ).length;
  confidence -= highOrWorseObjections * 0.08;

  return clamp(round(confidence), 0.1, 0.85);
}

function buildReasoning(thesis, confidence) {
  return [
    thesis.businessSummary,
    `Valuation context: ${thesis.valuationContext}`,
    `Confidence is ${Math.round(confidence * 100)}% after skeptic objections.`,
  ].join(" ");
}

function buildReviewTrigger(thesis) {
  if (thesis.sourceType === "insider_transactions") {
    return "Review after new insider filings, earnings update, valuation move above risk threshold, or thesis contradiction.";
  }

  return "Review only after social signal is verified by primary sources, filings, news, and fundamentals.";
}

function findPosition(portfolioSnapshot, ticker) {
  return (portfolioSnapshot.positions || []).find((position) => position.ticker === ticker);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { buildPaperRecommendations };
