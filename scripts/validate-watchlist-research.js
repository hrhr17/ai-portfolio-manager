const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  DEFAULT_WATCHLIST_PATH,
  loadWatchlist,
} = require("../lib/watchlistResearch/loadWatchlist");
const {
  DEFAULT_OUTPUT_DIR,
  buildMarkdownDigest,
  buildRunId,
  buildWatchlistResearchDigest,
  writeWatchlistResearchOutputs,
} = require("../lib/watchlistResearch/buildWatchlistDigest");
const {
  DIGEST_SCHEMA_VERSION,
  TICKER_SCHEMA_VERSION,
  validateWatchlistResearchDigest,
} = require("../lib/watchlistResearch/validateWatchlistResearch");

const FIXED_CREATED_AT = "2026-07-01T13:00:00.000Z";
const FORBIDDEN_RUNTIME_PATTERNS = [
  "fetch(",
  "axios",
  "http.request",
  "https.request",
  "openai",
  "api.x.com",
  "api.twitter.com",
  "playwright",
  "puppeteer",
  "selenium",
];

function main() {
  const watchlist = loadWatchlist(DEFAULT_WATCHLIST_PATH);
  assertWatchlistInput(watchlist);

  const digest = buildWatchlistResearchDigest(watchlist, {
    createdAt: FIXED_CREATED_AT,
    inputPath: watchlist.source.input_path,
  });
  assertDigestShape(digest);

  const validation = validateWatchlistResearchDigest(digest);
  assert.strictEqual(validation.passed, true, JSON.stringify(validation.errors));

  const markdown = buildMarkdownDigest(digest);
  assert.ok(markdown.includes("Watchlist Research Digest v0"), "Markdown digest must include title");
  assertNoUnsafeTradingLanguage(markdown);

  const outputFiles = writeWatchlistResearchOutputs(digest, { outputDir: DEFAULT_OUTPUT_DIR });
  assertGeneratedFiles(outputFiles);
  assertDryRunCommand();
  assertNoRuntimeNetworkPaths();

  console.log(`Watchlist Research Agent v0 validation passed (${digest.tickers.length} tickers).`);
}

function assertWatchlistInput(watchlist) {
  assert.strictEqual(watchlist.schema_version, "watchlist_research_input_v0");
  assert.strictEqual(watchlist.sample_only, true, "sample watchlist must be sample-only");
  assert.ok(Array.isArray(watchlist.tickers), "watchlist.tickers must be an array");
  assert.ok(watchlist.tickers.length >= 2 && watchlist.tickers.length <= 5, "sample watchlist should stay small");

  for (const [index, item] of watchlist.tickers.entries()) {
    assert.ok(item.ticker, `tickers[${index}] missing ticker`);
    assert.ok(Array.isArray(item.changes), `tickers[${index}].changes must be an array`);
    assert.ok(Array.isArray(item.current_claims), `tickers[${index}].current_claims must be an array`);
    assert.ok(Array.isArray(item.upcoming_catalysts), `tickers[${index}].upcoming_catalysts must be an array`);
    assert.ok(Array.isArray(item.manual_review_items), `tickers[${index}].manual_review_items must be an array`);
  }
}

function assertDigestShape(digest) {
  assert.strictEqual(digest.schema_version, DIGEST_SCHEMA_VERSION);
  assert.strictEqual(digest.mode, "local_dry_run");
  assert.strictEqual(digest.generated_at, FIXED_CREATED_AT);
  assert.strictEqual(digest.safety.research_only, true);
  assert.strictEqual(digest.safety.local_dry_run_only, true);
  assert.strictEqual(digest.safety.live_apis_called, false);
  assert.strictEqual(digest.safety.external_network_called, false);
  assert.strictEqual(digest.safety.llm_used, false);
  assert.strictEqual(digest.safety.portfolio_written, false);
  assert.strictEqual(digest.safety.production_storage_written, false);
  assert.ok(Array.isArray(digest.tickers), "digest.tickers must be an array");
  assert.strictEqual(digest.tickers.length, 3);
  assert.strictEqual(digest.validation.passed, true, JSON.stringify(digest.validation.errors));

  const ranks = digest.tickers.map((item) => item.research_priority_rank);
  assert.deepStrictEqual(ranks, [1, 2, 3], "research priority ranks must be deterministic");

  for (const [index, item] of digest.tickers.entries()) {
    assert.strictEqual(item.schema_version, TICKER_SCHEMA_VERSION);
    assert.ok(item.ticker, `tickers[${index}] missing ticker`);
    assert.notStrictEqual(item.company_name, undefined, `tickers[${index}] missing company_name field`);
    assert.ok(Number.isInteger(item.research_priority_rank), `tickers[${index}] missing rank`);
    assert.ok(["high", "medium", "low"].includes(item.research_priority_tier), `tickers[${index}] invalid tier`);
    assert.ok(Array.isArray(item.what_changed) && item.what_changed.length > 0, `tickers[${index}] missing what_changed`);
    assert.ok(Array.isArray(item.why_it_may_matter) && item.why_it_may_matter.length > 0, `tickers[${index}] missing why_it_may_matter`);
    assert.ok(Array.isArray(item.evidence), `tickers[${index}] evidence must be an array`);
    assert.ok(Array.isArray(item.missing_or_unverified_claims), `tickers[${index}] missing claims array`);
    assert.ok(Array.isArray(item.upcoming_earnings_or_catalysts), `tickers[${index}] missing catalysts array`);
    assert.ok(Array.isArray(item.manual_review_queue) && item.manual_review_queue.length > 0, `tickers[${index}] missing manual review queue`);
    assert.strictEqual(item.generated_at, FIXED_CREATED_AT);
    assert.strictEqual(item.input_source_file, DEFAULT_WATCHLIST_PATH);
    assert.strictEqual(item.metadata.method, "deterministic_watchlist_fixture_rules_v0");
    assert.strictEqual(item.metadata.model, "none");
    assert.strictEqual(item.metadata.prompt_version, "none");
    assert.strictEqual(item.safety.research_only, true);
    assert.strictEqual(item.safety.can_directly_trade, false);
    assert.strictEqual(item.safety.requires_human_review, true);
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
  assertNoUnsafeTradingLanguage(fs.readFileSync(markdownPath, "utf8"));
}

function assertDryRunCommand() {
  const scriptPath = path.join(__dirname, "run-watchlist-research-dry-run.js");
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

  assert.strictEqual(result.status, 0, result.stderr || "watchlist research dry-run command failed");
  assert.ok(result.stdout.includes("Watchlist Research Agent v0 dry run"), "dry-run command should print readable title");
  assert.ok(result.stdout.includes("Research priority ranking:"), "dry-run command should print ranking");
  assert.ok(result.stdout.includes("Generated files:"), "dry-run command should print output file paths");
}

function assertNoRuntimeNetworkPaths() {
  const filesToScan = [
    path.join(__dirname, "..", "lib", "watchlistResearch", "loadWatchlist.js"),
    path.join(__dirname, "..", "lib", "watchlistResearch", "buildWatchlistDigest.js"),
    path.join(__dirname, "..", "lib", "watchlistResearch", "validateWatchlistResearch.js"),
    path.join(__dirname, "run-watchlist-research-dry-run.js"),
  ];

  for (const filePath of filesToScan) {
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      assert.strictEqual(source.includes(pattern), false, `${filePath} includes forbidden runtime pattern ${pattern}`);
    }
  }
}

function assertNoUnsafeTradingLanguage(text) {
  assert.strictEqual(/\b(BUY|SELL|HOLD)\b/i.test(text), false, "output must not contain direct trading labels");
  assert.strictEqual(/the system recommends/i.test(text), false, "output must not use system-recommends language");
  assert.strictEqual(/execute this trade/i.test(text), false, "output must not include execution language");
}

if (require.main === module) {
  main();
}

module.exports = { main };
