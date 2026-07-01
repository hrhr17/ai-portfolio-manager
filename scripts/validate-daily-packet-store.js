const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildDailyPacketFilename,
  listDailyPackets,
  loadLatestDailyPacket,
  saveDailyPacket,
} = require("../lib/storage/dailyPacketStore");
const {
  runDailyInvestmentCommitteeDryRun,
  validateDailyDryRunPacket,
} = require("../lib/orchestrators/dailyInvestmentCommitteeDryRun");
const { _private: latestDailyPacketPrivate } = require("../api/latest-daily-packet");

function main() {
  const packetDir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-packet-store-"));

  try {
    assertStoreBehavior(packetDir);
    assertReadOnlyRouteBehavior(packetDir);
    console.log("Daily packet store validation passed.");
  } finally {
    fs.rmSync(packetDir, { recursive: true, force: true });
  }
}

function assertStoreBehavior(packetDir) {
  const olderPacket = runDailyInvestmentCommitteeDryRun({ createdAt: "2026-07-01T13:00:00.000Z" });
  const newerPacket = runDailyInvestmentCommitteeDryRun({ createdAt: "2026-07-02T13:00:00.000Z" });

  assert.strictEqual(validateDailyDryRunPacket(olderPacket).passed, true, "older packet must validate");
  assert.strictEqual(validateDailyDryRunPacket(newerPacket).passed, true, "newer packet must validate");
  assert.strictEqual(
    buildDailyPacketFilename(olderPacket),
    "daily-committee-dry-run-2026-07-01T13-00-00-000Z.json"
  );

  const firstSave = saveDailyPacket(olderPacket, { packetDir });
  const secondSave = saveDailyPacket(newerPacket, { packetDir });

  assert.ok(fs.existsSync(firstSave.path), "first packet file should exist");
  assert.ok(fs.existsSync(secondSave.path), "second packet file should exist");

  const packets = listDailyPackets({ packetDir });
  assert.strictEqual(packets.length, 2, "expected two saved packets");
  assert.strictEqual(packets[0].run_id, newerPacket.run_id, "latest packet should sort first");
  assert.strictEqual(packets[1].run_id, olderPacket.run_id, "older packet should sort second");

  const latest = loadLatestDailyPacket({ packetDir });
  assert.strictEqual(latest.run_id, newerPacket.run_id, "loadLatestDailyPacket should return newest packet");
  assert.strictEqual(latest.packet.validation.passed, true, "latest packet should include packet JSON");
}

function assertReadOnlyRouteBehavior(packetDir) {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";

  try {
    assert.strictEqual(latestDailyPacketPrivate.isAuthorized({ headers: {} }), false, "missing auth must fail");
    assert.strictEqual(
      latestDailyPacketPrivate.isAuthorized({ headers: { authorization: "Bearer wrong" } }),
      false,
      "wrong auth must fail"
    );
    assert.strictEqual(
      latestDailyPacketPrivate.isAuthorized({ headers: { authorization: "Bearer test-cron-secret" } }),
      true,
      "matching auth must pass"
    );
    assert.strictEqual(latestDailyPacketPrivate.loadLatest({ packetDir }).packet.run_mode, "dry_run");

    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-packet-empty-"));
    try {
      assert.strictEqual(latestDailyPacketPrivate.loadLatest({ packetDir: emptyDir }), null);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
