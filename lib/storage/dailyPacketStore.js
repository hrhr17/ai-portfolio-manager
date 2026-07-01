const fs = require("fs");
const path = require("path");

const DEFAULT_DAILY_PACKET_DIR = path.join(process.cwd(), "data", "daily-packets");

function buildDailyPacketFilename(packet) {
  if (!packet || typeof packet !== "object") {
    throw new Error("Daily packet must be an object.");
  }

  const rawId = packet.run_id || packet.created_at;
  if (!rawId || typeof rawId !== "string") {
    throw new Error("Daily packet must include run_id or created_at.");
  }

  const safeId = rawId.replace(/[^0-9A-Za-z._-]+/g, "-").replace(/^-|-$/g, "");
  if (!safeId) {
    throw new Error("Daily packet filename could not be built.");
  }

  return `${safeId}.json`;
}

function saveDailyPacket(packet, options = {}) {
  const packetDir = resolvePacketDir(options.packetDir);
  const filename = buildDailyPacketFilename(packet);
  const filePath = path.join(packetDir, filename);

  fs.mkdirSync(packetDir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  return buildPacketRecord(filePath, packet);
}

function loadLatestDailyPacket(options = {}) {
  const latest = listDailyPackets(options)[0];
  if (!latest) return null;

  return {
    ...latest,
    packet: readPacketJson(latest.path),
  };
}

function listDailyPackets(options = {}) {
  const packetDir = resolvePacketDir(options.packetDir);
  if (!fs.existsSync(packetDir)) return [];

  return fs
    .readdirSync(packetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const filePath = path.join(packetDir, entry.name);
      return buildPacketRecord(filePath, readPacketJson(filePath));
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.filename.localeCompare(a.filename));
}

function buildPacketRecord(filePath, packet) {
  const stats = fs.statSync(filePath);
  return {
    filename: path.basename(filePath),
    path: filePath,
    run_id: packet.run_id || null,
    created_at: packet.created_at || stats.mtime.toISOString(),
    validation_passed: packet.validation?.passed === true,
    saved_at: stats.mtime.toISOString(),
  };
}

function readPacketJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePacketDir(packetDir) {
  return path.resolve(packetDir || process.env.DAILY_PACKET_DIR || DEFAULT_DAILY_PACKET_DIR);
}

module.exports = {
  DEFAULT_DAILY_PACKET_DIR,
  buildDailyPacketFilename,
  listDailyPackets,
  loadLatestDailyPacket,
  saveDailyPacket,
};
