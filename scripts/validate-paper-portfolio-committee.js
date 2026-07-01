const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  DEFAULT_PAPER_PORTFOLIO_PATH,
  DEFAULT_RESEARCH_QUEUE_PATH,
  DEFAULT_WATCHLIST_PATH,
  loadCommitteeInputs,
} = require("../lib/paperPortfolio/loadPaperPortfolio");
const {
  DEFAULT_OUTPUT_DIR,
  buildMarkdownReport,
  buildPaperCommitteeReport,
  buildRunId,
  writePaperCommitteeOutputs,
} = require("../lib/paperPortfolio/buildPaperCommitteeReport");
const {
  ACTION_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  validatePaperCommitteeReport,
} = require("../lib/paperPortfolio/validatePaperCommitteeReport");
const { ALLOWED_PAPER_ACTIONS } = require("../lib/paperPortfolio/riskRules");

const FIXED_CREATED_AT = "2026-07-01T13:00:00.000Z";
const EXPECTED_ACTIONS = {
  NVDA: "PAPER HOLD",
  AVGO: "PAPER BUY CANDIDATE",
  VRT: "PAPER HOLD",
  PLTR: "PAPER REDUCE / TRIM CANDIDATE",
  IREN: "AVOID",
  AMD: "WATCH",
};
const FORBIDDEN_RUNTIME_PATTERNS = [
  "fetch(",
  "axios",
  "http.request",
  "https.request",
  "api.x.com",
  "api.twitter.com",
  "openai",
  "playwright",
  "puppeteer",
  "selenium",
];

function main() {
  const inputs = loadCommitteeInputs();
  assertInputFixtures(inputs);

  const report = buildPaperCommitteeReport(inputs, { createdAt: FIXED_CREATED_AT });
  assertReportShape(report);
  assert.strictEqual(validatePaperCommitteeReport(report).passed, true, JSON.stringify(report.validation.errors));

  const markdown = buildMarkdownReport(report);
  assert.ok(markdown.includes("Paper Portfolio Committee v0"), "Markdown report must include title");
  assertNoBlockedRealMoneyLanguage(markdown);

  const outputFiles = writePaperCommitteeOutputs(report, { outputDir: DEFAULT_OUTPUT_DIR });
  assertGeneratedFiles(outputFiles);
  assertDryRunCommand();
  assertGeneratedReportsIgnored(outputFiles);
  assertNoRuntimeNetworkPaths();

  console.log(`Paper Portfolio Committee v0 validation passed (${report.actions.length} paper actions).`);
}

function assertInputFixtures(inputs) {
  assert.strictEqual(inputs.watchlist.schema_version, "paper_committee_watchlist_fixture_v0");
  assert.strictEqual(inputs.researchQueue.schema_version, "paper_committee_research_queue_fixture_v0");
  assert.strictEqual(inputs.portfolio.schema_version, "paper_portfolio_fixture_v0");
  assert.strictEqual(inputs.watchlist.product_reference.runtime_google_sheets_integration, false);
  assert.strictEqual(inputs.researchQueue.runtime_google_sheets_integration, false);
  assert.strictEqual(inputs.portfolio.paper_only, true);
  assert.strictEqual(inputs.portfolio.simulated, true);
  assert.strictEqual(inputs.portfolio.rules.live_trading_enabled, false);
  assert.strictEqual(inputs.portfolio.rules.brokerage_integration_enabled, false);
  assert.strictEqual(inputs.portfolio.rules.automated_ordering_enabled, false);
  assert.strictEqual(inputs.portfolio.rules.production_storage_enabled, false);
  assert.ok(inputs.portfolio.rules.blocked_asset_classes.includes("options"), "options must be blocked");
  assert.ok(inputs.portfolio.rules.blocked_asset_classes.includes("margin"), "margin must be blocked");
  assert.ok(inputs.portfolio.rules.blocked_asset_classes.includes("crypto"), "crypto must be blocked");
  assert.ok(inputs.watchlist.tickers.length >= 5, "sample watchlist should include a pilot universe");
  assert.ok(inputs.researchQueue.tasks.length >= 3, "research queue should include safety and skeptic tasks");
}

function assertReportShape(report) {
  assert.strictEqual(report.schema_version, REPORT_SCHEMA_VERSION);
  assert.strictEqual(report.mode, "local_dry_run");
  assert.strictEqual(report.generated_at, FIXED_CREATED_AT);
  assert.strictEqual(report.metadata.method, "deterministic_paper_committee_rules_v0");
  assert.strictEqual(report.metadata.model, "none");
  assert.strictEqual(report.metadata.prompt_version, "none");
  assert.strictEqual(report.metadata.runtime_live_data_used, false);
  assert.strictEqual(report.safety.paper_simulated_only, true);
  assert.strictEqual(report.safety.real_money_advice_provided, false);
  assert.strictEqual(report.safety.live_trading_enabled, false);
  assert.strictEqual(report.safety.brokerage_integration_enabled, false);
  assert.strictEqual(report.safety.automated_ordering_enabled, false);
  assert.strictEqual(report.safety.margin_enabled, false);
  assert.strictEqual(report.safety.options_enabled, false);
  assert.strictEqual(report.safety.crypto_enabled, false);
  assert.strictEqual(report.safety.production_storage_written, false);
  assert.strictEqual(report.validation.passed, true, JSON.stringify(report.validation.errors));
  assert.ok(Array.isArray(report.actions), "report.actions must be an array");
  assert.strictEqual(report.actions.length, Object.keys(EXPECTED_ACTIONS).length);

  for (const action of report.actions) {
    assert.strictEqual(action.schema_version, ACTION_SCHEMA_VERSION);
    assert.strictEqual(action.paper_action, EXPECTED_ACTIONS[action.ticker], `${action.ticker} action changed unexpectedly`);
    assert.ok(ALLOWED_PAPER_ACTIONS.includes(action.paper_action), `${action.ticker} has disallowed paper action`);
    assert.ok(Array.isArray(action.action_rationale) && action.action_rationale.length > 0, `${action.ticker} missing rationale`);
    assert.ok(Array.isArray(action.risk_skeptic_case) && action.risk_skeptic_case.length > 0, `${action.ticker} missing risk case`);
    assert.ok(Array.isArray(action.manual_review_items) && action.manual_review_items.length > 0, `${action.ticker} missing manual review`);
    assert.ok(Array.isArray(action.evidence) && action.evidence.length > 0, `${action.ticker} missing evidence`);
    assert.ok(Array.isArray(action.what_changed) && action.what_changed.length > 0, `${action.ticker} missing what_changed`);
    assert.ok(Array.isArray(action.why_it_may_matter) && action.why_it_may_matter.length > 0, `${action.ticker} missing why_it_may_matter`);
    assert.ok(Array.isArray(action.missing_verification), `${action.ticker} missing verification array`);
    assert.strictEqual(typeof action.risk_engine.passed, "boolean", `${action.ticker} risk engine must have boolean pass/fail`);
    assert.ok(["pass", "fail"].includes(action.risk_engine.decision), `${action.ticker} risk decision invalid`);
    assert.strictEqual(action.safety.paper_simulated_only, true);
    assert.strictEqual(action.safety.real_money_instruction, false);
    assert.strictEqual(action.safety.automated_order_created, false);
  }
}

function assertGeneratedFiles(outputFiles) {
  const expectedBaseName = buildRunId(FIXED_CREATED_AT);
  assert.strictEqual(path.basename(outputFiles.json), `${expectedBaseName}.json`);
  assert.strictEqual(path.basename(outputFiles.markdown), `${expectedBaseName}.md`);

  const jsonPath = path.resolve(process.cwd(), outputFiles.json);
  const markdownPath = path.resolve(process.cwd(), outputFiles.markdown);
  assert.ok(fs.existsSync(jsonPath), "JSON output file must exist");
  assert.ok(fs.existsSync(markdownPath), "Markdown output file must exist");

  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  assert.strictEqual(parsed.validation.passed, true, JSON.stringify(parsed.validation.errors));
  assert.strictEqual(parsed.local_output_files.json, outputFiles.json);
  assertNoBlockedRealMoneyLanguage(fs.readFileSync(markdownPath, "utf8"));
}

function assertDryRunCommand() {
  const scriptPath = path.join(__dirname, "run-paper-portfolio-committee-dry-run.js");
  const result = spawnSync(process.execPath, [
    scriptPath,
    "--created-at",
    FIXED_CREATED_AT,
    "--output-dir",
    DEFAULT_OUTPUT_DIR,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, result.stderr || "paper committee dry-run command failed");
  assert.ok(result.stdout.includes("Paper Portfolio Committee v0 dry run"), "dry-run command should print title");
  assert.ok(result.stdout.includes("Paper action summary:"), "dry-run command should print paper action summary");
  assert.ok(result.stdout.includes("Generated files:"), "dry-run command should print output file paths");
}

function assertGeneratedReportsIgnored(outputFiles) {
  const result = spawnSync("git", ["check-ignore", outputFiles.json, outputFiles.markdown], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.strictEqual(result.status, 0, result.stderr || "generated paper reports must be ignored by git");
}

function assertNoRuntimeNetworkPaths() {
  const filesToScan = [
    path.join(__dirname, "..", "lib", "paperPortfolio", "loadPaperPortfolio.js"),
    path.join(__dirname, "..", "lib", "paperPortfolio", "riskRules.js"),
    path.join(__dirname, "..", "lib", "paperPortfolio", "buildPaperCommitteeReport.js"),
    path.join(__dirname, "..", "lib", "paperPortfolio", "validatePaperCommitteeReport.js"),
    path.join(__dirname, "run-paper-portfolio-committee-dry-run.js"),
  ];

  for (const filePath of filesToScan) {
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      assert.strictEqual(source.includes(pattern), false, `${filePath} includes forbidden runtime pattern ${pattern}`);
    }
  }
}

function assertNoBlockedRealMoneyLanguage(text) {
  const sanitized = ALLOWED_PAPER_ACTIONS.reduce((value, label) => value.replaceAll(label, ""), text);
  const blockedPatterns = [
    /buy this with real money/i,
    /sell this from your brokerage account/i,
    /execute trade/i,
    /place order/i,
    /rebalance your actual portfolio/i,
    /guaranteed returns/i,
    /\b(BUY|SELL|HOLD)\b/i,
  ];
  for (const pattern of blockedPatterns) {
    assert.strictEqual(pattern.test(sanitized), false, `blocked real-money language found: ${pattern}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
