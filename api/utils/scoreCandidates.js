/**
 * Scores insider transaction candidates and groups them by conviction level.
 *
 * Conviction tiers:
 *   HIGH   — multiple insiders, large dollar value, cluster within 30 days
 *   MEDIUM — single large purchase or moderate cluster
 *   LOW    — single small purchase or ambiguous signal
 */

const THRESHOLDS = {
  HIGH_VALUE: 500_000,
  MEDIUM_VALUE: 100_000,
  CLUSTER_WINDOW_DAYS: 30,
  CLUSTER_MIN_COUNT: 3,
};

/**
 * @param {Array} transactions - Raw insider transaction objects from EODHD
 * @returns {{ high: Array, medium: Array, low: Array }}
 */
function scoreCandidates(transactions) {
  const byTicker = groupByTicker(transactions.filter(isBuy));

  const high = [];
  const medium = [];
  const low = [];

  for (const [ticker, txns] of Object.entries(byTicker)) {
    const score = computeScore(txns);
    const entry = buildEntry(ticker, txns, score);

    if (score.conviction === "HIGH") high.push(entry);
    else if (score.conviction === "MEDIUM") medium.push(entry);
    else low.push(entry);
  }

  const byScore = (a, b) => b.score.total - a.score.total;
  return {
    high: high.sort(byScore),
    medium: medium.sort(byScore),
    low: low.sort(byScore),
  };
}

function isBuy(txn) {
  const type = (txn.transactionType ?? txn.transaction_type ?? "").toUpperCase();
  return type.includes("P") || type === "BUY" || type === "PURCHASE";
}

function groupByTicker(transactions) {
  return transactions.reduce((acc, txn) => {
    const key = txn.code ?? txn.ticker ?? txn.symbol;
    if (!key) return acc;
    (acc[key] = acc[key] ?? []).push(txn);
    return acc;
  }, {});
}

function computeScore(txns) {
  const totalValue = txns.reduce((sum, t) => sum + (Number(t.transactionValue ?? t.value) || 0), 0);
  const uniqueInsiders = new Set(txns.map((t) => t.ownerName ?? t.owner)).size;
  const isCluster = isWithinWindow(txns) && txns.length >= THRESHOLDS.CLUSTER_MIN_COUNT;

  let total = 0;
  if (totalValue >= THRESHOLDS.HIGH_VALUE) total += 3;
  else if (totalValue >= THRESHOLDS.MEDIUM_VALUE) total += 1;

  if (uniqueInsiders >= 2) total += 2;
  if (isCluster) total += 2;

  let conviction;
  if (total >= 5) conviction = "HIGH";
  else if (total >= 2) conviction = "MEDIUM";
  else conviction = "LOW";

  return { total, conviction, totalValue, uniqueInsiders, isCluster };
}

function isWithinWindow(txns) {
  if (txns.length < 2) return false;
  const dates = txns
    .map((t) => new Date(t.transactionDate ?? t.date))
    .filter((d) => !isNaN(d))
    .sort((a, b) => a - b);

  const spanDays = (dates[dates.length - 1] - dates[0]) / 86_400_000;
  return spanDays <= THRESHOLDS.CLUSTER_WINDOW_DAYS;
}

function buildEntry(ticker, txns, score) {
  const latest = txns.sort(
    (a, b) => new Date(b.transactionDate ?? b.date) - new Date(a.transactionDate ?? a.date)
  )[0];

  return {
    ticker,
    score,
    transactionCount: txns.length,
    latestDate: latest.transactionDate ?? latest.date,
    insiders: [...new Set(txns.map((t) => t.ownerName ?? t.owner))],
    rawTransactions: txns,
  };
}

module.exports = { scoreCandidates };
