const {
  DEFAULT_PAPER_PORTFOLIO_PATH,
  DEFAULT_RESEARCH_QUEUE_PATH,
  DEFAULT_WATCHLIST_PATH,
  loadCommitteeInputs,
} = require("../lib/paperPortfolio/loadPaperPortfolio");
const {
  DEFAULT_OUTPUT_DIR,
  buildPaperCommitteeReport,
  writePaperCommitteeOutputs,
} = require("../lib/paperPortfolio/buildPaperCommitteeReport");

function main(argv = process.argv.slice(2)) {
  const createdAt = getArgValue(argv, "--created-at") || new Date().toISOString();
  const outputDir = getArgValue(argv, "--output-dir") || DEFAULT_OUTPUT_DIR;
  const watchlistPath = getArgValue(argv, "--watchlist") || DEFAULT_WATCHLIST_PATH;
  const researchQueuePath = getArgValue(argv, "--research-queue") || DEFAULT_RESEARCH_QUEUE_PATH;
  const portfolioPath = getArgValue(argv, "--portfolio") || DEFAULT_PAPER_PORTFOLIO_PATH;
  const jsonOnly = argv.includes("--json");
  const noWrite = argv.includes("--no-write");

  const inputs = loadCommitteeInputs({
    watchlistPath,
    researchQueuePath,
    portfolioPath,
  });
  const report = buildPaperCommitteeReport(inputs, { createdAt });

  let outputFiles = null;
  if (!noWrite) {
    outputFiles = writePaperCommitteeOutputs(report, { outputDir });
  }

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printSummary(report, outputFiles);
  }

  if (!report.validation.passed) {
    process.stderr.write(`Paper Portfolio Committee dry run failed validation: ${report.validation.errors.join("; ")}\n`);
    process.exitCode = 1;
  }
}

function printSummary(report, outputFiles) {
  console.log("Paper Portfolio Committee v0 dry run");
  console.log(`Run ID: ${report.run_id}`);
  console.log(`Generated at: ${report.generated_at}`);
  console.log(`Tickers reviewed: ${report.watchlist_summary.ticker_count}`);
  console.log(`Validation: ${report.validation.passed ? "passed" : "failed"}`);
  console.log("");
  console.log("Paper action summary:");
  for (const action of report.actions) {
    console.log(`- ${action.ticker}: ${action.paper_action} | risk ${action.risk_engine.decision}`);
  }
  console.log("");
  console.log("Safety:");
  console.log("- paper_simulated_only: true");
  console.log("- real_money_advice_provided: false");
  console.log("- live_trading_enabled: false");
  console.log("- brokerage_integration_enabled: false");
  console.log("- automated_ordering_enabled: false");
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
