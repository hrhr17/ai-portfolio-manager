const { loadLatestDailyPacket } = require("../lib/storage/dailyPacketStore");

function main() {
  const latest = loadLatestDailyPacket();

  if (!latest) {
    process.stdout.write("No local daily packet found.\n");
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Latest local daily packet\n");
  process.stdout.write(`File: ${latest.path}\n`);
  process.stdout.write(`Run ID: ${latest.run_id}\n`);
  process.stdout.write(`Created at: ${latest.created_at}\n`);
  process.stdout.write(`Validation passed: ${latest.validation_passed}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
