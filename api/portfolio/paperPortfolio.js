function loadPaperPortfolioSnapshot() {
  const fallback = {
    asOf: new Date().toISOString(),
    cashWeightPct: 100,
    positions: [],
    notes: [
      "No persistent paper portfolio store is configured yet.",
      "Set PAPER_PORTFOLIO_JSON to provide current paper positions to the committee.",
    ],
  };

  if (!process.env.PAPER_PORTFOLIO_JSON) return fallback;

  try {
    const parsed = JSON.parse(process.env.PAPER_PORTFOLIO_JSON);
    return normalizeSnapshot(parsed);
  } catch (err) {
    console.warn("[paper-portfolio] Could not parse PAPER_PORTFOLIO_JSON:", err.message);
    return {
      ...fallback,
      notes: [...fallback.notes, "PAPER_PORTFOLIO_JSON could not be parsed; using empty snapshot."],
    };
  }
}

function applyPaperRecommendations(snapshot, approvedPaperTrades) {
  const positions = new Map((snapshot.positions || []).map((position) => [position.ticker, { ...position }]));

  for (const trade of approvedPaperTrades) {
    if (!["BUY", "HOLD", "SELL"].includes(trade.action)) continue;
    if (trade.action === "SELL" || trade.targetWeightPct === 0) {
      positions.delete(trade.ticker);
      continue;
    }

    positions.set(trade.ticker, {
      ticker: trade.ticker,
      weightPct: trade.targetWeightPct,
      sector: trade.sector || "Unknown",
      theme: trade.theme || "Unknown",
      thesis: trade.thesis,
      reviewTrigger: trade.reviewTrigger,
    });
  }

  const nextPositions = [...positions.values()].sort((a, b) => b.weightPct - a.weightPct);
  const investedWeightPct = nextPositions.reduce((sum, position) => sum + Number(position.weightPct || 0), 0);

  return {
    asOf: new Date().toISOString(),
    cashWeightPct: Math.max(round(100 - investedWeightPct), 0),
    positions: nextPositions,
    notes: [
      "Projected paper portfolio only.",
      "This preview is not persisted unless a future storage layer is added.",
    ],
  };
}

function normalizeSnapshot(snapshot) {
  return {
    asOf: snapshot.asOf || new Date().toISOString(),
    cashWeightPct: Number(snapshot.cashWeightPct ?? 100),
    positions: Array.isArray(snapshot.positions)
      ? snapshot.positions.map((position) => ({
          ticker: String(position.ticker || "").toUpperCase(),
          weightPct: Number(position.weightPct || 0),
          sector: position.sector || "Unknown",
          theme: position.theme || "Unknown",
          thesis: position.thesis || "",
          reviewTrigger: position.reviewTrigger || "",
        }))
      : [],
    notes: Array.isArray(snapshot.notes) ? snapshot.notes : [],
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = { loadPaperPortfolioSnapshot, applyPaperRecommendations };
