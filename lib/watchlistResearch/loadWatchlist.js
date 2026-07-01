const fs = require("fs");
const path = require("path");

const SCHEMA_VERSION = "watchlist_research_input_v0";
const DEFAULT_WATCHLIST_PATH = "examples/watchlist-research/sample-watchlist.json";

function loadWatchlist(inputPath = DEFAULT_WATCHLIST_PATH) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeWatchlist(parsed, {
    inputPath: toPosixPath(path.relative(process.cwd(), absolutePath)),
  });
}

function normalizeWatchlist(bundle, options = {}) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("Watchlist input must be a JSON object.");
  }
  if (!Array.isArray(bundle.tickers) || bundle.tickers.length === 0) {
    throw new Error("Watchlist input must include a non-empty tickers array.");
  }

  return {
    schema_version: bundle.schema_version || SCHEMA_VERSION,
    fixture_name: bundle.fixture_name || "watchlist_research_input",
    fixture_version: bundle.fixture_version || "unknown",
    sample_only: bundle.sample_only === true,
    description: normalizeText(bundle.description),
    source: {
      input_path: options.inputPath || DEFAULT_WATCHLIST_PATH,
      input_type: "json_fixture",
    },
    tickers: bundle.tickers.map(normalizeWatchlistTicker),
  };
}

function normalizeWatchlistTicker(item, index) {
  const ticker = normalizeTicker(item.ticker);
  if (!ticker) {
    throw new Error(`Watchlist ticker at index ${index} is missing ticker.`);
  }

  return {
    ticker,
    company_name: normalizeNullableText(item.company_name || item.companyName),
    themes: normalizeStringArray(item.themes),
    watch_reason: normalizeText(item.watch_reason || item.watchReason),
    changes: normalizeArray(item.changes).map(normalizeChange),
    current_claims: normalizeArray(item.current_claims || item.currentClaims).map(normalizeClaim),
    upcoming_catalysts: normalizeArray(item.upcoming_catalysts || item.upcomingCatalysts).map(normalizeCatalyst),
    manual_review_items: normalizeStringArray(item.manual_review_items || item.manualReviewItems),
  };
}

function normalizeChange(change, index) {
  return {
    change_id: normalizeText(change.change_id || change.changeId || `change-${index + 1}`),
    category: normalizeText(change.category || "general_research_note"),
    summary: normalizeText(change.summary),
    why_it_may_matter: normalizeText(change.why_it_may_matter || change.whyItMayMatter),
    observed_at: normalizeNullableText(change.observed_at || change.observedAt),
    severity: normalizeSeverity(change.severity),
    verification_status: normalizeText(change.verification_status || change.verificationStatus || "unverified"),
    source_title: normalizeNullableText(change.source_title || change.sourceTitle),
    source_url: normalizeNullableText(change.source_url || change.sourceUrl),
    evidence_text: normalizeNullableText(change.evidence_text || change.evidenceText),
  };
}

function normalizeClaim(claim, index) {
  return {
    claim_id: normalizeText(claim.claim_id || claim.claimId || `claim-${index + 1}`),
    claim: normalizeText(claim.claim),
    verification_status: normalizeText(claim.verification_status || claim.verificationStatus || "unverified"),
    source_type: normalizeText(claim.source_type || claim.sourceType || "manual_research_note"),
    source_url: normalizeNullableText(claim.source_url || claim.sourceUrl),
  };
}

function normalizeCatalyst(catalyst, index) {
  return {
    catalyst_id: normalizeText(catalyst.catalyst_id || catalyst.catalystId || `catalyst-${index + 1}`),
    title: normalizeText(catalyst.title),
    date: normalizeNullableText(catalyst.date),
    expected_timing: normalizeNullableText(catalyst.expected_timing || catalyst.expectedTiming),
    source_url: normalizeNullableText(catalyst.source_url || catalyst.sourceUrl),
    verification_status: normalizeText(catalyst.verification_status || catalyst.verificationStatus || "unverified"),
  };
}

function normalizeTicker(value) {
  return String(value || "")
    .trim()
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/\.US$/, "");
}

function normalizeSeverity(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["high", "medium", "low"].includes(normalized) ? normalized : "medium";
}

function normalizeStringArray(value) {
  return normalizeArray(value).map(normalizeText).filter(Boolean);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

module.exports = {
  DEFAULT_WATCHLIST_PATH,
  SCHEMA_VERSION,
  loadWatchlist,
  normalizeWatchlist,
};
