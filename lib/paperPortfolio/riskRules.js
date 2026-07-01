const ALLOWED_PAPER_ACTIONS = [
  "PAPER BUY CANDIDATE",
  "PAPER HOLD",
  "PAPER REDUCE / TRIM CANDIDATE",
  "AVOID",
  "WATCH",
];

function buildPortfolioRiskSnapshot(portfolio) {
  const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  const theme_weights = {};
  const single_name_violations = [];

  for (const holding of holdings) {
    const theme = holding.theme || "Unknown";
    theme_weights[theme] = round((theme_weights[theme] || 0) + Number(holding.current_mock_weight_pct || 0));

    if (holding.current_mock_weight_pct > portfolio.rules.max_single_name_weight_pct) {
      single_name_violations.push({
        ticker: holding.ticker,
        current_mock_weight_pct: holding.current_mock_weight_pct,
        max_single_name_weight_pct: portfolio.rules.max_single_name_weight_pct,
      });
    }
  }

  const theme_violations = Object.entries(theme_weights)
    .filter(([, value]) => value > portfolio.rules.max_theme_weight_pct)
    .map(([theme, current_mock_weight_pct]) => ({
      theme,
      current_mock_weight_pct,
      max_theme_weight_pct: portfolio.rules.max_theme_weight_pct,
    }));

  return {
    theme_weights,
    single_name_violations,
    theme_violations,
  };
}

function evaluatePaperActionRisk({ paperAction, watchlistItem, holding, portfolio }) {
  const rules = portfolio.rules;
  const checks = [];
  const violations = [];
  const themeWeight = buildPortfolioRiskSnapshot(portfolio).theme_weights[watchlistItem.primary_theme] || 0;
  const currentWeight = holding ? holding.current_mock_weight_pct : 0;

  check(ALLOWED_PAPER_ACTIONS.includes(paperAction), "Paper action label is allowed.", "Paper action label is not allowed.", checks, violations);
  check(portfolio.paper_only === true, "Portfolio fixture is marked paper-only.", "Portfolio fixture is not marked paper-only.", checks, violations);
  check(portfolio.simulated === true, "Portfolio fixture is simulated.", "Portfolio fixture is not marked simulated.", checks, violations);
  check(rules.live_trading_enabled === false, "Live trading flag is disabled.", "Live trading flag is enabled.", checks, violations);
  check(rules.brokerage_integration_enabled === false, "Brokerage integration flag is disabled.", "Brokerage integration flag is enabled.", checks, violations);
  check(rules.automated_ordering_enabled === false, "Automated ordering flag is disabled.", "Automated ordering flag is enabled.", checks, violations);
  check(rules.production_storage_enabled === false, "Production storage flag is disabled.", "Production storage flag is enabled.", checks, violations);
  check(!rules.blocked_asset_classes.includes(watchlistItem.asset_class), "Asset class is not blocked.", `Asset class is blocked: ${watchlistItem.asset_class}`, checks, violations);

  if (paperAction === "PAPER BUY CANDIDATE") {
    check(!holding, "Ticker is not already in the sample portfolio.", "Ticker already has sample paper exposure.", checks, violations);
    check(portfolio.cash_weight_pct > 0, "Sample portfolio has cash available for paper review.", "Sample portfolio has no cash available for paper review.", checks, violations);
    check(themeWeight < rules.max_theme_weight_pct, "Current theme exposure is below max theme rule.", "Current theme exposure is at or above max theme rule.", checks, violations);
  }

  if (paperAction === "PAPER HOLD") {
    check(Boolean(holding), "Ticker exists in the sample paper portfolio.", "Ticker is not currently in the sample paper portfolio.", checks, violations);
    check(currentWeight <= rules.max_single_name_weight_pct, "Current mock weight is within single-name rule.", "Current mock weight exceeds single-name rule.", checks, violations);
  }

  if (paperAction === "PAPER REDUCE / TRIM CANDIDATE") {
    check(Boolean(holding), "Ticker exists in the sample paper portfolio.", "Ticker is not currently in the sample paper portfolio.", checks, violations);
    check(
      currentWeight > rules.max_single_name_weight_pct || hasHighRiskBurden(watchlistItem),
      "Paper trim candidate is tied to concentration or high risk burden.",
      "Paper trim candidate lacks a rule-based reason.",
      checks,
      violations
    );
  }

  if (paperAction === "AVOID") {
    check(
      hasHighRiskBurden(watchlistItem) || rules.blocked_asset_classes.includes(watchlistItem.asset_class),
      "Avoid label is tied to high risk burden or blocked asset-class rule.",
      "Avoid label lacks a rule-based reason.",
      checks,
      violations
    );
  }

  return {
    passed: violations.length === 0,
    decision: violations.length === 0 ? "pass" : "fail",
    checks,
    violations,
    manual_review_required: true,
    rules_evaluated: {
      max_single_name_weight_pct: rules.max_single_name_weight_pct,
      max_theme_weight_pct: rules.max_theme_weight_pct,
      blocked_asset_classes: rules.blocked_asset_classes,
      live_trading_enabled: rules.live_trading_enabled,
      brokerage_integration_enabled: rules.brokerage_integration_enabled,
      automated_ordering_enabled: rules.automated_ordering_enabled,
      production_storage_enabled: rules.production_storage_enabled,
    },
  };
}

function choosePaperAction(watchlistItem, holding, portfolio) {
  const rules = portfolio.rules;
  const score = Number(watchlistItem.committee_score || 0);
  const highRiskBurden = hasHighRiskBurden(watchlistItem);
  const blockedAssetClass = rules.blocked_asset_classes.includes(watchlistItem.asset_class);

  if (blockedAssetClass) return "AVOID";
  if (holding && holding.current_mock_weight_pct > rules.max_single_name_weight_pct) {
    return "PAPER REDUCE / TRIM CANDIDATE";
  }
  if (highRiskBurden && score < 50) return "AVOID";
  if (holding && score >= 55) return "PAPER HOLD";
  if (!holding && score >= 78 && watchlistItem.evidence.length >= 2 && watchlistItem.missing_verification.length <= 2) {
    return "PAPER BUY CANDIDATE";
  }
  return "WATCH";
}

function hasHighRiskBurden(watchlistItem) {
  const riskText = `${watchlistItem.risk_skeptic_lens} ${watchlistItem.missing_verification.join(" ")}`.toLowerCase();
  return watchlistItem.missing_verification.length >= 4 ||
    riskText.includes("crypto") ||
    riskText.includes("financing") ||
    riskText.includes("dilution") ||
    riskText.includes("concentration breach");
}

function check(condition, passedMessage, failedMessage, checks, violations) {
  if (condition) {
    checks.push(passedMessage);
  } else {
    checks.push(failedMessage);
    violations.push(failedMessage);
  }
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  ALLOWED_PAPER_ACTIONS,
  buildPortfolioRiskSnapshot,
  choosePaperAction,
  evaluatePaperActionRisk,
};
