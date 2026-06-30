const { extractDocumentSourcesFromFixture } = require("./documentSourceExtractor");

const METHOD = "section-rule-v0.1";
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
  const extractionOutput = options.extractionOutput || extractDocumentSourcesFromFixture(fixtureBundle, {
    fixturePath: options.fixturePath || DEFAULT_FIXTURE_PATH,
  });
  const signals = normalizeExtractedDocuments(extractionOutput);
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
    extraction: {
      schema_version: extractionOutput.schema_version,
      extraction_method: extractionOutput.extraction_method,
      document_count: extractionOutput.documents.length,
      section_count: extractionOutput.validation?.section_count || countSections(extractionOutput.documents),
      validation: extractionOutput.validation,
    },
    source_pack: {
      source_pack_id: extractionOutput.source_pack.source_pack_id,
      fixture_name: fixtureBundle.fixture_name || null,
      fixture_version: fixtureBundle.fixture_version || null,
      ticker: fixtureBundle.ticker || null,
      company_name: fixtureBundle.company || null,
      synthetic: fixtureBundle.synthetic === true,
      not_real_market_data: fixtureBundle.not_real_market_data === true,
      document_count: extractionOutput.documents.length,
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
  const extractionOutput = extractDocumentSourcesFromFixture(fixtureBundle);
  return normalizeExtractedDocuments(extractionOutput);
}

function normalizeExtractedDocuments(extractionOutput) {
  if (!extractionOutput || !Array.isArray(extractionOutput.documents)) {
    throw new Error("Document Signal Agent extraction input must include a documents array.");
  }

  const signals = [];

  extractionOutput.documents.forEach((document) => {
    validateExtractedDocument(document);

    document.sections.forEach((section) => {
      const signalTags = Array.isArray(section.signal_tags) ? section.signal_tags : [];
      signalTags.forEach((expectedType) => {
        const rule = EXPECTED_SIGNAL_RULES[expectedType];
        if (!rule || !SUPPORTED_SIGNAL_TYPES.has(rule.signal_type)) return;

        signals.push(buildSignal({
          document,
          section,
          expectedType,
          rule,
        }));
      });
    });
  });

  return signals;
}

function buildSignal({ document, section, expectedType, rule }) {
  const ticker = normalizeTicker(document.ticker);
  const evidenceText = String(section.text || "").trim();

  return {
    ticker,
    company_name: document.company_name || null,
    source_pack_id: document.source_pack_id,
    source_document_id: document.source_document_id,
    source_type: document.source_type,
    source_title: document.source_title,
    source_date: document.source_date,
    available_at: document.available_at,
    captured_at: document.captured_at || null,
    signal_id: buildSignalId(document.source_pack_id, document.source_document_id, expectedType),
    signal_type: rule.signal_type,
    category: rule.category,
    direction: rule.direction,
    raw_score: rule.raw_score,
    confidence: rule.confidence,
    horizon: rule.horizon,
    evidence: [
      {
        text: evidenceText,
        source_document_id: document.source_document_id,
        locator: section.locator,
        section_id: section.section_id,
        heading: section.heading,
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
      `Normalized from extracted section tag: ${expectedType}`,
      `Source section: ${section.heading}`,
      "v0.1 deterministic scaffolding only; no LLM, live API, Google Drive ingestion, or portfolio integration.",
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

  if (output.extraction && output.extraction.validation?.passed !== true) {
    errors.push("Extraction validation must pass before signals are accepted.");
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

function validateExtractedDocument(document) {
  const required = [
    "ticker",
    "company_name",
    "source_pack_id",
    "source_document_id",
    "source_type",
    "source_title",
    "source_date",
    "available_at",
    "sections",
    "allowed_action",
    "can_directly_trade",
  ];

  for (const field of required) {
    if (document[field] == null || document[field] === "") {
      throw new Error(`Extracted document ${document.source_document_id || "unknown"} missing required field: ${field}`);
    }
  }
  if (document.allowed_action !== "research_only") {
    throw new Error(`Extracted document ${document.source_document_id} must be research_only.`);
  }
  if (document.can_directly_trade !== false) {
    throw new Error(`Extracted document ${document.source_document_id} cannot directly trade.`);
  }
  if (!Array.isArray(document.sections) || document.sections.length === 0) {
    throw new Error(`Extracted document ${document.source_document_id} must include sections.`);
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

function buildSignalId(sourcePackId, sourceDocumentId, expectedType) {
  return slugify(`${sourcePackId}-${sourceDocumentId}-${expectedType}`);
}

function countSections(documents) {
  return documents.reduce((sum, document) => sum + (document.sections?.length || 0), 0);
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
  normalizeExtractedDocuments,
  runDocumentSignalDryRun,
  validateDocumentSignalOutput,
};
