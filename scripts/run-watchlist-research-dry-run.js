const {
  DEFAULT_WATCHLIST_PATH,
  loadWatchlist,
} = require("../lib/watchlistResearch/loadWatchlist");
const {
  DEFAULT_OUTPUT_DIR,
  buildWatchlistResearchDigest,
  writeWatchlistResearchOutputs,
} = require("../lib/watchlistResearch/buildWatchlistDigest");

function main(argv = process.argv.slice(2)) {
  const inputPath = getArgValue(argv, "--input") || DEFAULT_WATCHLIST_PATH;
  const outputDir = getArgValue(argv, "--output-dir") || DEFAULT_OUTPUT_DIR;
  const createdAt = getArgValue(argv, "--created-at") || new Date().toISOString();
  const jsonOnly = argv.includes("--json");
  const noWrite = argv.includes("--no-write");

  const watchlist = loadWatchlist(inputPath);
  const digest = buildWatchlistResearchDigest(watchlist, {
    createdAt,
    inputPath: watchlist.source.input_path,
  });

  let outputFiles = null;
  if (!noWrite) {
    outputFiles = writeWatchlistResearchOutputs(digest, { outputDir });
  }

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(digest, null, 2)}\n`);
  } else {
    printSummary(digest, outputFiles);
  }

  if (!digest.validation.passed) {
    process.stderr.write(`Watchlist Research dry run failed validation: ${digest.validation.errors.join("; ")}\n`);
    process.exitCode = 1;
  }
}

function printSummary(digest, outputFiles) {
  console.log("Watchlist Research Agent v0 dry run");
  console.log(`Run ID: ${digest.run_id}`);
  console.log(`Generated at: ${digest.generated_at}`);
  console.log(`Input: ${digest.input.source_file}`);
  console.log(`Tickers reviewed: ${digest.summary.ticker_count}`);
  console.log(`Validation: ${digest.validation.passed ? "passed" : "failed"}`);
  console.log("");
  console.log("Research priority ranking:");
  for (const ticker of digest.tickers) {
    console.log(`- ${ticker.research_priority_rank}. ${ticker.ticker} | ${ticker.research_priority_tier} | score ${ticker.research_priority_score}`);
  }
  console.log("");
  console.log("Safety:");
  console.log("- research_only: true");
  console.log("- local_dry_run_only: true");
  console.log("- live_apis_called: false");
  console.log("- external_network_called: false");
  console.log("- production_storage_written: false");
  if (outputFiles) {
    console.log("");
    console.log("Generated files:");
    console.log(`- JSON: ${outputFiles.json}`);
    console.log(`- Markdown: ${outputFiles.markdown}`);
  }
}

function getArgValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

if (require.main === module) {
  main();
}

module.exports = { main };
