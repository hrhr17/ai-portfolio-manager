const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  ALLOWED_CATEGORIES,
  ALLOWED_INTAKE_MODES,
  ALLOWED_ROUTES,
  CLASSIFICATION_VERSION,
  DEFAULT_FIXTURE_PATH,
  FORBIDDEN_OUTPUT_FIELDS,
  ROUTE_VERSION,
  runManualXIntakeDryRun,
} = require("../lib/sources/xIntelligenceIntake");

const FORBIDDEN_RUNTIME_PATTERNS = [
  "fetch(",
  "axios",
  "http.request",
  "https.request",
  "api.x.com",
  "api.twitter.com",
  "playwright",
  "puppeteer",
  "selenium",
];

const REQUIRED_SIGNAL_FIELDS = [
  "signal_id",
  "intake_mode",
  "source_item_id",
  "source_post_id",
  "source_platform",
  "source_url",
  "normalized_source_url",
  "source_author_handle",
  "author_handle",
  "source_created_at",
  "bookmarked_at",
  "imported_at",
  "import_batch_id",
  "source_folder",
  "dedupe_key",
  "content_hash",
  "prior_seen",
  "captured_at",
  "raw_text",
  "user_note",
  "detected_tickers",
  "category",
  "route",
  "priority",
  "confidence",
  "rationale",
  "allowed_action",
  "can_directly_trade",
  "requires_human_review",
  "created_at",
  "routed_at",
  "route_version",
  "classification_version",
  "safety_flags",
];

const OPTIONAL_SIGNAL_FIELDS = [
  "source_post_id",
  "source_url",
  "normalized_source_url",
  "source_created_at",
  "bookmarked_at",
  "source_folder",
];

const REQUIRED_SAMPLE_CATEGORIES = [
  "ai_tool_or_workflow",
  "startup_to_watch",
  "business_opportunity",
  "content_idea",
  "general_intelligence",
  "company_news",
  "equity_research",
  "earnings_catalyst",
  "noise",
];

function main() {
  const fixture = JSON.parse(fs.readFileSync(DEFAULT_FIXTURE_PATH, "utf8"));
  assert.strictEqual(fixture.synthetic, true, "fixture must be synthetic");
  assert.strictEqual(fixture.manual_fixture_only, true, "fixture must be manual fixture only");
  assert.ok(Array.isArray(fixture.items), "fixture.items must be an array");
  assert.ok(fixture.items.length >= 8 && fixture.items.length <= 12, "fixture should include 8-12 records");

  const output = runManualXIntakeDryRun(fixture, { fixturePath: DEFAULT_FIXTURE_PATH });
  assert.strictEqual(output.mode, "manual_fixture_dry_run");
  assert.strictEqual(output.validation.passed, true, JSON.stringify(output.validation.errors));
  assert.strictEqual(output.summary.total_records_processed, fixture.items.length);
  assert.ok(output.summary.count_by_intake_mode.historical_backfill > 0, "must include historical backfill records");
  assert.ok(output.summary.count_by_intake_mode.daily_incremental > 0, "must include daily incremental records");
  assert.ok(output.summary.count_by_intake_mode.manual_fixture > 0, "must include manual fixture records");
  assert.ok(output.summary.duplicate_count > 0, "must include duplicate examples");
  assert.ok(Array.isArray(output.summary.top_routed_items_by_priority), "must include top routed items");
  assert.ok(output.summary.top_routed_items_by_priority.length > 0, "top routed items should not be empty");
  assertSafetyFlags(output.safety);
  assertSignals(output.signals);
  assertRequiredSampleCategories(output.signals);
  assertRequiredRoutes(output.signals);
  assertDedupeBehavior(output.signals);
  assertNoRuntimeNetworkPaths();
  assertDryRunCommand();

  console.log(`Manual X intake validation passed (${output.signals.length} research-only signals).`);
}

function assertSafetyFlags(safety) {
  assert.strictEqual(safety.research_only, true, "safety.research_only must be true");
  assert.strictEqual(safety.manual_fixture_only, true, "safety.manual_fixture_only must be true");
  assert.strictEqual(safety.deterministic_rules_only, true, "safety.deterministic_rules_only must be true");
  assert.strictEqual(safety.live_x_api_called, false, "must not call live X API");
  assert.strictEqual(safety.oauth_used, false, "must not use OAuth");
  assert.strictEqual(safety.mcp_used, false, "must not use MCP");
  assert.strictEqual(safety.scraping_used, false, "must not scrape");
  assert.strictEqual(safety.browser_automation_used, false, "must not use browser automation");
  assert.strictEqual(safety.external_network_called, false, "must not call external networks");
  assert.strictEqual(safety.llm_used, false, "must not call LLMs");
  assert.strictEqual(safety.google_drive_read, false, "must not read Google Drive");
  assert.strictEqual(safety.portfolio_written, false, "must not write portfolio ledger");
  assert.strictEqual(safety.report_written, false, "must not write reports");
  assert.strictEqual(safety.production_storage_written, false, "must not write production storage");
}

function assertSignals(signals) {
  assert.ok(Array.isArray(signals), "signals must be an array");
  assert.ok(signals.length > 0, "signals should not be empty");

  for (const [index, signal] of signals.entries()) {
    for (const field of REQUIRED_SIGNAL_FIELDS) {
      assert.notStrictEqual(signal[field], undefined, `signals[${index}] missing ${field}`);
      if (!OPTIONAL_SIGNAL_FIELDS.includes(field)) {
        assert.notStrictEqual(signal[field], null, `signals[${index}] missing ${field}`);
      }
    }

    assert.ok(ALLOWED_INTAKE_MODES.includes(signal.intake_mode), `signals[${index}] unsupported intake_mode`);
    assert.ok(ALLOWED_CATEGORIES.includes(signal.category), `signals[${index}] unsupported category`);
    assert.ok(ALLOWED_ROUTES.includes(signal.route), `signals[${index}] unsupported route`);
    assert.strictEqual(signal.allowed_action, "research_only", `signals[${index}] must be research_only`);
    assert.strictEqual(signal.can_directly_trade, false, `signals[${index}] must not directly trade`);
    assert.strictEqual(signal.requires_human_review, true, `signals[${index}] must require human review`);
    assert.strictEqual(signal.route_version, ROUTE_VERSION, `signals[${index}] route_version mismatch`);
    assert.strictEqual(signal.classification_version, CLASSIFICATION_VERSION, `signals[${index}] classification_version mismatch`);
    assert.ok(Array.isArray(signal.detected_tickers), `signals[${index}] detected_tickers must be an array`);
    assert.ok(Array.isArray(signal.safety_flags), `signals[${index}] safety_flags must be an array`);
    assert.notStrictEqual(signal.route, "portfolio_action", `signals[${index}] must not route to portfolio_action`);
    assert.ok(signal.dedupe_key.startsWith("post:") || signal.dedupe_key.startsWith("url:") || signal.dedupe_key.startsWith("content:"), `signals[${index}] dedupe_key must have a known strategy`);

    if (signal.source_post_id) {
      assert.strictEqual(signal.dedupe_key, `post:${signal.source_post_id}`, `signals[${index}] must prefer source_post_id for dedupe`);
    }

    for (const field of FORBIDDEN_OUTPUT_FIELDS) {
      assert.strictEqual(signal[field], undefined, `signals[${index}] includes forbidden field ${field}`);
    }
  }
}

function assertRequiredRoutes(signals) {
  const routes = new Set(signals.map((signal) => signal.route));
  for (const route of [
    "agent_workflow_upgrade_queue",
    "ai_tool_or_workflow_queue",
    "skill_or_research_doc_upgrade_queue",
    "portfolio_research_queue",
    "business_opportunity_queue",
    "content_idea_queue",
    "ignore_noise",
  ]) {
    assert.ok(routes.has(route), `sample output missing route ${route}`);
  }
}

function assertDedupeBehavior(signals) {
  const duplicates = signals.filter((signal) => signal.prior_seen);
  assert.ok(duplicates.length > 0, "sample output should include at least one duplicate");

  for (const duplicate of duplicates) {
    assert.strictEqual(duplicate.route, "ignore_noise", "duplicates must route to ignore_noise");
    assert.strictEqual(duplicate.duplicate_reason, "duplicate", "duplicates must include duplicate reason");
    assert.ok(duplicate.safety_flags.includes("duplicate_ignored"), "duplicates must include duplicate_ignored safety flag");
  }
}

function assertRequiredSampleCategories(signals) {
  const categories = new Set(signals.map((signal) => signal.category));
  for (const category of REQUIRED_SAMPLE_CATEGORIES) {
    assert.ok(categories.has(category), `sample output missing category ${category}`);
  }
}

function assertNoRuntimeNetworkPaths() {
  const filesToScan = [
    path.join(__dirname, "..", "lib", "sources", "xIntelligenceIntake.js"),
    path.join(__dirname, "x-intake-dry-run.js"),
  ];

  for (const filePath of filesToScan) {
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      assert.strictEqual(source.includes(pattern), false, `${filePath} includes forbidden runtime pattern ${pattern}`);
    }
  }
}

function assertDryRunCommand() {
  const result = spawnSync(process.execPath, [path.join(__dirname, "x-intake-dry-run.js")], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, result.stderr || "x-intake dry-run command failed");
  assert.ok(result.stdout.includes("Manual X Intelligence Intake dry run"), "dry-run command should print readable title");
  assert.ok(result.stdout.includes("Safety status: passed"), "dry-run command should print safety status");
  assert.ok(result.stdout.includes("Normalized signals:"), "dry-run command should list normalized signals");
}

if (require.main === module) {
  main();
}

module.exports = { main };
