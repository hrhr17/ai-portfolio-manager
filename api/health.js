const pkg = require("../package.json");

const REQUIRED_ENV_VARS = [
  "CRON_SECRET",
  "EODHD_API_KEY",
  "FINNHUB_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_DRIVE_FOLDER_ID",
];

const RECOMMENDED_ENV_VARS = [
  "WATCHLIST_TICKERS",
  "RESEARCH_QUEUE_LIMIT",
];

const OPTIONAL_ENV_VARS = [
  "PAPER_PORTFOLIO_JSON",
  "PAPER_PORTFOLIO_HISTORY_JSON",
  "X_SOURCE_MOCK_SIGNALS",
  "X_INTAKE_SECRET",
  "MAX_SINGLE_POSITION_TARGET_WEIGHT_PCT",
  "MAX_NEW_POSITIONS_PER_DAY",
  "MAX_DAILY_TURNOVER_PCT",
  "MAX_SECTOR_CONCENTRATION_PCT",
  "MAX_THEME_CONCENTRATION_PCT",
];

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method || "GET")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const required = summarizeEnv(REQUIRED_ENV_VARS);
  const recommended = summarizeEnv(RECOMMENDED_ENV_VARS);
  const optional = summarizeEnv(OPTIONAL_ENV_VARS);

  return res.status(200).json({
    status: required.missing.length === 0 ? "ok" : "missing_required_env",
    project: pkg.name,
    version: pkg.version,
    description: pkg.description,
    timestamp: new Date().toISOString(),
    routes: {
      health: "/api/health",
      dailyInvestmentCommittee: "/api/daily-investment-committee",
      dailyDryRun: "/api/daily-dry-run",
      legacyCronDelegate: "/api/smart-money-analyst",
      xIntake: "/api/x-intake",
    },
    cron: {
      path: "/api/smart-money-analyst",
      dryRunPath: "/api/daily-dry-run",
      note: "Existing Vercel cron path delegates to /api/daily-investment-committee.",
    },
    environment: {
      required,
      recommended,
      optional,
    },
    safety: {
      liveTrading: false,
      brokerageExecution: false,
      margin: false,
      options: false,
      crypto: false,
    },
  });
};

function summarizeEnv(names) {
  return {
    configured: names.filter((name) => Boolean(process.env[name])),
    missing: names.filter((name) => !process.env[name]),
  };
}
