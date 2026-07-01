const fs = require("fs");
const path = require("path");

const DEFAULT_WATCHLIST_PATH = "fixtures/watchlist-research/watchlist.sample.json";
const DEFAULT_RESEARCH_QUEUE_PATH = "fixtures/watchlist-research/research-queue.sample.json";
const DEFAULT_PAPER_PORTFOLIO_PATH = "fixtures/paper-portfolio/sample-portfolio.json";

function loadCommitteeInputs(options = {}) {
  const watchlistPath = options.watchlistPath || DEFAULT_WATCHLIST_PATH;
  const researchQueuePath = options.researchQueuePath || DEFAULT_RESEARCH_QUEUE_PATH;
  const portfolioPath = options.portfolioPath || DEFAULT_PAPER_PORTFOLIO_PATH;

  return {
    watchlist: loadWatchlistFixture(watchlistPath),
    researchQueue: loadResearchQueueFixture(researchQueuePath),
    portfolio: loadPaperPortfolio(portfolioPath),
    input_paths: {
      watchlist: normalizeInputPath(watchlistPath),
      research_queue: normalizeInputPath(researchQueuePath),
      paper_portfolio: normalizeInputPath(portfolioPath),
    },
  };
}

function loadWatchlistFixture(inputPath = DEFAULT_WATCHLIST_PATH) {
  const bundle = loadJson(inputPath);
  const tickers = Array.isArray(bundle.tickers) ? bundle.tickers.map(normalizeWatchlistItem) : [];
  return {
    schema_version: bundle.schema_version || "paper_committee_watchlist_fixture_v0",
    fixture_name: bundle.fixture_name || "watchlist_fixture",
    fixture_version: bundle.fixture_version || "unknown",
    product_reference: {
      source_title: normalizeNullableText(bundle.product_reference?.source_title),
      source_tabs: normalizeStringArray(bundle.product_reference?.source_tabs),
      runtime_google_sheets_integration: bundle.product_reference?.runtime_google_sheets_integration === true,
      notes: normalizeNullableText(bundle.product_reference?.notes),
    },
    tickers,
  };
}

function loadResearchQueueFixture(inputPath = DEFAULT_RESEARCH_QUEUE_PATH) {
  const bundle = loadJson(inputPath);
  const tasks = Array.isArray(bundle.tasks) ? bundle.tasks.map(normalizeResearchTask) : [];
  return {
    schema_version: bundle.schema_version || "paper_committee_research_queue_fixture_v0",
    fixture_name: bundle.fixture_name || "research_queue_fixture",
    fixture_version: bundle.fixture_version || "unknown",
    source_title: normalizeNullableText(bundle.source_title),
    runtime_google_sheets_integration: bundle.runtime_google_sheets_integration === true,
    tasks,
  };
}

function loadPaperPortfolio(inputPath = DEFAULT_PAPER_PORTFOLIO_PATH) {
  const bundle = loadJson(inputPath);
  const holdings = Array.isArray(bundle.holdings) ? bundle.holdings.map(normalizeHolding) : [];
  return {
    schema_version: bundle.schema_version || "paper_portfolio_fixture_v0",
    fixture_name: bundle.fixture_name || "paper_portfolio_fixture",
    fixture_version: bundle.fixture_version || "unknown",
    as_of: bundle.as_of || bundle.asOf || new Date(0).toISOString(),
    currency: normalizeText(bundle.currency || "USD"),
    cash_balance: Number(bundle.cash_balance ?? bundle.cashBalance ?? 0),
    cash_weight_pct: round(bundle.cash_weight_pct ?? bundle.cashWeightPct ?? 0),
    paper_only: bundle.paper_only !== false,
    simulated: bundle.simulated !== false,
    rules: normalizeRules(bundle.rules),
    holdings,
  };
}

function normalizeWatchlistItem(item) {
  return {
    category: normalizeText(item.category || "Unknown"),
    ticker: normalizeTicker(item.ticker),
    ticker_display: normalizeText(item.ticker_display || item.tickerDisplay || item.ticker || ""),
    instrument_type: normalizeText(item.instrument_type || item.instrumentType || "Equity"),
    asset_class: normalizeText(item.asset_class || item.assetClass || "equity").toLowerCase(),
    company_name: normalizeNullableText(item.company_name || item.companyName),
    primary_theme: normalizeText(item.primary_theme || item.primaryTheme || "Unknown"),
    research_angle: normalizeText(item.research_angle || item.researchAngle),
    priority: normalizeText(item.priority || "Unranked"),
    status: normalizeText(item.status || "Raw Signal"),
    conviction: normalizeText(item.conviction || "Unrated"),
    source_bucket: normalizeText(item.source_bucket || item.sourceBucket || "Unknown"),
    thesis_hook: normalizeText(item.thesis_hook || item.thesisHook),
    risk_skeptic_lens: normalizeText(item.risk_skeptic_lens || item.riskSkepticLens),
    what_changed: normalizeStringArray(item.what_changed || item.whatChanged),
    why_it_may_matter: normalizeStringArray(item.why_it_may_matter || item.whyItMayMatter),
    evidence: normalizeArray(item.evidence).map(normalizeEvidence),
    missing_verification: normalizeStringArray(item.missing_verification || item.missingVerification),
    manual_review_items: normalizeStringArray(item.manual_review_items || item.manualReviewItems),
    committee_score: clamp(Number(item.committee_score ?? item.committeeScore ?? 0), 0, 100),
  };
}

function normalizeResearchTask(task) {
  return {
    task_id: normalizeText(task.task_id || task.taskId),
    ticker_scope: normalizeText(task.ticker_scope || task.tickerScope),
    category: normalizeText(task.category || "All"),
    task_type: normalizeText(task.task_type || task.taskType),
    agent_route: normalizeText(task.agent_route || task.agentRoute),
    research_question: normalizeText(task.research_question || task.researchQuestion),
    trigger_source: normalizeText(task.trigger_source || task.triggerSource),
    priority: normalizeText(task.priority || "Medium"),
    status: normalizeText(task.status || "Backlog"),
    evidence_required: normalizeStringArray(task.evidence_required || task.evidenceRequired),
    blocked_output: normalizeStringArray(task.blocked_output || task.blockedOutput),
    notes: normalizeText(task.notes),
  };
}

function normalizeHolding(holding) {
  return {
    ticker: normalizeTicker(holding.ticker),
    company_name: normalizeNullableText(holding.company_name || holding.companyName),
    asset_class: normalizeText(holding.asset_class || holding.assetClass || "equity").toLowerCase(),
    theme: normalizeText(holding.theme || "Unknown"),
    category: normalizeText(holding.category || "Unknown"),
    current_mock_weight_pct: round(holding.current_mock_weight_pct ?? holding.currentMockWeightPct ?? holding.weightPct ?? 0),
    cost_basis: holding.cost_basis == null && holding.costBasis == null ? null : Number(holding.cost_basis ?? holding.costBasis),
    cost_basis_available: Boolean(holding.cost_basis_available ?? holding.costBasisAvailable),
    notes: normalizeText(holding.notes),
  };
}

function normalizeRules(rules = {}) {
  return {
    max_single_name_weight_pct: Number(rules.max_single_name_weight_pct ?? rules.maxSingleNameWeightPct ?? 5),
    max_theme_weight_pct: Number(rules.max_theme_weight_pct ?? rules.maxThemeWeightPct ?? 20),
    blocked_asset_classes: normalizeStringArray(rules.blocked_asset_classes || rules.blockedAssetClasses).map((value) => value.toLowerCase()),
    live_trading_enabled: rules.live_trading_enabled === true,
    brokerage_integration_enabled: rules.brokerage_integration_enabled === true,
    automated_ordering_enabled: rules.automated_ordering_enabled === true,
    production_storage_enabled: rules.production_storage_enabled === true,
  };
}

function normalizeEvidence(evidence) {
  return {
    source_title: normalizeNullableText(evidence.source_title || evidence.sourceTitle),
    source_url: normalizeNullableText(evidence.source_url || evidence.sourceUrl),
    verification_status: normalizeText(evidence.verification_status || evidence.verificationStatus || "unverified"),
    evidence_note: normalizeNullableText(evidence.evidence_note || evidence.evidenceNote),
  };
}

function loadJson(inputPath) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function normalizeInputPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function normalizeTicker(value) {
  return String(value || "")
    .trim()
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/\.US$/, "");
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

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  DEFAULT_PAPER_PORTFOLIO_PATH,
  DEFAULT_RESEARCH_QUEUE_PATH,
  DEFAULT_WATCHLIST_PATH,
  loadCommitteeInputs,
  loadPaperPortfolio,
  loadResearchQueueFixture,
  loadWatchlistFixture,
};
