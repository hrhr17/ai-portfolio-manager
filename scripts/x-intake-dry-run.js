const fs = require("fs");
const {
  DEFAULT_FIXTURE_PATH,
  runManualXIntakeDryRun,
} = require("../lib/sources/xIntelligenceIntake");

function main() {
  const fixturePath = process.argv[2] || DEFAULT_FIXTURE_PATH;
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const output = runManualXIntakeDryRun(fixture, { fixturePath });

  if (!output.validation.passed) {
    console.error("Manual X Intelligence Intake dry run failed validation:");
    for (const error of output.validation.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  printSummary(output);
}

function printSummary(output) {
  console.log("Manual X Intelligence Intake dry run");
  console.log(`Mode: ${output.mode}`);
  console.log(`Fixture: ${output.fixture_name} (${output.fixture_version})`);
  console.log(`Total records processed: ${output.summary.total_records_processed}`);
  console.log(`Safety status: ${output.summary.safety_status}`);
  console.log("");
  console.log("Count by category:");
  printCounts(output.summary.count_by_category);
  console.log("");
  console.log("Count by route:");
  printCounts(output.summary.count_by_route);
  console.log("");
  console.log("Safety:");
  console.log("- research_only: true");
  console.log("- live_x_api_called: false");
  console.log("- external_network_called: false");
  console.log("- portfolio_written: false");
  console.log("- report_written: false");
  console.log("");
  console.log("Normalized signals:");

  for (const signal of output.signals) {
    const tickers = signal.detected_tickers.length > 0 ? signal.detected_tickers.join(",") : "none";
    console.log(`- ${signal.signal_id}`);
    console.log(`  category: ${signal.category}`);
    console.log(`  route: ${signal.route}`);
    console.log(`  priority: ${signal.priority}`);
    console.log(`  confidence: ${signal.confidence}`);
    console.log(`  tickers: ${tickers}`);
    console.log(`  allowed_action: ${signal.allowed_action}`);
    console.log(`  can_directly_trade: ${signal.can_directly_trade}`);
    console.log(`  requires_human_review: ${signal.requires_human_review}`);
    console.log(`  rationale: ${signal.rationale}`);
  }
}

function printCounts(counts) {
  for (const key of Object.keys(counts).sort()) {
    console.log(`- ${key}: ${counts[key]}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
