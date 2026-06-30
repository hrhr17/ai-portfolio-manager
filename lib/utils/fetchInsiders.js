const axios = require("axios");

const BASE_URL = "https://eodhd.com/api";

/**
 * Fetches insider transactions for a given ticker from the EODHD API.
 * @param {string} ticker - Stock ticker symbol (e.g. "AAPL.US")
 * @param {number} [limit=50] - Max number of transactions to return
 * @returns {Promise<Array>} Array of insider transaction objects
 */
async function fetchInsiderTransactions(ticker, limit = 50) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("Missing EODHD_API_KEY environment variable");

  const url = `${BASE_URL}/insider-transactions`;
  const response = await axios.get(url, {
    params: {
      code: ticker,
      limit,
      api_token: apiKey,
      fmt: "json",
    },
  });

  return response.data ?? [];
}

/**
 * Fetches insider transactions for a watchlist of tickers and merges the results.
 * Used instead of the bulk date-filter endpoint, which requires an EODHD paid plan.
 * Tickers are read from the WATCHLIST_TICKERS env var (comma-separated, e.g. "AAPL.US,MSFT.US").
 * Falls back to a built-in default list if the env var is not set.
 * @param {string} date - Date string in YYYY-MM-DD format (used to filter results client-side)
 * @returns {Promise<Array>}
 */
async function fetchBulkInsidersByDate(date) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("Missing EODHD_API_KEY environment variable");

  const defaultWatchlist = [
    "AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "META.US",
    "NVDA.US", "TSLA.US", "JPM.US", "BAC.US", "WFC.US",
    "GS.US", "MS.US", "BRK-B.US", "UNH.US", "JNJ.US",
    "PFE.US", "ABBV.US", "XOM.US", "CVX.US", "AMD.US",
  ];

  const watchlist = process.env.WATCHLIST_TICKERS
    ? process.env.WATCHLIST_TICKERS.split(",").map((t) => t.trim()).filter(Boolean)
    : defaultWatchlist;

  const results = await Promise.allSettled(
    watchlist.map((ticker) =>
      axios.get(`${BASE_URL}/insider-transactions`, {
        params: { code: ticker, limit: 50, api_token: apiKey, fmt: "json" },
      }).then((r) => r.data ?? [])
    )
  );

  const allTransactions = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // Filter to transactions on or after the target date
  return allTransactions.filter((t) => {
    const txDate = t.transactionDate ?? t.date ?? "";
    return txDate >= date;
  });
}

module.exports = { fetchInsiderTransactions, fetchBulkInsidersByDate };
