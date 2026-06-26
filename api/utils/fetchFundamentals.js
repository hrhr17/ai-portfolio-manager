const axios = require("axios");

const BASE_URL = "https://finnhub.io/api/v1";

function getHeaders() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("Missing FINNHUB_API_KEY environment variable");
  return { "X-Finnhub-Token": apiKey };
}

/**
 * Fetches basic financial metrics for a company.
 * @param {string} ticker - Stock ticker symbol (e.g. "AAPL")
 * @returns {Promise<Object>} Metric data including P/E, EPS, revenue growth, etc.
 */
async function fetchBasicFinancials(ticker) {
  const response = await axios.get(`${BASE_URL}/stock/metric`, {
    headers: getHeaders(),
    params: { symbol: ticker, metric: "all" },
  });
  return response.data;
}

/**
 * Fetches company profile (sector, market cap, description, etc.)
 * @param {string} ticker
 * @returns {Promise<Object>}
 */
async function fetchCompanyProfile(ticker) {
  const response = await axios.get(`${BASE_URL}/stock/profile2`, {
    headers: getHeaders(),
    params: { symbol: ticker },
  });
  return response.data;
}

/**
 * Fetches analyst recommendation trends.
 * @param {string} ticker
 * @returns {Promise<Array>}
 */
async function fetchRecommendationTrends(ticker) {
  const response = await axios.get(`${BASE_URL}/stock/recommendation`, {
    headers: getHeaders(),
    params: { symbol: ticker },
  });
  return response.data ?? [];
}

/**
 * Fetches earnings surprises to gauge fundamental momentum.
 * @param {string} ticker
 * @param {number} [limit=4] - Number of quarters
 * @returns {Promise<Array>}
 */
async function fetchEarningsSurprises(ticker, limit = 4) {
  const response = await axios.get(`${BASE_URL}/stock/earnings`, {
    headers: getHeaders(),
    params: { symbol: ticker, limit },
  });
  return response.data ?? [];
}

module.exports = {
  fetchBasicFinancials,
  fetchCompanyProfile,
  fetchRecommendationTrends,
  fetchEarningsSurprises,
};
