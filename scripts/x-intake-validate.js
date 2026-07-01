const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  ALLOWED_CATEGORIES,
  ALLOWED_ROUTES,
  DEFAULT_FIXTURE_PATH,
  FORBIDDEN_OUTPUT_FIELDS,
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
  "source_platform",
  "source_url",
  "author_handle",
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
  "safety_flags",
];

const REQUIRED_SAMPLE_CATEGORIES = [
  "ai_tool_or_workflow",
  "startup_to_watch",
  "business_opportunity",
  "content_idea",
  "learning_resource",
  "company_news",
  "equity_research",
  "macro",
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
  assertSafetyFlags(output.safety);
  assertSignals(output.signals);
  assertRequiredSampleCategories(output.signals);
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
      assert.notStrictEqual(signal[field], null, `signals[${index}] missing ${field}`);
    }

    assert.ok(ALLOWED_CATEGORIES.includes(signal.category), `signals[${index}] unsupported category`);
    assert.ok(ALLOWED_ROUTES.includes(signal.route), `signals[${index}] unsupported route`);
    assert.strictEqual(signal.allowed_action, "research_only", `signals[${index}] must be research_only`);
    assert.strictEqual(signal.can_directly_trade, false, `signals[${index}] must not directly trade`);
    assert.strictEqual(signal.requires_human_review, true, `signals[${index}] must require human review`);
    assert.ok(Array.isArray(signal.detected_tickers), `signals[${index}] detected_tickers must be an array`);
    assert.ok(Array.isArray(signal.safety_flags), `signals[${index}] safety_flags must be an array`);
    assert.notStrictEqual(signal.route, "portfolio_action", `signals[${index}] must not route to portfolio_action`);

    for (const field of FORBIDDEN_OUTPUT_FIELDS) {
      assert.strictEqual(signal[field], undefined, `signals[${index}] includes forbidden field ${field}`);
    }
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
