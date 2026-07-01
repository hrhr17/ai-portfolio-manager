const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  FORBIDDEN_PACKET_FIELDS,
  buildReadableDailyDryRunSummary,
  runDailyInvestmentCommitteeDryRun,
  validateDailyDryRunPacket,
} = require("../lib/orchestrators/dailyInvestmentCommitteeDryRun");
const { _private: dailyDryRunRoutePrivate } = require("../api/daily-dry-run");

const REQUIRED_PACKET_FIELDS = [
  "run_id",
  "run_mode",
  "created_at",
  "modules_run",
  "module_statuses",
  "x_intake_summary",
  "document_signal_summary",
  "drive_metadata_summary",
  "paper_portfolio_summary",
  "safety_summary",
  "human_review_required",
  "allowed_action",
  "can_directly_trade",
  "prohibited_actions_found",
  "next_recommended_human_actions",
  "validation",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  "fetch(",
  "axios.",
  "http.request",
  "https.request",
  "api.x.com",
  "api.twitter.com",
  "playwright",
  "puppeteer",
  "selenium",
  "openai",
];

function main() {
  const packet = runDailyInvestmentCommitteeDryRun({ createdAt: "2026-07-01T13:00:00.000Z" });
  assertPacketShape(packet);
  assert.strictEqual(validateDailyDryRunPacket(packet).passed, true, "packet validation must pass");
  assert.ok(buildReadableDailyDryRunSummary(packet).includes("Daily Investment Committee dry run"), "readable summary must render");
  assertRouteAuthorization();
  assertNoRuntimeNetworkPaths();
  assertDryRunCommand();

  console.log("Daily Investment Committee dry-run validation passed.");
}

function assertPacketShape(packet) {
  for (const field of REQUIRED_PACKET_FIELDS) {
    assert.notStrictEqual(packet[field], undefined, `packet missing ${field}`);
    assert.notStrictEqual(packet[field], null, `packet missing ${field}`);
  }

  assert.strictEqual(packet.run_mode, "dry_run");
  assert.strictEqual(packet.allowed_action, "research_only");
  assert.strictEqual(packet.can_directly_trade, false);
  assert.strictEqual(packet.human_review_required, true);
  assert.strictEqual(packet.prohibited_actions_found, false);
  assert.strictEqual(packet.validation.passed, true, JSON.stringify(packet.validation.errors));
  assert.ok(Array.isArray(packet.modules_run) && packet.modules_run.length >= 5, "expected all safe modules to run");
  assert.ok(Array.isArray(packet.next_recommended_human_actions), "next human actions must be an array");

  assert.strictEqual(packet.x_intake_summary.total_records_processed, 12, "X fixture should process 12 records");
  assert.strictEqual(packet.x_intake_summary.duplicate_count, 1, "X fixture should include one duplicate");
  assert.ok(packet.x_intake_summary.count_by_intake_mode.historical_backfill > 0, "missing historical backfill count");
  assert.ok(packet.x_intake_summary.count_by_intake_mode.daily_incremental > 0, "missing daily incremental count");
  assert.ok(packet.x_intake_summary.top_routed_items_by_priority.length > 0, "missing top routed items");

  assert.strictEqual(packet.document_signal_summary.signal_count, 12, "document fixture should produce 12 signals");
  assert.strictEqual(packet.document_signal_summary.google_drive_ingested, false, "must not ingest Google Drive docs");
  assert.strictEqual(packet.document_signal_summary.llm_used, false, "must not use LLMs");

  assert.strictEqual(packet.drive_metadata_summary.metadata_only, true, "Drive dry run must be metadata-only");
  assert.strictEqual(packet.drive_metadata_summary.content_fetched, false, "must not fetch Drive content");
  assert.strictEqual(packet.drive_metadata_summary.content_parsed, false, "must not parse Drive content");
  assert.strictEqual(packet.drive_metadata_summary.live_api_called, false, "must not call live Drive API");

  assert.strictEqual(packet.paper_portfolio_summary.portfolio_written, false, "must not write portfolio");
  assert.strictEqual(packet.paper_portfolio_summary.ledger_written, false, "must not write ledger");
  assert.strictEqual(packet.safety_summary.validation_passed, true, "safety summary must pass");
  assert.strictEqual(packet.safety_summary.external_network_called, false, "must not call networks");
  assert.strictEqual(packet.safety_summary.portfolio_written, false, "must not write portfolio");
  assert.strictEqual(packet.safety_summary.report_written, false, "must not write reports");

  for (const field of FORBIDDEN_PACKET_FIELDS) {
    assertNoForbiddenField(packet, field);
  }
}

function assertRouteAuthorization() {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";

  try {
    assert.strictEqual(dailyDryRunRoutePrivate.isAuthorized({ headers: {} }), false, "missing auth must fail");
    assert.strictEqual(
      dailyDryRunRoutePrivate.isAuthorized({ headers: { authorization: "Bearer wrong" } }),
      false,
      "wrong auth must fail"
    );
    assert.strictEqual(
      dailyDryRunRoutePrivate.isAuthorized({ headers: { authorization: "Bearer test-cron-secret" } }),
      true,
      "matching auth must pass"
    );
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
}

function assertNoForbiddenField(value, field) {
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    assert.notStrictEqual(key, field, `packet contains forbidden field ${field}`);
    assertNoForbiddenField(child, field);
  }
}

function assertNoRuntimeNetworkPaths() {
  const filesToScan = [
    path.join(__dirname, "..", "lib", "orchestrators", "dailyInvestmentCommitteeDryRun.js"),
    path.join(__dirname, "daily-investment-committee-dry-run.js"),
    path.join(__dirname, "..", "api", "daily-dry-run.js"),
  ];

  for (const filePath of filesToScan) {
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      assert.strictEqual(source.includes(pattern), false, `${filePath} includes forbidden runtime pattern ${pattern}`);
    }
  }
}

function assertDryRunCommand() {
  const result = spawnSync(process.execPath, [path.join(__dirname, "daily-investment-committee-dry-run.js")], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, result.stderr || "daily dry-run command failed");
  assert.ok(result.stdout.includes("Daily Investment Committee dry run"), "dry-run command should print readable title");
  assert.ok(result.stdout.includes("Safety validation: passed"), "dry-run command should print safety status");
  assert.ok(result.stdout.includes("JSON packet:"), "dry-run command should print JSON packet");
}

if (require.main === module) {
  main();
}

module.exports = { main };
