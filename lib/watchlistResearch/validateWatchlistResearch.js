const DIGEST_SCHEMA_VERSION = "watchlist_research_digest_v0";
const TICKER_SCHEMA_VERSION = "watchlist_research_ticker_v0";

const FORBIDDEN_FIELD_NAMES = new Set([
  "action",
  "recommendation",
  "recommendations",
  "portfolio_recommendation",
  "trade_recommendation",
  "target_weight",
  "targetWeight",
  "allocation",
  "allocation_size",
  "price_target",
  "target_price",
  "order",
  "order_size",
  "orderSize",
  "broker",
  "broker_action",
  "brokerAction",
  "execution",
  "execution_instruction",
  "executionInstruction",
  "trade",
  "quantity",
  "shares",
  "margin",
  "option",
  "options",
  "crypto",
  "rebalance",
  "rebalancing",
]);

const REQUIRED_TICKER_FIELDS = [
  "ticker",
  "company_name",
  "research_priority_rank",
  "research_priority_tier",
  "research_priority_score",
  "what_changed",
  "why_it_may_matter",
  "evidence",
  "missing_or_unverified_claims",
  "upcoming_earnings_or_catalysts",
  "manual_review_queue",
  "generated_at",
  "input_source_file",
  "schema_version",
  "metadata",
  "safety",
];

function validateWatchlistResearchDigest(digest) {
  const errors = [];
  const warnings = [];

  if (!digest || typeof digest !== "object") {
    return { passed: false, errors: ["Digest must be an object."], warnings };
  }

  if (digest.schema_version !== DIGEST_SCHEMA_VERSION) errors.push("Top-level schema_version mismatch.");
  if (digest.mode !== "local_dry_run") errors.push("mode must be local_dry_run.");
  if (!digest.generated_at) errors.push("generated_at is required.");
  if (!Array.isArray(digest.tickers) || digest.tickers.length === 0) errors.push("tickers must be a non-empty array.");
  if (digest.safety?.research_only !== true) errors.push("safety.research_only must be true.");
  if (digest.safety?.local_dry_run_only !== true) errors.push("safety.local_dry_run_only must be true.");
  if (digest.safety?.live_apis_called !== false) errors.push("safety.live_apis_called must be false.");
  if (digest.safety?.external_network_called !== false) errors.push("safety.external_network_called must be false.");
  if (digest.safety?.llm_used !== false) errors.push("safety.llm_used must be false.");
  if (digest.safety?.portfolio_written !== false) errors.push("safety.portfolio_written must be false.");
  if (digest.safety?.production_storage_written !== false) errors.push("safety.production_storage_written must be false.");

  const forbiddenFieldPaths = findForbiddenFieldNames(digest);
  if (forbiddenFieldPaths.length > 0) {
    errors.push(`Forbidden field names found: ${forbiddenFieldPaths.join(", ")}`);
  }

  const unsafeLanguagePaths = findUnsafeOutputLanguage(digest);
  if (unsafeLanguagePaths.length > 0) {
    errors.push(`Unsafe trading language found: ${unsafeLanguagePaths.join(", ")}`);
  }

  if (Array.isArray(digest.tickers)) {
    digest.tickers.forEach((tickerDigest, index) => {
      validateTickerDigest(tickerDigest, index, errors, warnings);
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    ticker_count: Array.isArray(digest.tickers) ? digest.tickers.length : 0,
    forbidden_field_paths: forbiddenFieldPaths,
    unsafe_language_paths: unsafeLanguagePaths,
  };
}

function validateTickerDigest(tickerDigest, index, errors, warnings) {
  for (const field of REQUIRED_TICKER_FIELDS) {
    if (tickerDigest[field] === undefined) {
      errors.push(`tickers[${index}] missing required field: ${field}`);
    }
  }

  if (tickerDigest.schema_version !== TICKER_SCHEMA_VERSION) {
    errors.push(`tickers[${index}].schema_version mismatch.`);
  }
  if (!tickerDigest.ticker) errors.push(`tickers[${index}].ticker is required.`);
  if (!Number.isInteger(tickerDigest.research_priority_rank) || tickerDigest.research_priority_rank < 1) {
    errors.push(`tickers[${index}].research_priority_rank must be a positive integer.`);
  }
  if (!["high", "medium", "low"].includes(tickerDigest.research_priority_tier)) {
    errors.push(`tickers[${index}].research_priority_tier must be high, medium, or low.`);
  }
  if (!Array.isArray(tickerDigest.what_changed) || tickerDigest.what_changed.length === 0) {
    errors.push(`tickers[${index}].what_changed must include at least one item.`);
  }
  if (!Array.isArray(tickerDigest.why_it_may_matter) || tickerDigest.why_it_may_matter.length === 0) {
    errors.push(`tickers[${index}].why_it_may_matter must include at least one item.`);
  }
  if (!Array.isArray(tickerDigest.evidence)) errors.push(`tickers[${index}].evidence must be an array.`);
  if (!Array.isArray(tickerDigest.missing_or_unverified_claims)) {
    errors.push(`tickers[${index}].missing_or_unverified_claims must be an array.`);
  }
  if (!Array.isArray(tickerDigest.upcoming_earnings_or_catalysts)) {
    errors.push(`tickers[${index}].upcoming_earnings_or_catalysts must be an array.`);
  }
  if (!Array.isArray(tickerDigest.manual_review_queue) || tickerDigest.manual_review_queue.length === 0) {
    errors.push(`tickers[${index}].manual_review_queue must include at least one item.`);
  }
  if (tickerDigest.safety?.research_only !== true) errors.push(`tickers[${index}].safety.research_only must be true.`);
  if (tickerDigest.safety?.can_directly_trade !== false) errors.push(`tickers[${index}].safety.can_directly_trade must be false.`);
  if (tickerDigest.safety?.requires_human_review !== true) errors.push(`tickers[${index}].safety.requires_human_review must be true.`);

  if (tickerDigest.evidence?.length === 0) {
    warnings.push(`tickers[${index}] has no evidence links or notes.`);
  }
}

function findForbiddenFieldNames(value, currentPath = "digest") {
  if (!value || typeof value !== "object") return [];
  const found = [];

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (FORBIDDEN_FIELD_NAMES.has(key)) found.push(childPath);
    if (child && typeof child === "object") found.push(...findForbiddenFieldNames(child, childPath));
  }

  return found;
}

function findUnsafeOutputLanguage(value, currentPath = "digest") {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => findUnsafeOutputLanguage(child, `${currentPath}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => findUnsafeOutputLanguage(child, `${currentPath}.${key}`));
  }
  if (typeof value !== "string") return [];

  if (/\b(BUY|SELL|HOLD)\b/i.test(value)) return [currentPath];
  if (/the system recommends/i.test(value)) return [currentPath];
  if (/\b(portfolio rebalanc(e|ing)|brokerage execution|execute this trade)\b/i.test(value)) return [currentPath];
  return [];
}

module.exports = {
  DIGEST_SCHEMA_VERSION,
  FORBIDDEN_FIELD_NAMES,
  REQUIRED_TICKER_FIELDS,
  TICKER_SCHEMA_VERSION,
  validateWatchlistResearchDigest,
};
