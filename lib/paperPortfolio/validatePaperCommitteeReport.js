const { ALLOWED_PAPER_ACTIONS } = require("./riskRules");

const REPORT_SCHEMA_VERSION = "paper_portfolio_committee_report_v0";
const ACTION_SCHEMA_VERSION = "paper_portfolio_committee_action_v0";

const REQUIRED_ACTION_FIELDS = [
  "ticker",
  "company_name",
  "paper_action",
  "action_rationale",
  "evidence",
  "what_changed",
  "why_it_may_matter",
  "risk_skeptic_case",
  "missing_verification",
  "risk_engine",
  "manual_review_items",
  "generated_at",
  "schema_version",
];

const BLOCKED_REAL_MONEY_PATTERNS = [
  /buy this with real money/i,
  /sell this from your brokerage account/i,
  /execute trade/i,
  /place order/i,
  /rebalance your actual portfolio/i,
  /guaranteed returns/i,
  /use margin/i,
  /margin recommendation/i,
  /options recommendation/i,
  /crypto recommendation/i,
  /brokerage account/i,
  /actual money/i,
];

function validatePaperCommitteeReport(report) {
  const errors = [];
  const warnings = [];

  if (!report || typeof report !== "object") {
    return { passed: false, errors: ["Report must be an object."], warnings };
  }

  if (report.schema_version !== REPORT_SCHEMA_VERSION) errors.push("Top-level schema_version mismatch.");
  if (report.mode !== "local_dry_run") errors.push("mode must be local_dry_run.");
  if (!report.generated_at) errors.push("generated_at is required.");
  if (!Array.isArray(report.actions) || report.actions.length === 0) errors.push("actions must be a non-empty array.");
  if (report.safety?.paper_simulated_only !== true) errors.push("safety.paper_simulated_only must be true.");
  if (report.safety?.real_money_advice_provided !== false) errors.push("safety.real_money_advice_provided must be false.");
  if (report.safety?.live_trading_enabled !== false) errors.push("safety.live_trading_enabled must be false.");
  if (report.safety?.brokerage_integration_enabled !== false) errors.push("safety.brokerage_integration_enabled must be false.");
  if (report.safety?.automated_ordering_enabled !== false) errors.push("safety.automated_ordering_enabled must be false.");
  if (report.safety?.margin_enabled !== false) errors.push("safety.margin_enabled must be false.");
  if (report.safety?.options_enabled !== false) errors.push("safety.options_enabled must be false.");
  if (report.safety?.crypto_enabled !== false) errors.push("safety.crypto_enabled must be false.");
  if (report.safety?.production_storage_written !== false) errors.push("safety.production_storage_written must be false.");

  const blockedLanguagePaths = findBlockedRealMoneyLanguage(report);
  if (blockedLanguagePaths.length > 0) {
    errors.push(`Blocked real-money language found: ${blockedLanguagePaths.join(", ")}`);
  }

  if (Array.isArray(report.actions)) {
    report.actions.forEach((action, index) => {
      validateAction(action, index, errors, warnings);
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    action_count: Array.isArray(report.actions) ? report.actions.length : 0,
    blocked_language_paths: blockedLanguagePaths,
  };
}

function validateAction(action, index, errors, warnings) {
  for (const field of REQUIRED_ACTION_FIELDS) {
    if (action[field] === undefined) errors.push(`actions[${index}] missing required field: ${field}`);
  }

  if (action.schema_version !== ACTION_SCHEMA_VERSION) {
    errors.push(`actions[${index}].schema_version mismatch.`);
  }
  if (!ALLOWED_PAPER_ACTIONS.includes(action.paper_action)) {
    errors.push(`actions[${index}].paper_action is not allowed: ${action.paper_action}`);
  }
  if (!Array.isArray(action.action_rationale) || action.action_rationale.length === 0) {
    errors.push(`actions[${index}].action_rationale must be non-empty.`);
  }
  if (!Array.isArray(action.risk_skeptic_case) || action.risk_skeptic_case.length === 0) {
    errors.push(`actions[${index}].risk_skeptic_case must be non-empty.`);
  }
  if (!Array.isArray(action.manual_review_items) || action.manual_review_items.length === 0) {
    errors.push(`actions[${index}].manual_review_items must be non-empty.`);
  }
  if (!Array.isArray(action.what_changed) || action.what_changed.length === 0) {
    errors.push(`actions[${index}].what_changed must be non-empty.`);
  }
  if (!Array.isArray(action.why_it_may_matter) || action.why_it_may_matter.length === 0) {
    errors.push(`actions[${index}].why_it_may_matter must be non-empty.`);
  }
  if (!Array.isArray(action.evidence) || action.evidence.length === 0) {
    errors.push(`actions[${index}].evidence must include links or unavailable markers.`);
  }
  if (!Array.isArray(action.missing_verification)) {
    errors.push(`actions[${index}].missing_verification must be an array.`);
  }
  if (typeof action.risk_engine?.passed !== "boolean") {
    errors.push(`actions[${index}].risk_engine.passed must be boolean.`);
  }
  if (!["pass", "fail"].includes(action.risk_engine?.decision)) {
    errors.push(`actions[${index}].risk_engine.decision must be pass or fail.`);
  }
  if (action.safety?.paper_simulated_only !== true) errors.push(`actions[${index}].safety.paper_simulated_only must be true.`);
  if (action.safety?.real_money_instruction !== false) errors.push(`actions[${index}].safety.real_money_instruction must be false.`);
  if (action.safety?.automated_order_created !== false) errors.push(`actions[${index}].safety.automated_order_created must be false.`);

  if (action.paper_action === "PAPER BUY CANDIDATE" && action.current_mock_weight_pct > 0) {
    warnings.push(`actions[${index}] is a paper buy candidate despite existing mock exposure.`);
  }
}

function findBlockedRealMoneyLanguage(value, currentPath = "report") {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBlockedRealMoneyLanguage(item, `${currentPath}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => findBlockedRealMoneyLanguage(child, `${currentPath}.${key}`));
  }
  if (typeof value !== "string") return [];

  const withoutAllowedPaperLabels = ALLOWED_PAPER_ACTIONS.reduce(
    (text, label) => text.replaceAll(label, ""),
    value
  );

  if (BLOCKED_REAL_MONEY_PATTERNS.some((pattern) => pattern.test(withoutAllowedPaperLabels))) {
    return [currentPath];
  }
  if (/\b(BUY|SELL|HOLD)\b/i.test(withoutAllowedPaperLabels)) {
    return [currentPath];
  }

  return [];
}

module.exports = {
  ACTION_SCHEMA_VERSION,
  BLOCKED_REAL_MONEY_PATTERNS,
  REPORT_SCHEMA_VERSION,
  REQUIRED_ACTION_FIELDS,
  validatePaperCommitteeReport,
};
