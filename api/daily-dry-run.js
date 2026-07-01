const { runDailyInvestmentCommitteeDryRun } = require("../lib/orchestrators/dailyInvestmentCommitteeDryRun");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method || "GET")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const packet = runDailyInvestmentCommitteeDryRun();
    return res.status(packet.validation.passed ? 200 : 500).json(packet);
  } catch (error) {
    console.error("[daily-dry-run] Fatal error:", error.message);
    return res.status(500).json({ error: "Daily dry run failed." });
  }
};

module.exports._private = { isAuthorized };

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  return authHeader === `Bearer ${cronSecret}`;
}
