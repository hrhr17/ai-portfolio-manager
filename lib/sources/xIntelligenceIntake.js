const path = require("path");

const SCHEMA_VERSION = "manual_x_intelligence_intake_v0";
const DEFAULT_FIXTURE_PATH = path.join(__dirname, "..", "..", "examples", "x-intelligence", "manual-x-intake.sample.json");

const FINANCE_CATEGORIES = [
  "insider_trading",
  "politician_trading",
  "unusual_options_flow",
  "equity_research",
  "macro",
  "earnings_catalyst",
  "valuation",
  "copy_trade_alert",
  "company_news",
  "watchlist",
  "noise",
];

const GENERAL_CATEGORIES = [
  "ai_tool_or_workflow",
  "business_opportunity",
  "startup_to_watch",
  "content_idea",
  "learning_resource",
  "general_intelligence",
  "noise",
];

const ALLOWED_CATEGORIES = [...new Set([...FINANCE_CATEGORIES, ...GENERAL_CATEGORIES])];
const FINANCE_CATEGORY_SET = new Set(FINANCE_CATEGORIES);
const ALLOWED_CATEGORY_SET = new Set(ALLOWED_CATEGORIES);

const ALLOWED_ROUTES = [
  "portfolio_research_queue",
  "watchlist_candidate",
  "daily_report_note",
  "document_signal_followup",
  "business_opportunity_queue",
  "content_idea_queue",
  "learning_resource_queue",
  "ignore_noise",
];

const ALLOWED_ROUTE_SET = new Set(ALLOWED_ROUTES);

const FORBIDDEN_OUTPUT_FIELDS = [
  "action",
  "recommendation",
  "portfolio_recommendation",
  "trade_recommendation",
  "buy",
  "sell",
  "hold",
  "target_weight",
  "targetWeight",
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
  "shares_to_buy",
  "shares_to_sell",
  "options",
  "margin",
  "crypto_action",
  "token_action",
];

const COMPANY_HINTS = {
  AMD: "Advanced Micro Devices",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
};

function runManualXIntakeDryRun(fixture, options = {}) {
  const items = normalizeFixtureItems(fixture);
  const signals = items.map((item, index) => normalizeManualXItem(item, { index }));
  const validation = validateManualXIntakeOutput(signals);

  return {
    schema_version: SCHEMA_VERSION,
    mode: "manual_fixture_dry_run",
    fixture_name: fixture && fixture.fixture_name ? fixture.fixture_name : "manual_x_intake_fixture",
    fixture_version: fixture && fixture.fixture_version ? fixture.fixture_version : "unknown",
    fixture_path: options.fixturePath || DEFAULT_FIXTURE_PATH,
    safety: buildSafetyStatus(),
    summary: {
      total_records_processed: items.length,
      count_by_category: countBy(signals, "category"),
      count_by_route: countBy(signals, "route"),
      safety_status: validation.passed ? "passed" : "failed",
      research_only_signals: signals.filter((signal) => signal.allowed_action === "research_only").length,
      direct_trade_signals: signals.filter((signal) => signal.can_directly_trade !== false).length,
    },
    signals,
    validation,
  };
}

function normalizeFixtureItems(fixture) {
  if (Array.isArray(fixture)) return fixture;
  if (fixture && Array.isArray(fixture.items)) return fixture.items;
  return [];
}

function normalizeManualXItem(item, options = {}) {
  const record = item || {};
  const text = normalizeText(record.text || record.raw_text || record.rawText || "");
  const userNote = normalizeText(record.user_note || record.userNote || "");
  const tags = unique([...(record.tags || []), ...(record.tag ? [record.tag] : [])].map(normalizeTag));
  const detectedTickers = unique([...(record.tickers || []), ...extractCashtags(text)].map(normalizeTicker).filter(Boolean));
  const category = classifyCategory({ text, userNote, tags, detectedTickers });
  const route = chooseRoute(category, detectedTickers);
  const priority = choosePriority(category, route, detectedTickers);
  const confidence = scoreConfidence(category, route, tags, detectedTickers, text);
  const capturedAt = record.captured_at || record.capturedAt || new Date(0).toISOString();

  return {
    signal_id: buildSignalId(record.id, options.index, text),
    source_platform: record.source_platform || "x_manual",
    source_url: record.source_url || record.sourceUrl || null,
    author_handle: normalizeHandle(record.author_handle || record.authorHandle || record.source_account || record.sourceAccount),
    captured_at: capturedAt,
    raw_text: text,
    user_note: userNote,
    detected_tickers: detectedTickers,
    company_hints: detectedTickers.map((ticker) => COMPANY_HINTS[ticker]).filter(Boolean),
    category,
    route,
    priority,
    confidence,
    rationale: buildRationale(category, route, tags, detectedTickers),
    allowed_action: "research_only",
    can_directly_trade: false,
    requires_human_review: true,
    created_at: capturedAt,
    safety_flags: [
      "manual_fixture_only",
      "deterministic_rules_only",
      "research_only",
      "no_live_x_api",
      "no_oauth",
      "no_mcp",
      "no_scraping",
      "no_external_network_calls",
      "no_portfolio_writes",
      "no_report_writes",
      "human_review_required",
    ],
    required_verification: buildRequiredVerification(category, detectedTickers),
  };
}

function classifyCategory({ text, userNote, tags, detectedTickers }) {
  const haystack = `${text} ${userNote} ${tags.join(" ")}`.toLowerCase();

  if (hasAny(haystack, ["100x", "guaranteed", "can't lose", "cant lose", "pump", "vague screenshot", "no need for research"])) {
    return "noise";
  }
  if (hasAny(haystack, ["copy trade", "copy-trade", "follow this trader", "i entered", "whale alert"])) {
    return "copy_trade_alert";
  }

  const explicitCategory = tags.find((tag) => ALLOWED_CATEGORY_SET.has(tag) && tag !== "noise");
  if (explicitCategory) return explicitCategory;

  if (hasAny(haystack, ["insider", "form 4", "director acquired", "ceo acquired", "cfo acquired"])) {
    return "insider_trading";
  }
  if (hasAny(haystack, ["congress", "senator", "house disclosure", "politician"])) {
    return "politician_trading";
  }
  if (hasAny(haystack, ["unusual options", "options flow", "sweep", "call volume", "put volume"])) {
    return "unusual_options_flow";
  }
  if (hasAny(haystack, ["earnings", "quarter", "guidance", "revenue", "margin", "eps", "10-q", "transcript"])) {
    return "earnings_catalyst";
  }
  if (hasAny(haystack, ["valuation", "multiple", "dcf", "fcf yield", "ev/ebitda"])) {
    return "valuation";
  }
  if (hasAny(haystack, ["macro", "rates", "cpi", "jobs", "fed", "inflation", "yields"])) {
    return "macro";
  }
  if (hasAny(haystack, ["thread idea", "video idea", "post idea", "content angle", "newsletter"])) {
    return "content_idea";
  }
  if (hasAny(haystack, ["learning resource", "course", "tutorial", "reading list", "guide"])) {
    return "learning_resource";
  }
  if (hasAny(haystack, ["startup", "launch", "founder", "funding", "product hunt", "demo day"])) {
    return "startup_to_watch";
  }
  if (hasAny(haystack, ["business opportunity", "revenue idea", "monetize", "pricing", "customer", "service packaging"])) {
    return "business_opportunity";
  }
  if (hasAny(haystack, ["chatgpt", "codex", "agent", "workflow", "automation", "tool", "prompt"])) {
    return "ai_tool_or_workflow";
  }
  if (hasAny(haystack, ["announces", "partnership", "contract", "launches", "company release", "customer win"])) {
    return "company_news";
  }
  if (hasAny(haystack, ["watchlist", "watch list", "keep an eye"])) {
    return "watchlist";
  }
  if (detectedTickers.length > 0 || hasAny(haystack, ["equity research", "channel checks", "filing", "analyst", "market cap"])) {
    return "equity_research";
  }

  return "general_intelligence";
}

function chooseRoute(category, detectedTickers) {
  if (category === "noise") return "ignore_noise";
  if (category === "copy_trade_alert") return detectedTickers.length > 0 ? "portfolio_research_queue" : "ignore_noise";
  if (category === "content_idea") return "content_idea_queue";
  if (category === "learning_resource") return "learning_resource_queue";
  if (category === "business_opportunity" || category === "startup_to_watch") return "business_opportunity_queue";
  if (category === "watchlist") return "watchlist_candidate";
  if (category === "ai_tool_or_workflow" || category === "macro" || category === "general_intelligence") return "daily_report_note";
  if (FINANCE_CATEGORY_SET.has(category)) return detectedTickers.length > 0 ? "portfolio_research_queue" : "daily_report_note";
  return "daily_report_note";
}

function choosePriority(category, route, detectedTickers) {
  if (category === "noise") return "low";
  if (route === "portfolio_research_queue" && detectedTickers.length > 0) return "high";
  if (["business_opportunity_queue", "content_idea_queue", "learning_resource_queue"].includes(route)) return "medium";
  return "medium";
}

function scoreConfidence(category, route, tags, detectedTickers, text) {
  if (category === "noise") return 0.15;
  let score = 0.42;
  if (detectedTickers.length > 0) score += 0.08;
  if (route === "portfolio_research_queue") score += 0.08;
  if (tags.length > 0) score += 0.04;
  if (/verify|filing|release|transcript|data/i.test(text)) score += 0.04;
  if (category === "copy_trade_alert") score -= 0.12;
  return round(clamp(score, 0.1, 0.85));
}

function buildRationale(category, route, tags, detectedTickers) {
  const tickerText = detectedTickers.length > 0 ? ` Tickers detected: ${detectedTickers.join(", ")}.` : "";
  const tagText = tags.length > 0 ? ` Tags used: ${tags.join(", ")}.` : "";
  return `Deterministic keyword/tag rules classified this as ${category} and routed it to ${route}.${tickerText}${tagText} This is an input for research review only.`;
}

function buildRequiredVerification(category, detectedTickers) {
  const checks = ["Confirm source credibility and whether the claim is current."];
  if (detectedTickers.length > 0) checks.push("Verify ticker relevance with primary company sources or reputable market data.");
  if (["earnings_catalyst", "company_news", "valuation", "equity_research"].includes(category)) {
    checks.push("Check filings, releases, transcripts, valuation context, and contradictory evidence.");
  }
  if (category === "copy_trade_alert") checks.push("Treat copy-trade framing as unverified; route through skeptic review before any research queue escalation.");
  if (category === "noise") checks.push("Ignore unless independently corroborated by a higher-quality source.");
  return checks;
}

function validateManualXIntakeOutput(signals) {
  const errors = [];
  if (!Array.isArray(signals)) {
    return { passed: false, errors: ["signals must be an array"] };
  }

  signals.forEach((signal, index) => {
    requireEqual(signal.allowed_action, "research_only", `signals[${index}].allowed_action must be research_only`, errors);
    requireEqual(signal.can_directly_trade, false, `signals[${index}].can_directly_trade must be false`, errors);
    requireEqual(signal.requires_human_review, true, `signals[${index}].requires_human_review must be true`, errors);

    if (!ALLOWED_CATEGORY_SET.has(signal.category)) errors.push(`signals[${index}].category is not allowed: ${signal.category}`);
    if (!ALLOWED_ROUTE_SET.has(signal.route)) errors.push(`signals[${index}].route is not allowed: ${signal.route}`);
    if (!Array.isArray(signal.safety_flags) || signal.safety_flags.length === 0) errors.push(`signals[${index}] missing safety_flags`);
    if (signal.route === "portfolio_action") errors.push(`signals[${index}] must not route to portfolio_action`);

    for (const field of FORBIDDEN_OUTPUT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(signal, field)) {
        errors.push(`signals[${index}] includes forbidden field ${field}`);
      }
    }
  });

  return { passed: errors.length === 0, errors };
}

function buildSafetyStatus() {
  return {
    research_only: true,
    manual_fixture_only: true,
    deterministic_rules_only: true,
    live_x_api_called: false,
    oauth_used: false,
    mcp_used: false,
    scraping_used: false,
    browser_automation_used: false,
    external_network_called: false,
    llm_used: false,
    google_drive_read: false,
    portfolio_written: false,
    report_written: false,
    production_storage_written: false,
  };
}

function buildSignalId(id, index, text) {
  const seed = String(id || `manual-x-${index + 1}-${text.slice(0, 40)}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `xintel-${seed || index + 1}`;
}

function extractCashtags(text) {
  return [...String(text || "").matchAll(/\$([A-Z]{1,6})(?:\b|[.,;:!?])/g)].map((match) => match[1]);
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .trim()
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/\.US$/, "");
}

function normalizeHandle(handle) {
  const trimmed = String(handle || "").trim();
  if (!trimmed) return "@unknown";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTag(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function requireEqual(actual, expected, message, errors) {
  if (actual !== expected) errors.push(message);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  ALLOWED_CATEGORIES,
  ALLOWED_ROUTES,
  DEFAULT_FIXTURE_PATH,
  FORBIDDEN_OUTPUT_FIELDS,
  SCHEMA_VERSION,
  buildSafetyStatus,
  normalizeManualXItem,
  runManualXIntakeDryRun,
  validateManualXIntakeOutput,
};
