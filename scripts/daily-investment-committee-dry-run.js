const {
  buildReadableDailyDryRunSummary,
  runDailyInvestmentCommitteeDryRun,
} = require("../lib/orchestrators/dailyInvestmentCommitteeDryRun");

function main(argv = process.argv.slice(2)) {
  const packet = runDailyInvestmentCommitteeDryRun();
  const jsonOnly = argv.includes("--json");

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  } else {
    process.stdout.write(`${buildReadableDailyDryRunSummary(packet)}\n`);
    process.stdout.write("\nJSON packet:\n");
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  }

  if (!packet.validation.passed) {
    process.stderr.write(`Daily Investment Committee dry run failed validation: ${packet.validation.errors.join("; ")}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
