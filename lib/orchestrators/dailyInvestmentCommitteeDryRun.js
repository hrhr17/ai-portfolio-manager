const fs = require("fs");
const path = require("path");
const {
  DEFAULT_FIXTURE_PATH: X_INTAKE_FIXTURE_PATH,
  runManualXIntakeDryRun,
} = require("../sources/xIntelligenceIntake");
const {
  DEFAULT_FIXTURE_PATH: DOCUMENT_SIGNAL_FIXTURE_PATH,
  runDocumentSignalDryRun,
} = require("../agents/documentSignalAgent");
const {
  DEFAULT_DRIVE_METADATA_FIXTURE_PATH,
  buildDriveMetadataOutput,
} = require("../utils/driveMetadata");
const { loadPaperPortfolioSnapshot } = require("../portfolio/paperPortfolio");
const { DEFAULT_RULES } = require("../risk/riskEngine");

const RUN_MODE = "dry_run";
const ALLOWED_ACTION = "research_only";

const FORBIDDEN_PACKET_FIELDS = [
  "action",
  "recommendation",
  "recommendations",
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
  "option_action",
  "options_action",
  "margin_action",
  "crypto_action",
  "token_action",
];

function runDailyInvestmentCommitteeDryRun(options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const xIntakeOutput = runManualXIntakeDryRun(loadJsonFixture(X_INTAKE_FIXTURE_PATH), {
    fixturePath: X_INTAKE_FIXTURE_PATH,
  });
  const documentSignalOutput = runDocumentSignalDryRun(loadJsonFixture(DOCUMENT_SIGNAL_FIXTURE_PATH), {
    fixturePath: DOCUMENT_SIGNAL_FIXTURE_PATH,
  });
  const driveMetadataOutput = buildDriveMetadataDryRun();
  const paperPortfolioSummary = buildPaperPortfolioSummary(loadPaperPortfolioSnapshot());

  const packet = {
    run_id: buildRunId(createdAt),
    run_mode: RUN_MODE,
    created_at: createdAt,
    modules_run: [
      "manual_x_intelligence_intake",
      "document_signal_agent",
      "drive_source_pack_metadata",
      "paper_portfolio_placeholder",
      "deterministic_safety_review",
    ],
    module_statuses: {
      manual_x_intelligence_intake: buildModuleStatus(xIntakeOutput.validation?.passed, {
        records_processed: xIntakeOutput.summary.total_records_processed,
        duplicate_count: xIntakeOutput.summary.duplicate_count,
      }),
      document_signal_agent: buildModuleStatus(documentSignalOutput.validation?.passed, {
        signal_count: documentSignalOutput.validation?.signal_count || documentSignalOutput.signals.length,
        document_count: documentSignalOutput.extraction.document_count,
      }),
      drive_source_pack_metadata: buildModuleStatus(driveMetadataOutput.validation?.passed, {
        file_count: driveMetadataOutput.validation?.file_count || driveMetadataOutput.files.length,
        metadata_only: driveMetadataOutput.safety.metadata_only,
      }),
      paper_portfolio_placeholder: buildModuleStatus(true, {
        position_count: paperPortfolioSummary.position_count,
        persisted: false,
      }),
      deterministic_safety_review: {
        status: "pending",
        validation_passed: null,
      },
    },
    x_intake_summary: summarizeXIntake(xIntakeOutput),
    document_signal_summary: summarizeDocumentSignals(documentSignalOutput),
    drive_metadata_summary: summarizeDriveMetadata(driveMetadataOutput),
    paper_portfolio_summary: paperPortfolioSummary,
    safety_summary: buildSafetySummary(),
    human_review_required: true,
    allowed_action: ALLOWED_ACTION,
    can_directly_trade: false,
    prohibited_actions_found: false,
    next_recommended_human_actions: [
      "Review top routed X intake items for research relevance.",
      "Review synthetic document signal counts and evidence coverage.",
      "Confirm Drive source-pack metadata remains metadata-only.",
      "Decide which safe dry-run packet fields should be persisted in a future PR.",
    ],
  };

  const validation = validateDailyDryRunPacket(packet);
  packet.prohibited_actions_found = validation.prohibited_actions_found;
  packet.safety_summary.validation_passed = validation.passed;
  packet.safety_summary.prohibited_field_paths = validation.prohibited_field_paths;
  packet.safety_summary.action_language_paths = validation.action_language_paths;
  packet.module_statuses.deterministic_safety_review = buildModuleStatus(validation.passed, {
    prohibited_actions_found: validation.prohibited_actions_found,
  });
  packet.validation = validateDailyDryRunPacket(packet);
  packet.safety_summary.validation_passed = packet.validation.passed;
  packet.prohibited_actions_found = packet.validation.prohibited_actions_found;

  return packet;
}

function buildDriveMetadataDryRun() {
  const fixture = loadJsonFixture(DEFAULT_DRIVE_METADATA_FIXTURE_PATH);
  return buildDriveMetadataOutput({
    files: fixture.files,
    source: {
      ...fixture.source,
      fixture_path: DEFAULT_DRIVE_METADATA_FIXTURE_PATH,
    },
    liveApiCalled: false,
  });
}

function summarizeXIntake(output) {
  return {
    mode: output.mode,
    fixture_name: output.fixture_name,
    fixture_version: output.fixture_version,
    total_records_processed: output.summary.total_records_processed,
    count_by_intake_mode: output.summary.count_by_intake_mode,
    count_by_category: output.summary.count_by_category,
    count_by_route: output.summary.count_by_route,
    duplicate_count: output.summary.duplicate_count,
    safety_status: output.summary.safety_status,
    top_routed_items_by_priority: output.summary.top_routed_items_by_priority,
    validation_passed: output.validation.passed,
    live_x_api_called: output.safety.live_x_api_called,
    external_network_called: output.safety.external_network_called,
  };
}

function summarizeDocumentSignals(output) {
  return {
    mode: output.mode,
    fixture_path: output.fixture_path,
    synthetic: output.source_pack.synthetic,
    not_real_market_data: output.source_pack.not_real_market_data,
    ticker: output.source_pack.ticker,
    document_count: output.extraction.document_count,
    section_count: output.extraction.section_count,
    signal_count: output.validation.signal_count,
    count_by_signal_type: countBy(output.signals, "signal_type"),
    validation_passed: output.validation.passed,
    live_apis_called: output.safety.live_apis_called,
    google_drive_ingested: output.safety.google_drive_ingested,
    llm_used: output.safety.llm_used,
  };
}

function summarizeDriveMetadata(output) {
  return {
    mode: output.mode,
    fixture_path: output.source.fixture_path,
    file_count: output.validation.file_count,
    source_type_counts: countBy(output.files, "source_type_guess"),
    validation_passed: output.validation.passed,
    metadata_only: output.safety.metadata_only,
    content_fetched: output.safety.content_fetched,
    content_parsed: output.safety.content_parsed,
    live_api_called: output.safety.live_api_called,
  };
}

function buildPaperPortfolioSummary(snapshot) {
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
  return {
    mode: "placeholder_status",
    as_of: snapshot.asOf,
    cash_weight_pct: snapshot.cashWeightPct,
    position_count: positions.length,
    positions_present: positions.length > 0,
    persistent_store_configured: Boolean(process.env.PAPER_PORTFOLIO_JSON),
    portfolio_written: false,
    ledger_written: false,
    notes: [
      "Dry-run status only.",
      "No paper portfolio ledger is written by this orchestrator.",
    ],
  };
}

function buildSafetySummary() {
  return {
    research_only: true,
    dry_run_only: true,
    deterministic_rules_only: true,
    live_trading_disabled: DEFAULT_RULES.noLiveTrading,
    brokerage_execution_disabled: true,
    margin_disabled: DEFAULT_RULES.noMargin,
    options_disabled: DEFAULT_RULES.noOptions,
    crypto_token_trading_disabled: DEFAULT_RULES.noCrypto,
    x_live_api_called: false,
    x_oauth_used: false,
    x_mcp_used: false,
    x_scraping_used: false,
    external_network_called: false,
    llm_used: false,
    google_drive_content_ingested: false,
    portfolio_written: false,
    report_written: false,
    production_storage_written: false,
    validation_passed: null,
    prohibited_field_paths: [],
    action_language_paths: [],
  };
}

function validateDailyDryRunPacket(packet) {
  const errors = [];
  const prohibitedFieldPaths = findForbiddenFields(packet);
  const actionLanguagePaths = findActionLanguage(packet);

  if (!packet || typeof packet !== "object") {
    return {
      passed: false,
      errors: ["Packet must be an object."],
      prohibited_actions_found: true,
      prohibited_field_paths: [],
      action_language_paths: [],
    };
  }

  if (packet.run_mode !== RUN_MODE) errors.push("run_mode must be dry_run.");
  if (packet.allowed_action !== ALLOWED_ACTION) errors.push("allowed_action must be research_only.");
  if (packet.can_directly_trade !== false) errors.push("can_directly_trade must be false.");
  if (packet.human_review_required !== true) errors.push("human_review_required must be true.");

  const moduleStatuses = Object.values(packet.module_statuses || {});
  if (moduleStatuses.some((status) => status.validation_passed === false)) {
    errors.push("All module statuses must pass validation.");
  }

  if (packet.safety_summary?.research_only !== true) errors.push("safety_summary.research_only must be true.");
  if (packet.safety_summary?.dry_run_only !== true) errors.push("safety_summary.dry_run_only must be true.");
  if (packet.safety_summary?.x_live_api_called !== false) errors.push("X live API calls are prohibited.");
  if (packet.safety_summary?.external_network_called !== false) errors.push("External network calls are prohibited.");
  if (packet.safety_summary?.llm_used !== false) errors.push("LLM calls are prohibited.");
  if (packet.safety_summary?.portfolio_written !== false) errors.push("Portfolio writes are prohibited.");
  if (packet.safety_summary?.report_written !== false) errors.push("Report writes are prohibited.");
  if (packet.safety_summary?.production_storage_written !== false) errors.push("Production writes are prohibited.");

  if (prohibitedFieldPaths.length > 0) {
    errors.push(`Forbidden packet fields found: ${prohibitedFieldPaths.join(", ")}`);
  }
  if (actionLanguagePaths.length > 0) {
    errors.push(`Trade recommendation language found: ${actionLanguagePaths.join(", ")}`);
  }

  return {
    passed: errors.length === 0,
    errors,
    prohibited_actions_found: prohibitedFieldPaths.length > 0 || actionLanguagePaths.length > 0,
    prohibited_field_paths: prohibitedFieldPaths,
    action_language_paths: actionLanguagePaths,
  };
}

function buildReadableDailyDryRunSummary(packet) {
  return [
    "Daily Investment Committee dry run",
    `Run ID: ${packet.run_id}`,
    `Mode: ${packet.run_mode}`,
    `Created at: ${packet.created_at}`,
    `Modules run: ${packet.modules_run.join(", ")}`,
    `X intake records: ${packet.x_intake_summary.total_records_processed}`,
    `X duplicate count: ${packet.x_intake_summary.duplicate_count}`,
    `Document signals: ${packet.document_signal_summary.signal_count}`,
    `Drive metadata files: ${packet.drive_metadata_summary.file_count}`,
    `Paper portfolio positions: ${packet.paper_portfolio_summary.position_count}`,
    `Safety validation: ${packet.validation.passed ? "passed" : "failed"}`,
    "Top routed items:",
    ...packet.x_intake_summary.top_routed_items_by_priority.map((item) =>
      `- ${item.priority} | ${item.category} | ${item.route} | ${item.signal_id}`
    ),
    "Next human actions:",
    ...packet.next_recommended_human_actions.map((item) => `- ${item}`),
  ].join("\n");
}

function buildModuleStatus(passed, extra = {}) {
  return {
    status: passed ? "passed" : "failed",
    validation_passed: Boolean(passed),
    ...extra,
  };
}

function findForbiddenFields(value, currentPath = "packet") {
  if (!value || typeof value !== "object") return [];
  const found = [];

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (FORBIDDEN_PACKET_FIELDS.includes(key)) found.push(childPath);
    if (child && typeof child === "object") found.push(...findForbiddenFields(child, childPath));
  }

  return found;
}

function findActionLanguage(value, currentPath = "packet") {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findActionLanguage(item, `${currentPath}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => findActionLanguage(child, `${currentPath}.${key}`));
  }
  if (typeof value !== "string") return [];

  return /\b(BUY|SELL|HOLD)\b/.test(value) ? [currentPath] : [];
}

function countBy(items, field) {
  return (items || []).reduce((counts, item) => {
    const key = item[field] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function loadJsonFixture(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8"));
}

function buildRunId(createdAt) {
  return `daily-committee-dry-run-${createdAt.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")}`;
}

module.exports = {
  FORBIDDEN_PACKET_FIELDS,
  RUN_MODE,
  buildReadableDailyDryRunSummary,
  runDailyInvestmentCommitteeDryRun,
  validateDailyDryRunPacket,
};
