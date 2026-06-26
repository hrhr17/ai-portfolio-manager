const { fetchBulkInsidersByDate } = require("./utils/fetchInsiders");
const { fetchBasicFinancials, fetchCompanyProfile, fetchEarningsSurprises } = require("./utils/fetchFundamentals");
const { scoreCandidates } = require("./utils/scoreCandidates");
const { writeDailyReportToDrive } = require("./utils/writeToDrive");

// Vercel serverless function — invoked daily by the cron job in vercel.json (8am EST / 13:00 UTC)
module.exports = async function handler(req, res) {
  // Restrict to Vercel cron invocations and authorized manual triggers
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const today = getTodayEST();
    console.log(`[smart-money-analyst] Running analysis for ${today}`);

    // 1. Pull today's insider transactions from EODHD
    const rawTransactions = await fetchBulkInsidersByDate(today);
    console.log(`[smart-money-analyst] Fetched ${rawTransactions.length} raw transactions`);

    if (rawTransactions.length === 0) {
      const msg = `No insider transactions found for ${today}. Possibly a market holiday.`;
      console.log(msg);
      return res.status(200).json({ message: msg });
    }

    // 2. Score and group by conviction level
    const { high, medium, low } = scoreCandidates(rawTransactions);
    console.log(`[smart-money-analyst] Conviction — HIGH: ${high.length}, MEDIUM: ${medium.length}, LOW: ${low.length}`);

    // 3. Enrich high-conviction candidates with fundamentals
    const enriched = await enrichCandidates(high.slice(0, 10));

    // 4. Build and write report
    const reportTitle = `Smart Money Report — ${today}`;
    const reportBody = buildReport(today, { high: enriched, medium, low });
    const { docUrl } = await writeDailyReportToDrive(reportTitle, reportBody);

    console.log(`[smart-money-analyst] Report written: ${docUrl}`);
    return res.status(200).json({ success: true, date: today, docUrl, summary: { high: high.length, medium: medium.length, low: low.length } });
  } catch (err) {
    console.error("[smart-money-analyst] Fatal error:", err);
    return res.status(500).json({ error: err.message });
  }
};

async function enrichCandidates(candidates) {
  return Promise.all(
    candidates.map(async (candidate) => {
      try {
        const [fundamentals, profile, earnings] = await Promise.all([
          fetchBasicFinancials(candidate.ticker),
          fetchCompanyProfile(candidate.ticker),
          fetchEarningsSurprises(candidate.ticker, 4),
        ]);
        return { ...candidate, fundamentals, profile, earnings };
      } catch (err) {
        console.warn(`[smart-money-analyst] Could not enrich ${candidate.ticker}:`, err.message);
        return candidate;
      }
    })
  );
}

function buildReport(date, { high, medium, low }) {
  const lines = [];

  lines.push(`SMART MONEY INSIDER ANALYSIS`);
  lines.push(`Date: ${date}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`${"=".repeat(60)}`);
  lines.push("");

  lines.push(`SUMMARY`);
  lines.push(`High conviction signals:   ${high.length}`);
  lines.push(`Medium conviction signals: ${medium.length}`);
  lines.push(`Low conviction signals:    ${low.length}`);
  lines.push("");

  if (high.length > 0) {
    lines.push(`${"=".repeat(60)}`);
    lines.push(`HIGH CONVICTION PICKS`);
    lines.push(`${"=".repeat(60)}`);
    for (const c of high) lines.push(formatCandidate(c, true));
  }

  if (medium.length > 0) {
    lines.push(`${"=".repeat(60)}`);
    lines.push(`MEDIUM CONVICTION PICKS`);
    lines.push(`${"=".repeat(60)}`);
    for (const c of medium.slice(0, 15)) lines.push(formatCandidate(c, false));
  }

  lines.push("");
  lines.push("--- End of Report ---");
  return lines.join("\n");
}

function formatCandidate(c, includeDetails) {
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const lines = [];

  lines.push("");
  lines.push(`Ticker:      ${c.ticker}`);
  if (c.profile?.name) lines.push(`Company:     ${c.profile.name}`);
  if (c.profile?.finnhubIndustry) lines.push(`Sector:      ${c.profile.finnhubIndustry}`);
  lines.push(`Conviction:  ${c.score.conviction}  (score: ${c.score.total})`);
  lines.push(`Transactions:${c.transactionCount} buy(s) by ${c.score.uniqueInsiders} insider(s)`);
  lines.push(`Total Value: ${usd.format(c.score.totalValue)}`);
  lines.push(`Insiders:    ${c.insiders.join(", ")}`);
  lines.push(`Latest Date: ${c.latestDate}`);

  if (includeDetails && c.fundamentals?.metric) {
    const m = c.fundamentals.metric;
    lines.push(`--- Fundamentals ---`);
    if (m.peNormalizedAnnual != null) lines.push(`P/E (norm):  ${m.peNormalizedAnnual.toFixed(1)}`);
    if (m["52WeekHigh"] != null) lines.push(`52W High:    ${usd.format(m["52WeekHigh"])}`);
    if (m["52WeekLow"] != null) lines.push(`52W Low:     ${usd.format(m["52WeekLow"])}`);
    if (m.revenueGrowthTTMYoy != null) lines.push(`Rev Growth:  ${(m.revenueGrowthTTMYoy * 100).toFixed(1)}% YoY`);
    if (m.epsGrowthTTMYoy != null) lines.push(`EPS Growth:  ${(m.epsGrowthTTMYoy * 100).toFixed(1)}% YoY`);
  }

  if (includeDetails && c.earnings?.length > 0) {
    const latest = c.earnings[0];
    if (latest.surprise != null) {
      lines.push(`EPS Surprise:${latest.surprise > 0 ? "+" : ""}${latest.surprise.toFixed(2)} (Q${latest.period})`);
    }
  }

  return lines.join("\n");
}

// Returns today's date in YYYY-MM-DD adjusted for EST (UTC-5)
function getTodayEST() {
  const now = new Date();
  const estOffset = -5 * 60;
  const estTime = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60_000);
  return estTime.toISOString().slice(0, 10);
}
