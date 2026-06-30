const dailyInvestmentCommitteeHandler = require("./daily-investment-committee");

// Compatibility route for the existing Vercel cron in vercel.json.
// The old Smart Money Analyst workflow now delegates to the full committee.
module.exports = async function handler(req, res) {
  return dailyInvestmentCommitteeHandler(req, res);
};
