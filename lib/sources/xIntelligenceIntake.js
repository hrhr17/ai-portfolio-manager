const path = require("path");
const crypto = require("crypto");

const SCHEMA_VERSION = "manual_x_intelligence_intake_v0";
const CLASSIFICATION_VERSION = "x_intake_rules_v0.3.0";
const ROUTE_VERSION = "x_intake_routes_v0.2.0";
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
  "ai_infrastructure",
  "semiconductors",
  "data_centers_power",
  "nuclear_energy",
  "defense_tech",
  "robotics",
  "quantum_frontier_compute",
  "cybersecurity",
  "crypto_adjacent_ai_infrastructure",
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

const ALLOWED_INTAKE_MODES = [
  "historical_backfill",
  "daily_incremental",
  "manual_fixture",
];

const ALLOWED_ROUTES = [
  "portfolio_research_queue",
  "watchlist_candidate",
  "daily_report_note",
  "document_signal_followup",
  "business_opportunity_queue",
  "content_idea_queue",
  "learning_resource_queue",
  "agent_workflow_upgrade_queue",
  "ai_tool_or_workflow_queue",
  "skill_or_research_doc_upgrade_queue",
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
  AVGO: "Broadcom",
  IONQ: "IonQ",
  MRVL: "Marvell Technology",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  OKLO: "Oklo",
  PANW: "Palo Alto Networks",
  PLTR: "Palantir",
  QBTS: "D-Wave Quantum",
  SMR: "NuScale Power",
  TSM: "Taiwan Semiconductor Manufacturing",
};

function runManualXIntakeDryRun(fixture, options = {}) {
  const items = normalizeFixtureItems(fixture);
  const seenDedupeKeys = new Set(options.priorDedupeKeys || []);
  const signals = items.map((item, index) => {
    const signal = normalizeManualXItem(item, {
      index,
      importBatchId: fixture && fixture.import_batch_id,
      importedAt: fixture && fixture.imported_at,
    });

    return applyDedupe(signal, seenDedupeKeys);
  });
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
      count_by_intake_mode: countBy(signals, "intake_mode"),
      count_by_category: countBy(signals, "category"),
      count_by_route: countBy(signals, "route"),
      duplicate_count: signals.filter((signal) => signal.prior_seen).length,
      safety_status: validation.passed ? "passed" : "failed",
      research_only_signals: signals.filter((signal) => signal.allowed_action === "research_only").length,
      direct_trade_signals: signals.filter((signal) => signal.can_directly_trade !== false).length,
      top_routed_items_by_priority: getTopRoutedItems(signals),
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
  const route = chooseRoute(category, detectedTickers, tags, text);
  const priority = choosePriority(category, route, detectedTickers);
  const confidence = scoreConfidence(category, route, tags, detectedTickers, text);
  const intakeMode = normalizeIntakeMode(record.intake_mode || record.intakeMode);
  const sourceUrl = record.source_url || record.sourceUrl || null;
  const normalizedSourceUrl = normalizeSourceUrl(sourceUrl);
  const sourceAuthorHandle = normalizeHandle(record.source_author_handle || record.sourceAuthorHandle || record.author_handle || record.authorHandle || record.source_account || record.sourceAccount);
  const sourceCreatedAt = record.source_created_at || record.sourceCreatedAt || null;
  const importedAt = record.imported_at || record.importedAt || options.importedAt || record.captured_at || record.capturedAt || new Date(0).toISOString();
  const capturedAt = record.captured_at || record.capturedAt || importedAt;
  const contentHash = buildContentHash(text, sourceAuthorHandle, sourceCreatedAt || capturedAt);
  const sourcePostId = record.source_post_id || record.sourcePostId || null;
  const dedupeKey = buildDedupeKey({ sourcePostId, normalizedSourceUrl, contentHash });

  return {
    signal_id: buildSignalId(record.id, options.index, text),
    intake_mode: intakeMode,
    source_item_id: record.source_item_id || record.sourceItemId || record.id || `manual-item-${options.index + 1}`,
    source_post_id: sourcePostId,
    source_platform: record.source_platform || "x_manual",
    source_url: sourceUrl,
    normalized_source_url: normalizedSourceUrl,
    source_author_handle: sourceAuthorHandle,
    author_handle: sourceAuthorHandle,
    source_created_at: sourceCreatedAt,
    bookmarked_at: record.bookmarked_at || record.bookmarkedAt || null,
    imported_at: importedAt,
    import_batch_id: record.import_batch_id || record.importBatchId || options.importBatchId || "manual_fixture_batch",
    source_folder: record.source_folder || record.sourceFolder || null,
    dedupe_key: dedupeKey,
    content_hash: contentHash,
    prior_seen: Boolean(record.prior_seen || record.priorSeen),
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
    routed_at: importedAt,
    route_version: ROUTE_VERSION,
    classification_version: CLASSIFICATION_VERSION,
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

  if (hasAny(haystack, ["crypto mining infrastructure", "bitcoin miners repurposed", "mining data centers", "gpu hosting", "hashpower-to-compute", "hashpower to compute"])) {
    return "crypto_adjacent_ai_infrastructure";
  }
  if (hasAny(haystack, ["nuclear", "smr", "reactor", "uranium", "baseload power", "nuclear power"])) {
    return "nuclear_energy";
  }
  if (hasAny(haystack, ["defense tech", "drone", "autonomy", "military ai", "anduril-style", "battlefield", "defense contractor", "electronic warfare"])) {
    return "defense_tech";
  }
  if (hasAny(haystack, ["cybersecurity", "identity security", "cloud security", "endpoint security", "vulnerability", "breach", "zero trust"])) {
    return "cybersecurity";
  }
  if (hasAny(haystack, ["quantum", "frontier compute", "supercomputing", "advanced compute", "photonics"])) {
    return "quantum_frontier_compute";
  }
  if (hasAny(haystack, ["robotics", "warehouse automation", "humanoid", "industrial automation", "autonomous robot"])) {
    return "robotics";
  }
  if (hasAny(haystack, ["data center", "data centre", "power", "grid", "cooling", "liquid cooling", "interconnect", "transformer", "electricity demand", "utility constraint"])) {
    return "data_centers_power";
  }
  if (hasAny(haystack, ["semiconductor", "semiconductors", "chips", "gpu", "asic", "hbm", "memory", "wafer", "foundry", "tsmc", "nvidia", "amd", "broadcom", "marvell"])) {
    return "semiconductors";
  }
  if (hasAny(haystack, ["ai infrastructure", "accelerator demand", "hyperscaler capex", "compute bottleneck", "gpu cluster", "inference", "training cluster"])) {
    return "ai_infrastructure";
  }
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

function chooseRoute(category, detectedTickers, tags = [], text = "") {
  const haystack = `${text} ${tags.join(" ")}`.toLowerCase();
  if (category === "noise") return "ignore_noise";
  if (category === "copy_trade_alert") return detectedTickers.length > 0 ? "portfolio_research_queue" : "ignore_noise";
  if (category === "content_idea") return "content_idea_queue";
  if (category === "learning_resource") return "learning_resource_queue";
  if (tags.includes("skill_research_doc_upgrade") || hasAny(haystack, ["skill upgrade", "research-doc", "research doc checklist"])) {
    return "skill_or_research_doc_upgrade_queue";
  }
  if (tags.includes("ai_tool") || hasAny(haystack, ["ai tool note"])) {
    return "ai_tool_or_workflow_queue";
  }
  if (tags.includes("agent_workflow_upgrade") || hasAny(haystack, ["prompt improvement", "codex workflow", "agent workflow"])) {
    return "agent_workflow_upgrade_queue";
  }
  if (category === "business_opportunity" || category === "startup_to_watch") return "business_opportunity_queue";
  if (category === "watchlist") return "watchlist_candidate";
  if (category === "ai_tool_or_workflow" || category === "macro" || category === "general_intelligence") return "daily_report_note";
  if (FINANCE_CATEGORY_SET.has(category)) return detectedTickers.length > 0 ? "portfolio_research_queue" : "daily_report_note";
  return "daily_report_note";
}

function choosePriority(category, route, detectedTickers) {
  if (category === "noise") return "low";
  if (route === "portfolio_research_queue" && detectedTickers.length > 0) return "high";
  if ([
    "agent_workflow_upgrade_queue",
    "ai_tool_or_workflow_queue",
    "business_opportunity_queue",
    "content_idea_queue",
    "learning_resource_queue",
    "skill_or_research_doc_upgrade_queue",
  ].includes(route)) return "medium";
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
  if (["earnings_catalyst", "company_news", "valuation", "equity_research", "ai_infrastructure", "semiconductors", "data_centers_power", "nuclear_energy", "defense_tech", "robotics", "quantum_frontier_compute", "cybersecurity", "crypto_adjacent_ai_infrastructure"].includes(category)) {
    checks.push("Check filings, releases, transcripts, valuation context, and contradictory evidence.");
  }
  if (category === "crypto_adjacent_ai_infrastructure") {
    checks.push("Verify the thesis is AI compute, HPC, data centers, power, cooling, or strategic infrastructure; do not treat this as a crypto/token signal.");
  }
  if (category === "copy_trade_alert") checks.push("Treat copy-trade framing as unverified; route through skeptic review before any research queue escalation.");
  if (category === "noise") checks.push("Ignore unless independently corroborated by a higher-quality source.");
  return checks;
}

function applyDedupe(signal, seenDedupeKeys) {
  const alreadySeen = signal.prior_seen || seenDedupeKeys.has(signal.dedupe_key);

  if (!alreadySeen) {
    seenDedupeKeys.add(signal.dedupe_key);
    return signal;
  }

  seenDedupeKeys.add(signal.dedupe_key);
  return {
    ...signal,
    prior_seen: true,
    original_route: signal.route,
    route: "ignore_noise",
    priority: "low",
    duplicate_reason: "duplicate",
    rationale: `${signal.rationale} Duplicate detected by deterministic dedupe key; routed to ignore_noise.`,
    safety_flags: unique([...signal.safety_flags, "duplicate_ignored"]),
  };
}

function getTopRoutedItems(signals) {
  const priorityRank = { high: 3, medium: 2, low: 1 };
  return signals
    .filter((signal) => signal.route !== "ignore_noise")
    .sort((a, b) => {
      const priorityDelta = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return b.confidence - a.confidence;
    })
    .slice(0, 5)
    .map((signal) => ({
      signal_id: signal.signal_id,
      intake_mode: signal.intake_mode,
      category: signal.category,
      route: signal.route,
      priority: signal.priority,
      confidence: signal.confidence,
      detected_tickers: signal.detected_tickers,
    }));
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

    if (!ALLOWED_INTAKE_MODES.includes(signal.intake_mode)) errors.push(`signals[${index}].intake_mode is not allowed: ${signal.intake_mode}`);
    if (!ALLOWED_CATEGORY_SET.has(signal.category)) errors.push(`signals[${index}].category is not allowed: ${signal.category}`);
    if (!ALLOWED_ROUTE_SET.has(signal.route)) errors.push(`signals[${index}].route is not allowed: ${signal.route}`);
    if (!signal.source_item_id) errors.push(`signals[${index}] missing source_item_id`);
    if (!signal.imported_at) errors.push(`signals[${index}] missing imported_at`);
    if (!signal.import_batch_id) errors.push(`signals[${index}] missing import_batch_id`);
    if (!signal.dedupe_key) errors.push(`signals[${index}] missing dedupe_key`);
    if (!signal.content_hash) errors.push(`signals[${index}] missing content_hash`);
    if (!signal.routed_at) errors.push(`signals[${index}] missing routed_at`);
    if (signal.route_version !== ROUTE_VERSION) errors.push(`signals[${index}] has unexpected route_version`);
    if (signal.classification_version !== CLASSIFICATION_VERSION) errors.push(`signals[${index}] has unexpected classification_version`);
    if (signal.source_post_id && signal.dedupe_key !== `post:${signal.source_post_id}`) {
      errors.push(`signals[${index}] with source_post_id must prefer source_post_id for dedupe_key`);
    }
    if (signal.prior_seen && (signal.route !== "ignore_noise" || signal.duplicate_reason !== "duplicate")) {
      errors.push(`signals[${index}] duplicate must route to ignore_noise with duplicate reason`);
    }
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

function buildDedupeKey({ sourcePostId, normalizedSourceUrl, contentHash }) {
  if (sourcePostId) return `post:${String(sourcePostId).trim()}`;
  if (normalizedSourceUrl) return `url:${normalizedSourceUrl}`;
  return `content:${contentHash}`;
}

function buildContentHash(text, sourceAuthorHandle, date) {
  const seed = [normalizeText(text).toLowerCase(), normalizeHandle(sourceAuthorHandle).toLowerCase(), normalizeText(date).slice(0, 10)].join("|");
  return crypto.createHash("sha256").update(seed).digest("hex");
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

function normalizeIntakeMode(value) {
  return ALLOWED_INTAKE_MODES.includes(value) ? value : "manual_fixture";
}

function normalizeSourceUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch (error) {
    return raw.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  }
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
  ALLOWED_INTAKE_MODES,
  ALLOWED_ROUTES,
  CLASSIFICATION_VERSION,
  DEFAULT_FIXTURE_PATH,
  FORBIDDEN_OUTPUT_FIELDS,
  ROUTE_VERSION,
  SCHEMA_VERSION,
  buildSafetyStatus,
  normalizeManualXItem,
  runManualXIntakeDryRun,
  validateManualXIntakeOutput,
};
