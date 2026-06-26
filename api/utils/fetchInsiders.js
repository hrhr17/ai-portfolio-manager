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
 * Fetches recent bulk insider transactions across the market (no ticker filter).
 * Useful for scanning the full market for smart-money signals.
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {Promise<Array>}
 */
async function fetchBulkInsidersByDate(date) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("Missing EODHD_API_KEY environment variable");

  const url = `${BASE_URL}/insider-transactions`;
  const response = await axios.get(url, {
    params: {
      date,
      api_token: apiKey,
      fmt: "json",
    },
  });

  return response.data ?? [];
}

module.exports = { fetchInsiderTransactions, fetchBulkInsidersByDate };
