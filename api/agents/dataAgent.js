const { fetchBulkInsidersByDate } = require("../utils/fetchInsiders");
const { fetchXSocialSignals, getXSourceStatus } = require("../sources/xSourceAgent");
const { getSampleInsiderTransactions, getSampleXSocialSignals } = require("../utils/sampleData");

async function collectDailyInputs({ date, useSampleData = false } = {}) {
  if (useSampleData) {
    const insiderTransactions = getSampleInsiderTransactions(date);
    const xSocialSignals = getSampleXSocialSignals(date);

    return {
      date,
      collectedAt: new Date().toISOString(),
      dryRunSampleData: true,
      raw: {
        insiderTransactions,
        xSocialSignals,
      },
      sourceStatus: {
        eodhdInsiders: {
          status: "sample",
          count: insiderTransactions.length,
          error: null,
        },
        xSocial: {
          ...getXSourceStatus(),
          mode: "sample",
          count: xSocialSignals.length,
        },
      },
      auditTrail: [
        {
          agent: "Data Agent",
          action: "Loaded dry-run sample inputs",
          sources: ["Sample insider transactions", "Sample X/social placeholder"],
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const [insiderResult, xResult] = await Promise.allSettled([
    fetchBulkInsidersByDate(date),
    fetchXSocialSignals({ date }),
  ]);

  const insiderTransactions = unwrapArray(insiderResult, "EODHD insider transactions");
  const xSocialSignals = unwrapArray(xResult, "X/social placeholder signals");

  return {
    date,
    collectedAt: new Date().toISOString(),
    raw: {
      insiderTransactions,
      xSocialSignals,
    },
    sourceStatus: {
      eodhdInsiders: {
        status: insiderResult.status === "fulfilled" ? "ok" : "error",
        count: insiderTransactions.length,
        error: insiderResult.status === "rejected" ? insiderResult.reason.message : null,
      },
      xSocial: {
        ...getXSourceStatus(),
        count: xSocialSignals.length,
      },
    },
    auditTrail: [
      {
        agent: "Data Agent",
        action: "Collected raw inputs",
        sources: ["EODHD insider transactions", "X/social placeholder"],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function unwrapArray(result, label) {
  if (result.status === "fulfilled" && Array.isArray(result.value)) return result.value;
  if (result.status === "fulfilled") return [];

  console.warn(`[data-agent] ${label} failed:`, result.reason.message);
  return [];
}

module.exports = { collectDailyInputs };
