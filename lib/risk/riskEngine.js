const DEFAULT_RULES = {
  noLiveTrading: true,
  noMargin: true,
  noOptions: true,
  noCrypto: true,
  maxSinglePositionTargetWeightPct: 5,
  maxNewPositionsPerDay: 3,
  maxDailyTurnoverPct: 15,
  maxSectorConcentrationPct: 25,
  maxThemeConcentrationPct: 25,
};

function runRiskReview(recommendations, portfolioSnapshot, overrides = {}) {
  const rules = { ...DEFAULT_RULES, ...removeUndefined(overrides) };
  const sorted = [...recommendations].sort((a, b) => b.confidence - a.confidence);
  const approvedPaperTrades = [];
  const rejectedRecommendations = [];
  const resizedRecommendations = [];
  const auditTrail = [];

  let newPositions = 0;
  let projectedTurnoverPct = 0;
  const projectedPositions = new Map((portfolioSnapshot.positions || []).map((position) => [position.ticker, { ...position }]));

  for (const recommendation of sorted) {
    const checks = validateHardRules(recommendation, rules);
    if (checks.length > 0) {
      rejectedRecommendations.push(reject(recommendation, checks));
      continue;
    }

    if (!["BUY", "SELL", "HOLD"].includes(recommendation.action)) {
      approvedPaperTrades.push({ ...recommendation, riskDecision: "NO_TRADE_WATCHLIST" });
      continue;
    }

    const currentWeight = projectedPositions.get(recommendation.ticker)?.weightPct || 0;
    const isNewBuy = recommendation.action === "BUY" && currentWeight === 0;

    if (isNewBuy && newPositions >= rules.maxNewPositionsPerDay) {
      rejectedRecommendations.push(reject(recommendation, [`Max new positions per day is ${rules.maxNewPositionsPerDay}`]));
      continue;
    }

    const resized = resizeRecommendation(recommendation, projectedPositions, currentWeight, rules);
    const turnoverImpact = Math.abs((resized.targetWeightPct || 0) - currentWeight);

    if (projectedTurnoverPct + turnoverImpact > rules.maxDailyTurnoverPct) {
      rejectedRecommendations.push(reject(recommendation, [`Max daily turnover is ${rules.maxDailyTurnoverPct}%`]));
      continue;
    }

    if (resized.targetWeightPct !== recommendation.targetWeightPct) {
      resizedRecommendations.push({
        ticker: recommendation.ticker,
        fromTargetWeightPct: recommendation.targetWeightPct,
        toTargetWeightPct: resized.targetWeightPct,
        reason: resized.resizeReason,
      });
    }

    projectedTurnoverPct += turnoverImpact;
    if (isNewBuy && resized.targetWeightPct > 0) newPositions += 1;

    if (resized.action === "SELL" || resized.targetWeightPct === 0) {
      projectedPositions.delete(resized.ticker);
    } else {
      projectedPositions.set(resized.ticker, {
        ticker: resized.ticker,
        weightPct: resized.targetWeightPct,
        sector: resized.sector,
        theme: resized.theme,
      });
    }

    approvedPaperTrades.push({
      ...resized,
      riskDecision: resized.resizeReason ? "APPROVED_RESIZED" : "APPROVED",
    });
  }

  auditTrail.push({
    agent: "Risk Engine",
    action: "Applied deterministic hard rules",
    approvedCount: approvedPaperTrades.length,
    rejectedCount: rejectedRecommendations.length,
    resizedCount: resizedRecommendations.length,
    projectedTurnoverPct: round(projectedTurnoverPct),
    timestamp: new Date().toISOString(),
  });

  return {
    rules,
    approvedPaperTrades,
    rejectedRecommendations,
    resizedRecommendations,
    projectedTurnoverPct: round(projectedTurnoverPct),
    auditTrail,
    safetyNotice: "Paper portfolio only. No brokerage integration, margin, options, crypto, or live trading.",
  };
}

function validateHardRules(recommendation, rules) {
  const violations = [];
  if (rules.noLiveTrading && recommendation.execution !== "none") {
    violations.push("Live execution is prohibited");
  }
  if (!recommendation.paperOnly) {
    violations.push("Recommendation is not marked paperOnly");
  }
  if (rules.noOptions && recommendation.instrumentType === "option") {
    violations.push("Options are prohibited");
  }
  if (rules.noCrypto && recommendation.instrumentType === "crypto") {
    violations.push("Crypto is prohibited");
  }
  if (rules.noMargin && recommendation.usesMargin) {
    violations.push("Margin is prohibited");
  }
  return violations;
}

function resizeRecommendation(recommendation, projectedPositions, currentWeight, rules) {
  let targetWeightPct = Math.min(recommendation.targetWeightPct || 0, rules.maxSinglePositionTargetWeightPct);
  const resizeReasons = [];

  if (targetWeightPct !== recommendation.targetWeightPct) {
    resizeReasons.push(`Single-position cap is ${rules.maxSinglePositionTargetWeightPct}%`);
  }

  const sectorCapacity = remainingGroupCapacity(projectedPositions, "sector", recommendation.sector, rules.maxSectorConcentrationPct, recommendation.ticker);
  if (targetWeightPct > sectorCapacity) {
    targetWeightPct = Math.max(sectorCapacity, 0);
    resizeReasons.push(`Sector concentration cap is ${rules.maxSectorConcentrationPct}%`);
  }

  const themeCapacity = remainingGroupCapacity(projectedPositions, "theme", recommendation.theme, rules.maxThemeConcentrationPct, recommendation.ticker);
  if (targetWeightPct > themeCapacity) {
    targetWeightPct = Math.max(themeCapacity, 0);
    resizeReasons.push(`Theme concentration cap is ${rules.maxThemeConcentrationPct}%`);
  }

  return {
    ...recommendation,
    targetWeightPct: round(targetWeightPct),
    resizeReason: resizeReasons.join("; "),
  };
}

function remainingGroupCapacity(projectedPositions, key, value, cap, ticker) {
  if (!value || value === "Unknown") return cap;

  let existingWeight = 0;
  for (const position of projectedPositions.values()) {
    if (position.ticker !== ticker && position[key] === value) existingWeight += Number(position.weightPct) || 0;
  }

  return cap - existingWeight;
}

function reject(recommendation, reasons) {
  return {
    ...recommendation,
    riskDecision: "REJECTED",
    rejectionReasons: reasons,
  };
}

function removeUndefined(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = { runRiskReview, DEFAULT_RULES };
