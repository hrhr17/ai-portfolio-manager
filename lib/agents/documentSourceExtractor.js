const EXTRACTION_SCHEMA_VERSION = "document_source_extraction_v0_1";
const EXTRACTION_METHOD = "synthetic-fixture-sectionizer-v0.1";

const SECTION_RULES = {
  demand_commentary: {
    section_id: "revenue-demand",
    heading: "Revenue / Demand",
    section_type: "demand",
  },
  guidance_sentiment: {
    section_id: "guidance-outlook",
    heading: "Guidance / Outlook",
    section_type: "guidance",
  },
  margin_pricing: {
    section_id: "margin-pricing",
    heading: "Margin / Pricing",
    section_type: "margin",
  },
  ai_exposure: {
    section_id: "ai-infrastructure",
    heading: "AI Infrastructure",
    section_type: "ai_infrastructure",
  },
  capital_allocation: {
    section_id: "capital-allocation",
    heading: "Capital Allocation / Investment",
    section_type: "capex",
  },
  cash_flow_quality: {
    section_id: "cash-flow-quality",
    heading: "Cash Flow Quality",
    section_type: "cash_flow",
  },
  balance_sheet_risk: {
    section_id: "balance-sheet-risk",
    heading: "Balance Sheet / Risk",
    section_type: "risk",
  },
  litigation_regulatory_risk: {
    section_id: "litigation-regulatory-risk",
    heading: "Litigation / Regulatory Risk",
    section_type: "risk",
  },
  competitive_moat: {
    section_id: "competitive-position",
    heading: "Competitive Position",
    section_type: "competitive_position",
  },
  disruption_risk: {
    section_id: "disruption-risk",
    heading: "Disruption Risk",
    section_type: "risk",
  },
  management_uncertainty: {
    section_id: "management-tone-uncertainty",
    heading: "Management Tone / Uncertainty",
    section_type: "management_tone",
  },
};

const REQUIRED_DOCUMENT_FIELDS = [
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

function extractDocumentSourcesFromFixture(fixtureBundle, options = {}) {
  if (!fixtureBundle || !Array.isArray(fixtureBundle.documents)) {
    throw new Error("Document source extraction fixture must include a documents array.");
  }

  const sourcePackId = getSourcePackId(fixtureBundle);
  const documents = fixtureBundle.documents.map((document, index) => {
    validateFixtureDocument(document, index);
    return extractDocumentRecord({
      document,
      documentIndex: index,
      fixtureBundle,
      sourcePackId,
    });
  });

  const output = {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    mode: "synthetic_fixture_source_extraction",
    fixture_path: options.fixturePath || null,
    extraction_method: EXTRACTION_METHOD,
    source_pack: {
      source_pack_id: sourcePackId,
      fixture_name: fixtureBundle.fixture_name || null,
      fixture_version: fixtureBundle.fixture_version || null,
      ticker: fixtureBundle.ticker || null,
      company_name: fixtureBundle.company || null,
      synthetic: fixtureBundle.synthetic === true,
      not_real_market_data: fixtureBundle.not_real_market_data === true,
      document_count: documents.length,
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
    documents,
  };

  output.validation = validateDocumentExtractionOutput(output);
  return output;
}

function extractDocumentRecord({ document, documentIndex, fixtureBundle, sourcePackId }) {
  const sourceDocumentId = getSourceDocumentId(document, documentIndex);
  const text = String(document.excerpt || "").trim();
  const sections = extractSections(document, documentIndex, sourceDocumentId);

  return {
    source_pack_id: sourcePackId,
    source_document_id: sourceDocumentId,
    ticker: normalizeTicker(document.ticker || fixtureBundle.ticker),
    company_name: document.company || fixtureBundle.company || null,
    source_type: document.source_type,
    source_title: document.document_title,
    source_url: document.source_url || null,
    source_label: document.source_label || "manual_sample_document",
    source_date: document.source_date,
    available_at: document.available_at,
    captured_at: document.captured_at || null,
    synthetic: fixtureBundle.synthetic === true,
    not_real_market_data: fixtureBundle.not_real_market_data === true,
    data_available_at_decision_time: document.data_available_at_decision_time || "unknown",
    text,
    sections,
    allowed_action: "research_only",
    can_directly_trade: false,
    extraction_method: EXTRACTION_METHOD,
    notes: [
      "Synthetic fixture extraction only; no DOCX/XLSX/PPTX parsing.",
      "No Google Drive fetch, live API call, LLM call, report write, or portfolio integration.",
    ],
  };
}

function extractSections(document, documentIndex, sourceDocumentId) {
  if (Array.isArray(document.sections) && document.sections.length > 0) {
    return document.sections.map((section, sectionIndex) => normalizeExplicitSection({
      section,
      documentIndex,
      sectionIndex,
      sourceDocumentId,
    }));
  }

  const expectedTypes = Array.isArray(document.expected_signal_types)
    ? document.expected_signal_types
    : [];

  if (expectedTypes.length === 0) {
    return [
      {
        section_id: `${sourceDocumentId}-excerpt`,
        heading: "Manual Excerpt",
        section_type: "other",
        signal_tags: [],
        text: String(document.excerpt || "").trim(),
        source_document_id: sourceDocumentId,
        locator: `documents[${documentIndex}].excerpt`,
      },
    ];
  }

  return expectedTypes.map((expectedType, sectionIndex) => {
    const rule = SECTION_RULES[expectedType] || {
      section_id: slugify(expectedType || `section-${sectionIndex + 1}`),
      heading: humanize(expectedType || `Section ${sectionIndex + 1}`),
      section_type: "other",
    };

    return {
      section_id: `${sourceDocumentId}-${rule.section_id}`,
      heading: rule.heading,
      section_type: rule.section_type,
      signal_tags: [expectedType],
      text: String(document.excerpt || "").trim(),
      source_document_id: sourceDocumentId,
      locator: `documents[${documentIndex}].expected_signal_types[${sectionIndex}]`,
    };
  });
}

function normalizeExplicitSection({ section, documentIndex, sectionIndex, sourceDocumentId }) {
  const heading = section.heading || `Section ${sectionIndex + 1}`;
  return {
    section_id: section.section_id || `${sourceDocumentId}-${slugify(heading)}`,
    heading,
    section_type: section.section_type || "other",
    signal_tags: Array.isArray(section.signal_tags) ? section.signal_tags : [],
    text: String(section.text || "").trim(),
    source_document_id: sourceDocumentId,
    locator: section.locator || `documents[${documentIndex}].sections[${sectionIndex}]`,
  };
}

function validateDocumentExtractionOutput(output) {
  const errors = [];
  const warnings = [];

  if (!output || !Array.isArray(output.documents)) {
    errors.push("Extraction output must include a documents array.");
    return { passed: false, errors, warnings };
  }

  output.documents.forEach((document, documentIndex) => {
    for (const field of [
      "source_document_id",
      "ticker",
      "company_name",
      "source_type",
      "source_title",
      "source_date",
      "available_at",
      "text",
      "allowed_action",
      "can_directly_trade",
    ]) {
      if (document[field] == null || document[field] === "") {
        errors.push(`documents[${documentIndex}] missing required field: ${field}`);
      }
    }
    if (document.synthetic !== true) errors.push(`documents[${documentIndex}] synthetic must be true.`);
    if (document.not_real_market_data !== true) errors.push(`documents[${documentIndex}] not_real_market_data must be true.`);
    if (document.allowed_action !== "research_only") errors.push(`documents[${documentIndex}] allowed_action must be research_only.`);
    if (document.can_directly_trade !== false) errors.push(`documents[${documentIndex}] can_directly_trade must be false.`);
    if (!Array.isArray(document.sections) || document.sections.length === 0) {
      errors.push(`documents[${documentIndex}] must include sections.`);
    } else {
      document.sections.forEach((section, sectionIndex) => {
        for (const field of ["section_id", "heading", "text", "locator", "source_document_id"]) {
          if (section[field] == null || section[field] === "") {
            errors.push(`documents[${documentIndex}].sections[${sectionIndex}] missing required field: ${field}`);
          }
        }
      });
    }
  });

  if (output.documents.length === 0) warnings.push("No extracted documents were produced.");

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    document_count: output.documents.length,
    section_count: output.documents.reduce((sum, document) => sum + (document.sections?.length || 0), 0),
  };
}

function validateFixtureDocument(document, documentIndex) {
  for (const field of REQUIRED_DOCUMENT_FIELDS) {
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

function getSourcePackId(fixtureBundle) {
  return slugify(fixtureBundle.fixture_name || `${fixtureBundle.ticker || "unknown"} document signal fixture`);
}

function getSourceDocumentId(document, index) {
  const base = document.document_title || `${document.source_type || "document"} ${index + 1}`;
  return slugify(base);
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .trim()
    .toUpperCase()
    .replace(/\.US$/, "")
    .replace("-", ".");
}

function humanize(value) {
  return String(value || "Section")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  EXTRACTION_METHOD,
  EXTRACTION_SCHEMA_VERSION,
  SECTION_RULES,
  extractDocumentSourcesFromFixture,
  validateDocumentExtractionOutput,
};
