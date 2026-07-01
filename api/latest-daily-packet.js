const { loadLatestDailyPacket } = require("../lib/storage/dailyPacketStore");

module.exports = async function handler(req, res) {
  if ((req.method || "GET") !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const latest = loadLatest();
    if (!latest) return res.status(404).json({ error: "No local daily packet found." });

    return res.status(200).json(latest);
  } catch (error) {
    console.error("[latest-daily-packet] Read failed:", error.message);
    return res.status(500).json({ error: "Latest daily packet read failed." });
  }
};

module.exports._private = { isAuthorized, loadLatest };

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  return authHeader === `Bearer ${cronSecret}`;
}

function loadLatest(options = {}) {
  return loadLatestDailyPacket(options);
}
