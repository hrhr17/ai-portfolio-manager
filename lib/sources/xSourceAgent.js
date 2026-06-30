const SOURCE_PRIORITY = [
  "bookmarks",
  "monitored_accounts",
  "lists",
  "cashtags",
  "general_feed",
];

const SIGNAL_CATEGORIES = [
  "insider_trading",
  "politician_trading",
  "unusual_options_flow",
  "equity_research",
  "macro",
  "earnings_catalyst",
  "valuation",
  "copy_trade_alert",
  "company_news",
  "ai_tool_or_workflow",
  "business_opportunity",
  "startup_to_watch",
  "content_idea",
  "watchlist",
  "noise",
];

const FINANCE_CATEGORIES = new Set([
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
]);

const GENERAL_INTELLIGENCE_CATEGORIES = new Set([
  "ai_tool_or_workflow",
  "business_opportunity",
  "startup_to_watch",
  "content_idea",
]);

const COMMON_WORDS = new Set([
  "AI",
  "API",
  "CEO",
  "CFO",
  "CTO",
  "GDP",
  "IPO",
  "LLM",
  "MCP",
  "SEC",
  "USA",
  "USD",
]);

const COMPANY_HINTS = {
  AAPL: "Apple",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  GOOG: "Alphabet",
  META: "Meta",
  MSFT: "Microsoft",
  NVDA: "NVIDIA",
  TSLA: "Tesla",
};

async function fetchXSocialSignals({ date, mode = "auto", manualPosts = [] } = {}) {
  const resolvedMode = resolveMode(mode, manualPosts);

  if (resolvedMode === "manual") {
    return ingestManualXSignals(manualPosts, { date });
  }

  if (resolvedMode === "mock") {
    return buildMockSignals(date);
  }

  if (resolvedMode === "api") {
    return [];
  }

  return [];
}

function ingestManualXSignals(posts, options = {}) {
  return normalizeXSignals(posts, {
    ...options,
    mode: "manual",
    source: options.source || "manual_x_intake",
  });
}

function normalizeXSignals(posts, options = {}) {
  const items = Array.isArray(posts) ? posts : [posts].filter(Boolean);
  return items.map((post, index) => normalizeXSignal(post, { ...options, index }));
}

function normalizeXSignal(post, options = {}) {
  const raw = typeof post === "string" ? { rawText: post } : post || {};
  const rawText = String(raw.rawText || raw.text || raw.body || "").trim();
  const sourceAccount = normalizeAccount(raw.sourceAccount || raw.account || raw.author || raw.username);
  const sourceUrl = raw.sourceUrl || raw.url || raw.link || "";
  const capturedAt = raw.capturedAt || raw.observedAt || new Date().toISOString();
  const tickers = unique([...(raw.tickers || []), ...extractTickers(rawText)].map(normalizeTicker).filter(Boolean));
  const category = normalizeCategory(raw.category || classifyCategory(rawText, tickers));
  const sourceQuality = normalizeSourceQuality(raw.sourceQuality || classifySourceQuality(rawText, sourceAccount));
  const signalStrength = clamp(Number(raw.signalStrength || scoreSignalStrength(rawText, tickers, category)), 1, 5);
  const themes = unique([...(raw.themes || []), ...extractThemes(rawText, category)].filter(Boolean));
  const companies = unique([...(raw.companies || []), ...tickers.map((ticker) => COMPANY_HINTS[ticker]).filter(Boolean)]);
  const people = unique([...(raw.people || []), ...extractPeople(rawText, sourceAccount)].filter(Boolean));
  const recommendedNextStep = normalizeNextStep(raw.recommendedNextStep || chooseNextStep(category, sourceQuality, signalStrength, tickers));
  const timeSensitivity = raw.timeSensitivity || classifyTimeSensitivity(rawText, category);
  const verificationNeeded = raw.verificationNeeded ?? category !== "noise";
  const primarySourceNeeded = raw.primarySourceNeeded ?? FINANCE_CATEGORIES.has(category);
  const requiredVerification = normalizeRequiredVerification(raw.requiredVerification, category, primarySourceNeeded);

  return {
    id: raw.id || buildSignalId(options.date, options.index, rawText, sourceUrl),
    source: raw.source || options.source || `${options.mode || "mock"}_x_intake`,
    sourceAccount,
    sourceUrl,
    capturedAt,
    rawText,
    tickers,
    companies,
    people,
    themes,
    signalType: raw.signalType || category,
    category,
    claim: raw.claim || summarizeClaim(rawText),
    initialConfidence: normalizeConfidence(raw.initialConfidence, sourceQuality, signalStrength),
    sourceQuality,
    signalStrength,
    actionabilityScore: scoreActionability(category, sourceQuality, signalStrength, tickers, timeSensitivity),
    verificationNeeded,
    primarySourceNeeded,
    requiredVerification,
    recommendedNextStep,
    relatedTickers: unique([...(raw.relatedTickers || []), ...tickers].map(normalizeTicker).filter(Boolean)),
    relatedThemes: unique([...(raw.relatedThemes || []), ...themes].filter(Boolean)),
    timeSensitivity,
    projectTags: normalizeProjectTags(raw.projectTags, category),
    status: raw.status || "new",
    sourceTrail: [
      {
        source: raw.source || options.source || "xSourceAgent",
        sourceAccount,
        sourceUrl,
        mode: options.mode || "mock",
      },
    ],
    tradingRestriction: "research_only",
  };
}

function buildXSignalDesk(signals) {
  const financeSignals = signals.filter((signal) => signal.projectTags.includes("portfolio_manager"));
  return {
    topFinanceSignals: financeSignals
      .filter((signal) => signal.category !== "noise")
      .sort(byActionability)
      .slice(0, 10),
    ignoredOrNoisyFinanceSignals: financeSignals.filter((signal) => signal.category === "noise" || signal.recommendedNextStep === "ignore"),
    researchCandidates: financeSignals.filter((signal) => ["send_to_research", "send_to_skeptic"].includes(signal.recommendedNextStep)),
    watchlistAdditions: financeSignals.filter((signal) => signal.recommendedNextStep === "watch"),
    requiredVerification: unique(financeSignals.flatMap((signal) => signal.requiredVerification)),
  };
}

function buildHenryIntelligenceBrief(signals) {
  const generalSignals = signals.filter((signal) => signal.projectTags.includes("henry_intelligence"));
  return {
    usefulAiToolsAndResources: byCategory(generalSignals, "ai_tool_or_workflow"),
    startupsToWatch: byCategory(generalSignals, "startup_to_watch"),
    businessRevenueIdeas: byCategory(generalSignals, "business_opportunity"),
    codexChatgptWorkflowUpgrades: generalSignals.filter((signal) =>
      signal.relatedThemes.some((theme) => ["codex", "chatgpt", "workflow"].includes(theme))
    ),
    learningResources: generalSignals.filter((signal) =>
      signal.relatedThemes.some((theme) => ["learning", "course", "tutorial", "research"].includes(theme))
    ),
    contentIdeas: byCategory(generalSignals, "content_idea"),
    thingsToIgnore: signals.filter((signal) => signal.category === "noise" || signal.recommendedNextStep === "ignore"),
  };
}

function getXSourceStatus() {
  return {
    enabled: false,
    mode: getEnv("X_SOURCE_MOCK_SIGNALS") === "true" ? "mock" : "disabled",
    supportedModes: ["mock", "manual", "api_placeholder"],
    sourcePriority: SOURCE_PRIORITY,
    categories: SIGNAL_CATEGORIES,
    safetyRule: "X/social inputs may only create research tasks, watchlist items, report notes, or general intelligence briefs. They must not directly create trades.",
    requiredForLiveIngestion: [
      "API credentials or X MCP access",
      "bookmark/list/account configuration",
      "rate-limit handling",
      "source reliability scoring",
      "duplicate and manipulation checks",
    ],
  };
}

function resolveMode(mode, manualPosts) {
  if (Array.isArray(manualPosts) && manualPosts.length > 0) return "manual";
  if (mode === "manual" || mode === "mock" || mode === "api") return mode;
  if (getEnv("X_SOURCE_MOCK_SIGNALS") === "true") return "mock";
  return "disabled";
}

function buildMockSignals(date) {
  return normalizeXSignals(
    [
      {
        source: "mock_bookmark",
        sourceAccount: "@sample_researcher",
        sourceUrl: "https://x.example/mock/nvda-ai-demand",
        rawText: "$NVDA checks suggest hyperscaler AI accelerator demand remains strong into earnings. Need to verify with filings, channel data, and valuation.",
      },
      {
        source: "mock_bookmark",
        sourceAccount: "@sample_builder",
        sourceUrl: "https://x.example/mock/codex-workflow",
        rawText: "New Codex workflow idea: save reusable agent checklists for PR verification, deployment notes, and no-secret audits.",
      },
      {
        source: "mock_bookmark",
        sourceAccount: "@sample_promo",
        sourceUrl: "https://x.example/mock/100x-alert",
        rawText: "100x guaranteed alert. Join paid group now. No need to research.",
      },
    ],
    { date, mode: "mock", source: "x_social_mock" }
  );
}

function classifyCategory(text, tickers) {
  const lower = text.toLowerCase();
  if (/(100x|guaranteed|paid group|signals? room|join now|pump)/.test(lower)) return "noise";
  if (/(insider|form 4|director bought|ceo bought|cfo bought)/.test(lower)) return "insider_trading";
  if (/(pelosi|congress|senator|house disclosure|politician)/.test(lower)) return "politician_trading";
  if (/(unusual options|options flow|sweep|calls|puts)/.test(lower)) return "unusual_options_flow";
  if (/(earnings|guidance|quarter|eps|revenue beat|revenue miss)/.test(lower)) return "earnings_catalyst";
  if (/(valuation|multiple|pe|p\/e|ev\/ebitda|cheap|expensive)/.test(lower)) return "valuation";
  if (/(fed|rates|inflation|cpi|jobs report|macro|treasury|yield)/.test(lower)) return "macro";
  if (/(acquisition|merger|lawsuit|fda|contract|partnership|launch)/.test(lower)) return "company_news";
  if (/(copy trade|following this trader|whale wallet)/.test(lower)) return "copy_trade_alert";
  if (/(startup|founder|seed round|series a|yc|demo day)/.test(lower)) return "startup_to_watch";
  if (/(business idea|revenue|monetize|agency|productized|side hustle)/.test(lower)) return "business_opportunity";
  if (/(content idea|thread idea|newsletter|youtube|post idea)/.test(lower)) return "content_idea";
  if (/(codex|chatgpt|claude|ai tool|workflow|automation|agent|prompt|mcp)/.test(lower)) return "ai_tool_or_workflow";
  if (/(watchlist|watch list|keep an eye)/.test(lower)) return "watchlist";
  if (tickers.length > 0 || /(stock|equity|shares|market cap|analyst|research)/.test(lower)) return "equity_research";
  return "noise";
}

function classifySourceQuality(text, sourceAccount) {
  const lower = `${text} ${sourceAccount}`.toLowerCase();
  if (/(100x|guaranteed|paid group|signals? room|join now|pump)/.test(lower)) return "promotional";
  if (/(contrarian|short thesis|bear case|skeptic)/.test(lower)) return "contrarian";
  if (/(research|analyst|filing|transcript|data|\bsec\b)/.test(lower)) return "high_signal";
  if (/(noise|meme|rumor only)/.test(lower)) return "noisy";
  return "unknown";
}

function scoreSignalStrength(text, tickers, category) {
  let score = 2;
  const lower = text.toLowerCase();
  if (tickers.length > 0) score += 1;
  if (FINANCE_CATEGORIES.has(category) || GENERAL_INTELLIGENCE_CATEGORIES.has(category)) score += 1;
  if (/(filing|data|transcript|earnings|primary source|reported|confirmed)/.test(lower)) score += 1;
  if (/(rumor|maybe|unverified|guaranteed|100x)/.test(lower)) score -= 1;
  return clamp(score, 1, 5);
}

function chooseNextStep(category, sourceQuality, signalStrength, tickers) {
  if (category === "noise" || ["promotional", "noisy"].includes(sourceQuality)) return "ignore";
  if (GENERAL_INTELLIGENCE_CATEGORIES.has(category)) return "add_to_general_intelligence_brief";
  if (!FINANCE_CATEGORIES.has(category)) return "add_to_report";
  if (category === "unusual_options_flow" || category === "copy_trade_alert") return "send_to_skeptic";
  if (tickers.length === 0) return "add_to_report";
  if (signalStrength >= 4) return "send_to_research";
  return "watch";
}

function classifyTimeSensitivity(text, category) {
  const lower = text.toLowerCase();
  if (/(today|tomorrow|breaking|earnings|before open|after close|this week)/.test(lower)) return "high";
  if (["earnings_catalyst", "unusual_options_flow", "company_news"].includes(category)) return "medium";
  return "low";
}

function normalizeRequiredVerification(provided, category, primarySourceNeeded) {
  if (Array.isArray(provided) && provided.length > 0) return provided;

  const checks = ["Assess source track record and possible promotional incentives"];
  if (primarySourceNeeded) checks.push("Verify against primary filings, company releases, or reputable market data");
  if (category === "unusual_options_flow") checks.push("Confirm options flow with independent data and liquidity context");
  if (category === "politician_trading") checks.push("Confirm disclosure date, transaction date, and position size");
  if (category === "insider_trading") checks.push("Confirm Form 4 details and insider role");
  if (category === "ai_tool_or_workflow") checks.push("Try the tool/workflow before recommending it");
  if (category === "business_opportunity") checks.push("Validate buyer, pricing, and distribution assumptions");
  return checks;
}

function normalizeProjectTags(provided, category) {
  if (Array.isArray(provided) && provided.length > 0) return unique(provided);
  const tags = [];
  if (FINANCE_CATEGORIES.has(category)) tags.push("portfolio_manager");
  if (GENERAL_INTELLIGENCE_CATEGORIES.has(category) || category === "noise") tags.push("henry_intelligence");
  if (category === "ai_tool_or_workflow") tags.push("ai_tools");
  return tags.length > 0 ? tags : ["henry_intelligence"];
}

function normalizeCategory(category) {
  return SIGNAL_CATEGORIES.includes(category) ? category : "noise";
}

function normalizeSourceQuality(value) {
  const allowed = ["trusted", "high_signal", "unknown", "promotional", "noisy", "contrarian"];
  return allowed.includes(value) ? value : "unknown";
}

function normalizeNextStep(value) {
  const allowed = [
    "ignore",
    "watch",
    "send_to_research",
    "send_to_skeptic",
    "add_to_report",
    "add_to_general_intelligence_brief",
  ];
  return allowed.includes(value) ? value : "add_to_report";
}

function normalizeConfidence(value, sourceQuality, signalStrength) {
  if (value != null) return clamp(Number(value), 0.1, 0.9);
  const base = { trusted: 0.7, high_signal: 0.62, contrarian: 0.55, unknown: 0.45, noisy: 0.25, promotional: 0.18 }[sourceQuality] || 0.4;
  return Math.round((base + (signalStrength - 3) * 0.06) * 100) / 100;
}

function scoreActionability(category, sourceQuality, signalStrength, tickers, timeSensitivity) {
  if (category === "noise") return 0;
  let score = signalStrength * 12;
  if (tickers.length > 0) score += 10;
  if (sourceQuality === "trusted" || sourceQuality === "high_signal") score += 12;
  if (sourceQuality === "promotional" || sourceQuality === "noisy") score -= 20;
  if (timeSensitivity === "high") score += 8;
  return clamp(score, 0, 100);
}

function extractTickers(text) {
  const cashtags = [...text.matchAll(/\$([A-Z]{1,5})(?:\b|[.,;:!?])/g)].map((match) => match[1]);
  const plain = [...text.matchAll(/\b[A-Z]{2,5}\b/g)]
    .map((match) => match[0])
    .filter((word) => !COMMON_WORDS.has(word));
  return unique([...cashtags, ...plain]).slice(0, 8);
}

function extractThemes(text, category) {
  const lower = text.toLowerCase();
  const themes = [category];
  if (/(ai|agent|llm|chatgpt|codex|automation)/.test(lower)) themes.push("ai", "workflow");
  if (/codex/.test(lower)) themes.push("codex");
  if (/chatgpt/.test(lower)) themes.push("chatgpt");
  if (/(learning|course|tutorial|resource)/.test(lower)) themes.push("learning");
  if (/(semiconductor|gpu|accelerator|hyperscaler)/.test(lower)) themes.push("ai_infrastructure");
  if (/(revenue|business|agency|monetize)/.test(lower)) themes.push("business");
  return unique(themes);
}

function extractPeople(text, sourceAccount) {
  const handles = [...text.matchAll(/@([A-Za-z0-9_]{2,20})/g)].map((match) => `@${match[1]}`);
  if (sourceAccount) handles.push(sourceAccount);
  return handles;
}

function summarizeClaim(text) {
  if (!text) return "No claim text provided.";
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function buildSignalId(date, index = 0, text = "", sourceUrl = "") {
  const seed = `${date || "manual"}-${index}-${sourceUrl || text}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `x-${seed.slice(0, 72) || Date.now()}`;
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .trim()
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/\.US$/, "");
}

function normalizeAccount(account) {
  if (!account) return "";
  const normalized = String(account).trim();
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
}

function byCategory(signals, category) {
  return signals.filter((signal) => signal.category === category).sort(byActionability);
}

function byActionability(a, b) {
  return b.actionabilityScore - a.actionabilityScore;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function getEnv(name) {
  return typeof process !== "undefined" && process.env ? process.env[name] : undefined;
}

module.exports = {
  FINANCE_CATEGORIES,
  GENERAL_INTELLIGENCE_CATEGORIES,
  SIGNAL_CATEGORIES,
  SOURCE_PRIORITY,
  buildHenryIntelligenceBrief,
  buildXSignalDesk,
  fetchXSocialSignals,
  getXSourceStatus,
  ingestManualXSignals,
  normalizeXSignal,
  normalizeXSignals,
};
