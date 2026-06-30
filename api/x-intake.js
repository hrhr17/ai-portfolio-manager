const {
  buildHenryIntelligenceBrief,
  buildXSignalDesk,
  ingestManualXSignals,
} = require("../lib/sources/xSourceAgent");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = await readJsonBody(req);
    const posts = Array.isArray(body.posts) ? body.posts : Array.isArray(body.signals) ? body.signals : [];

    if (posts.length === 0) {
      return res.status(400).json({ error: "POST body must include a posts array." });
    }

    if (posts.length > 25) {
      return res.status(400).json({ error: "Batch too large. Send 25 posts or fewer." });
    }

    const signals = ingestManualXSignals(posts, {
      date: body.date,
      source: body.source || "manual_x_intake",
    });

    return res.status(200).json({
      success: true,
      mode: "manual",
      count: signals.length,
      safetyNotice: "X/social signals are idea-generation inputs only. They cannot directly create BUY or SELL recommendations.",
      signals,
      xSignalDesk: buildXSignalDesk(signals),
      henryIntelligenceBrief: buildHenryIntelligenceBrief(signals),
    });
  } catch (err) {
    console.error("[x-intake] Request failed:", err.message);
    return res.status(500).json({ error: "X intake failed." });
  }
};

module.exports._private = { isAuthorized, readJsonBody };

function isAuthorized(req) {
  const sharedSecret = req.env?.X_INTAKE_SECRET || req.env?.CRON_SECRET || getEnv("X_INTAKE_SECRET") || getEnv("CRON_SECRET");
  if (!sharedSecret) return false;

  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  const intakeHeader = req.headers?.["x-intake-secret"] || req.headers?.["X-Intake-Secret"] || "";

  return authHeader === `Bearer ${sharedSecret}` || intakeHeader === sharedSecret;
}

function getEnv(name) {
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return globalThis.process?.env?.[name];
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
