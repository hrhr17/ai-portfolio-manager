const METHOD = "fixture-rule-v0";
const MODEL = "none";
const PROMPT_VERSION = "none";
const SCHEMA_VERSION = "document_signal_agent_v0";

const DEFAULT_FIXTURE_PATH = "examples/document-signals/msft-sample-documents.json";

const SUPPORTED_SIGNAL_TYPES = new Set([
  "revenue_growth",
  "guidance_sentiment",
  "margin_trend",
  "capex_ai_infrastructure",
  "cash_flow_quality",
  "risk_uncertainty",
  "competitive_position",
  "management_tone",
]);

const EXPECTED_SIGNAL_RULES = {
  demand_commentary: {
    signal_type: "revenue_growth",
    category: "demand",
    direction: "mixed",
    raw_score: 0.15,
    confidence: 0.62,
    horizon: "medium",
  },
  guidance_sentiment: {
    signal_type: "guidance_sentiment",
    category: "growth",
    direction: "mixed",
    raw_score: 0.1,
    confidence: 0.58,
    horizon: "medium",
  },
  margin_pricing: {
    signal_type: "margin_trend",
    category: "margin",
    direction: "negative",
    raw_score: -0.2,
    confidence: 0.6,
    horizon: "medium",
  },
  ai_exposure: {
    signal_type: "capex_ai_infrastructure",
    category: "ai_infrastructure",
    direction: "mixed",
    raw_score: 0.2,
    confidence: 0.64,
    horizon: "long",
  },
  capital_allocation: {
    signal_type: "capex_ai_infrastructure",
    category: "capex",
    direction: "mixed",
    raw_score: 0.05,
    confidence: 0.55,
    horizon: "long",
  },
  cash_flow_quality: {
    signal_type: "cash_flow_quality",
    category: "cash_flow",
    direction: "neutral",
    raw_score: 0,
    confidence: 0.5,
    horizon: "unknown",
  },
  balance_sheet_risk: {
    signal_type: "risk_uncertainty",
    category: "risk",
    direction: "negative",
    raw_score: -0.15,
    confidence: 0.55,
    horizon: "long",
  },
  litigation_regulatory_risk: {
    signal_type: "risk_uncertainty",
    category: "risk",
    direction: "negative",
    raw_score: -0.2,
    confidence: 0.6,
    horizon: "long",
  },
  competitive_moat: {
    signal_type: "competitive_position",
    category: "other",
    direction: "mixed",
    raw_score: 0.05,
    confidence: 0.55,
    horizon: "long",
  },
  disruption_risk: {
    signal_type: "competitive_position",
    category: "risk",
    direction: "negative",
    raw_score: -0.15,
    confidence: 0.55,
    horizon: "long",
  },
  management_uncertainty: {
    signal_type: "management_tone",
    category: "risk",
    direction: "mixed",
    raw_score: -0.05,
    confidence: 0.55,
    horizon: "short",
  },
};

const REQUIRED_SIGNAL_FIELDS = [
  "ticker",
  "source_type",
  "source_date",
  "available_at",
  "signal_type",
  "evidence",
  "research_only",
  "portfolio_actionable",
  "requires_human_review",
];

const FORBIDDEN_TRADE_FIELDS = new Set([
  "target_weight",
  "targetWeight",
  "order_size",
  "orderSize",
  "broker_action",
  "brokerAction",
  "execution_instruction",
  "executionInstruction",
  "trade_action",
  "tradeAction",
  "portfolio_action",
  "portfolioAction",
  "order",
  "trade",
]);

function runDocumentSignalDryRun(fixtureBundle, options = {}) {
  const signals = normalizeDocumentSignalFixture(fixtureBundle);
  const output = {
    schema_version: SCHEMA_VERSION,
    run_id: "document-signal-agent-v0-synthetic-msft",
    mode: "synthetic_fixture_dry_run",
    fixture_path: options.fixturePath || DEFAULT_FIXTURE_PATH,
    run_metadata: {
      timestamp_policy: "Signal created_at values come from fixture capture timestamps; no current clock is used.",
      method: METHOD,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
    },
    source_pack: {
      source_pack_id: getSourcePackId(fixtureBundle),
      fixture_name: fixtureBundle.fixture_name || null,
      fixture_version: fixtureBundle.fixture_version || null,
      ticker: fixtureBundle.ticker || null,
      company_name: fixtureBundle.company || null,
      synthetic: fixtureBundle.synthetic === true,
      not_real_market_data: fixtureBundle.not_real_market_data === true,
      document_count: Array.isArray(fixtureBundle.documents) ? fixtureBundle.documents.length : 0,
    },
    safety: {
      research_only: true,
      portfolio_actionable: false,
      requires_human_review: true,
      live_apis_called: false,
      google_drive_ingested: false,
      llm_used: false,
      portfolio_written: false,
      report_written: false,
      production_storage_written: false,
    },
    signals,
  };

  output.validation = validateDocumentSignalOutput(output);
  return output;
}

function normalizeDocumentSignalFixture(fixtureBundle) {
  if (!fixtureBundle || !Array.isArray(fixtureBundle.documents)) {
    throw new Error("Document Signal Agent fixture must include a documents array.");
  }

  const sourcePackId = getSourcePackId(fixtureBundle);
  const signals = [];

  fixtureBundle.documents.forEach((document, documentIndex) => {
    validateSourceDocument(document, documentIndex);

    const sourceDocumentId = getSourceDocumentId(document, documentIndex);
    const expectedTypes = Array.isArray(document.expected_signal_types)
      ? document.expected_signal_types
      : [];

    expectedTypes.forEach((expectedType) => {
      const rule = EXPECTED_SIGNAL_RULES[expectedType];
      if (!rule || !SUPPORTED_SIGNAL_TYPES.has(rule.signal_type)) return;

      signals.push(buildSignal({
        fixtureBundle,
        document,
        documentIndex,
        sourcePackId,
        sourceDocumentId,
        expectedType,
        rule,
      }));
    });
  });

  return signals;
}

function buildSignal({ fixtureBundle, document, documentIndex, sourcePackId, sourceDocumentId, expectedType, rule }) {
  const ticker = normalizeTicker(document.ticker || fixtureBundle.ticker);
  const evidenceText = String(document.excerpt || "").trim();

  return {
    ticker,
    company_name: document.company || fixtureBundle.company || null,
    source_pack_id: sourcePackId,
    source_document_id: sourceDocumentId,
    source_type: document.source_type,
    source_title: document.document_title,
    source_date: document.source_date,
    available_at: document.available_at,
    captured_at: document.captured_at || null,
    signal_id: buildSignalId(sourcePackId, sourceDocumentId, expectedType),
    signal_type: rule.signal_type,
    category: rule.category,
    direction: rule.direction,
    raw_score: rule.raw_score,
    confidence: rule.confidence,
    horizon: rule.horizon,
    evidence: [
      {
        text: evidenceText,
        source_document_id: sourceDocumentId,
        locator: `documents[${documentIndex}].excerpt`,
      },
    ],
    research_only: true,
    portfolio_actionable: false,
    requires_human_review: true,
    allowed_action: "research_only",
    can_directly_trade: false,
    model: MODEL,
    method: METHOD,
    prompt_version: PROMPT_VERSION,
    created_at: document.captured_at || document.available_at || document.source_date,
    notes: [
      `Normalized from fixture expected_signal_types entry: ${expectedType}`,
      "Prototype normalization only; no LLM, live API, Google Drive ingestion, or portfolio integration.",
    ],
  };
}

function validateDocumentSignalOutput(output) {
  const errors = [];
  const warnings = [];

  if (!output || !Array.isArray(output.signals)) {
    errors.push("Output must include a signals array.");
    return { passed: false, errors, warnings };
  }

  output.signals.forEach((signal, index) => {
    for (const field of REQUIRED_SIGNAL_FIELDS) {
      if (signal[field] == null || signal[field] === "") {
        errors.push(`signals[${index}] missing required field: ${field}`);
      }
    }

    if (!SUPPORTED_SIGNAL_TYPES.has(signal.signal_type)) {
      errors.push(`signals[${index}] unsupported signal_type: ${signal.signal_type}`);
    }
    if (!Array.isArray(signal.evidence) || signal.evidence.length === 0) {
      errors.push(`signals[${index}] must include evidence.`);
    } else {
      signal.evidence.forEach((item, evidenceIndex) => {
        if (!item.text || !item.source_document_id) {
          errors.push(`signals[${index}].evidence[${evidenceIndex}] missing text or source_document_id.`);
        }
      });
    }
    if (signal.research_only !== true) errors.push(`signals[${index}] research_only must be true.`);
    if (signal.portfolio_actionable !== false) errors.push(`signals[${index}] portfolio_actionable must be false.`);
    if (signal.requires_human_review !== true) errors.push(`signals[${index}] requires_human_review must be true.`);
    if (signal.allowed_action !== "research_only") errors.push(`signals[${index}] allowed_action must be research_only.`);
    if (signal.can_directly_trade !== false) errors.push(`signals[${index}] can_directly_trade must be false.`);
    if (signal.model !== MODEL) errors.push(`signals[${index}] model must be none.`);
    if (signal.method !== METHOD) errors.push(`signals[${index}] method must be ${METHOD}.`);
    if (signal.prompt_version !== PROMPT_VERSION) errors.push(`signals[${index}] prompt_version must be none.`);

    const forbiddenFields = findForbiddenTradeFields(signal);
    for (const fieldPath of forbiddenFields) {
      errors.push(`signals[${index}] includes forbidden trade/execution field: ${fieldPath}`);
    }

    const actionLanguage = findActionLanguage(signal);
    if (actionLanguage.length > 0) {
      errors.push(`signals[${index}] contains trade recommendation language in action-like field(s): ${actionLanguage.join(", ")}`);
    }
  });

  if (output.signals.length === 0) warnings.push("No document signals were produced.");

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    signal_count: output.signals.length,
  };
}

function validateSourceDocument(document, documentIndex) {
  const required = [
    "ticker",
    "company",
    "source_type",
    "source_date",
    "available_at",
    "document_title",
    "excerpt",
    "allowed_action",
    "can_directly_trade",
  ];

  for (const field of required) {
    if (document[field] == null || document[field] === "") {
      throw new Error(`Fixture document ${documentIndex} missing required field: ${field}`);
    }
  }
  if (document.allowed_action !== "research_only") {
    throw new Error(`Fixture document ${documentIndex} must be research_only.`);
  }
  if (document.can_directly_trade !== false) {
    throw new Error(`Fixture document ${documentIndex} cannot directly trade.`);
  }
}

function findForbiddenTradeFields(value, path = "signal") {
  if (!value || typeof value !== "object") return [];
  const found = [];

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_TRADE_FIELDS.has(key)) found.push(childPath);
    if (child && typeof child === "object") found.push(...findForbiddenTradeFields(child, childPath));
  }

  return found;
}

function findActionLanguage(signal) {
  const actionLikeFields = [
    "action",
    "recommendation",
    "portfolio_recommendation",
    "trade_recommendation",
    "execution_instruction",
  ];
  const flagged = [];

  for (const field of actionLikeFields) {
    if (typeof signal[field] === "string" && /\b(BUY|SELL|HOLD)\b/i.test(signal[field])) {
      flagged.push(field);
    }
  }

  return flagged;
}

function getSourcePackId(fixtureBundle) {
  return slugify(fixtureBundle.fixture_name || `${fixtureBundle.ticker || "unknown"} document signal fixture`);
}

function getSourceDocumentId(document, index) {
  const base = document.document_title || `${document.source_type || "document"} ${index + 1}`;
  return slugify(base);
}

function buildSignalId(sourcePackId, sourceDocumentId, expectedType) {
  return slugify(`${sourcePackId}-${sourceDocumentId}-${expectedType}`);
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .trim()
    .toUpperCase()
    .replace(/\.US$/, "")
    .replace("-", ".");
}

function slugify(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  DEFAULT_FIXTURE_PATH,
  EXPECTED_SIGNAL_RULES,
  METHOD,
  MODEL,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  SUPPORTED_SIGNAL_TYPES,
  normalizeDocumentSignalFixture,
  runDocumentSignalDryRun,
  validateDocumentSignalOutput,
};
