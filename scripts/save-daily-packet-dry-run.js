const {
  runDailyInvestmentCommitteeDryRun,
  validateDailyDryRunPacket,
} = require("../lib/orchestrators/dailyInvestmentCommitteeDryRun");
const { saveDailyPacket } = require("../lib/storage/dailyPacketStore");

function main() {
  const packet = runDailyInvestmentCommitteeDryRun();
  const validation = validateDailyDryRunPacket(packet);

  if (!validation.passed) {
    process.stderr.write(`Daily packet was not saved because validation failed: ${validation.errors.join("; ")}\n`);
    process.exitCode = 1;
    return;
  }

  const saved = saveDailyPacket(packet);
  process.stdout.write("Daily packet saved locally.\n");
  process.stdout.write(`File: ${saved.path}\n`);
  process.stdout.write(`Run ID: ${saved.run_id}\n`);
  process.stdout.write(`Created at: ${saved.created_at}\n`);
  process.stdout.write("Mode: local dry-run only\n");
}

if (require.main === module) {
  main();
}

module.exports = { main };
