const fs = require("fs");
const path = require("path");
const {
  DIGEST_SCHEMA_VERSION,
  TICKER_SCHEMA_VERSION,
  validateWatchlistResearchDigest,
} = require("./validateWatchlistResearch");

const METHOD = "deterministic_watchlist_fixture_rules_v0";
const MODEL = "none";
const PROMPT_VERSION = "none";
const DEFAULT_OUTPUT_DIR = path.join("reports", "watchlist-research");

function buildWatchlistResearchDigest(watchlist, options = {}) {
  const generatedAt = options.createdAt || new Date().toISOString();
  const inputSourceFile = options.inputPath || watchlist.source?.input_path || "unknown";
  const rankedTickers = watchlist.tickers
    .map((item, index) => buildTickerDigest(item, {
      generatedAt,
      inputSourceFile,
      sourceIndex: index,
    }))
    .sort(sortByResearchPriority)
    .map((item, index) => ({
      ...item,
      research_priority_rank: index + 1,
      research_priority_label: `Research review priority ${index + 1} of ${watchlist.tickers.length}`,
    }));

  const digest = {
    schema_version: DIGEST_SCHEMA_VERSION,
    mode: "local_dry_run",
    generated_at: generatedAt,
    run_id: buildRunId(generatedAt),
    input: {
      source_file: inputSourceFile,
      schema_version: watchlist.schema_version,
      fixture_name: watchlist.fixture_name,
      fixture_version: watchlist.fixture_version,
      sample_only: watchlist.sample_only,
    },
    metadata: {
      method: METHOD,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      deterministic: true,
      optional_live_data_policy: "Unavailable optional data is marked unavailable or unverified instead of failing the dry run.",
    },
    safety: {
      research_only: true,
      local_dry_run_only: true,
      deterministic_rules_only: true,
      live_apis_called: false,
      external_network_called: false,
      llm_used: false,
      real_money_connection_enabled: false,
      leverage_enabled: false,
      derivatives_enabled: false,
      digital_asset_trading_enabled: false,
      portfolio_written: false,
      production_storage_written: false,
      local_files_written: false,
    },
    summary: {
      ticker_count: rankedTickers.length,
      high_priority_research_count: rankedTickers.filter((item) => item.research_priority_tier === "high").length,
      unverified_claim_count: rankedTickers.reduce((sum, item) => sum + item.missing_or_unverified_claims.length, 0),
      manual_review_item_count: rankedTickers.reduce((sum, item) => sum + item.manual_review_queue.length, 0),
    },
    tickers: rankedTickers,
    manual_review_queue: buildPortfolioLevelReviewQueue(rankedTickers),
    local_output_files: null,
  };

  digest.validation = validateWatchlistResearchDigest(digest);
  return digest;
}

function buildTickerDigest(item, options) {
  const whatChanged = buildWhatChanged(item);
  const whyItMayMatter = buildWhyItMayMatter(item);
  const evidence = buildEvidence(item);
  const missingOrUnverifiedClaims = buildMissingOrUnverifiedClaims(item);
  const catalysts = buildCatalysts(item);
  const manualReviewQueue = buildManualReviewQueue(item, missingOrUnverifiedClaims, catalysts);
  const researchPriorityScore = scoreResearchPriority(item, missingOrUnverifiedClaims, catalysts, manualReviewQueue);

  return {
    schema_version: TICKER_SCHEMA_VERSION,
    ticker: item.ticker,
    company_name: item.company_name,
    themes: item.themes,
    watch_reason: item.watch_reason || "No watch reason provided in input fixture.",
    research_priority_rank: null,
    research_priority_label: null,
    research_priority_tier: tierFromScore(researchPriorityScore),
    research_priority_score: researchPriorityScore,
    research_priority_reason: buildPriorityReason(researchPriorityScore, missingOrUnverifiedClaims, catalysts),
    what_changed: whatChanged,
    why_it_may_matter: whyItMayMatter,
    evidence,
    missing_or_unverified_claims: missingOrUnverifiedClaims,
    upcoming_earnings_or_catalysts: catalysts,
    manual_review_queue: manualReviewQueue,
    generated_at: options.generatedAt,
    input_source_file: options.inputSourceFile,
    source_index: options.sourceIndex,
    metadata: {
      schema_version: TICKER_SCHEMA_VERSION,
      digest_schema_version: DIGEST_SCHEMA_VERSION,
      method: METHOD,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      data_source: "local_watchlist_fixture",
    },
    safety: {
      research_only: true,
      can_directly_trade: false,
      requires_human_review: true,
      uses_social_as_direct_signal: false,
      portfolio_written: false,
      production_storage_written: false,
    },
  };
}

function buildWhatChanged(item) {
  if (item.changes.length === 0) {
    return ["No current change notes were provided in the local watchlist input."];
  }
  return item.changes.map((change) => change.summary || "Change note missing summary.");
}

function buildWhyItMayMatter(item) {
  const reasons = item.changes
    .map((change) => change.why_it_may_matter)
    .filter(Boolean);
  if (reasons.length > 0) return unique(reasons);
  return ["Business impact is unavailable in the local fixture and needs manual research."];
}

function buildEvidence(item) {
  const changeEvidence = item.changes.map((change) => ({
    evidence_id: change.change_id,
    source_title: change.source_title,
    source_url: change.source_url,
    source_type: "watchlist_change_note",
    observed_at: change.observed_at,
    evidence_text: change.evidence_text,
    verification_status: change.verification_status,
  }));

  const claimEvidence = item.current_claims.map((claim) => ({
    evidence_id: claim.claim_id,
    source_title: claim.source_type,
    source_url: claim.source_url,
    source_type: "watchlist_claim_note",
    observed_at: null,
    evidence_text: claim.claim,
    verification_status: claim.verification_status,
  }));

  return [...changeEvidence, ...claimEvidence].filter((evidence) =>
    evidence.evidence_text || evidence.source_title || evidence.source_url
  );
}

function buildMissingOrUnverifiedClaims(item) {
  const claims = item.current_claims
    .filter((claim) => claim.verification_status !== "verified")
    .map((claim) => ({
      claim_id: claim.claim_id,
      claim: claim.claim,
      verification_status: claim.verification_status,
      source_url: claim.source_url,
      next_check: "Verify against primary company materials, filings, earnings transcript, and credible contradictory sources.",
    }));

  if (claims.length > 0) return claims;

  return [{
    claim_id: `${item.ticker.toLowerCase()}-missing-claim-check`,
    claim: "No explicit claims were provided in the local watchlist input.",
    verification_status: "missing",
    source_url: null,
    next_check: "Add a specific claim before deeper research review.",
  }];
}

function buildCatalysts(item) {
  if (item.upcoming_catalysts.length === 0) {
    return [{
      catalyst_id: `${item.ticker.toLowerCase()}-earnings-unavailable`,
      title: "Upcoming earnings or catalyst data unavailable in local fixture.",
      date: null,
      expected_timing: "Unavailable; verify manually.",
      source_url: null,
      verification_status: "unavailable",
    }];
  }

  return item.upcoming_catalysts.map((catalyst) => ({
    catalyst_id: catalyst.catalyst_id,
    title: catalyst.title,
    date: catalyst.date,
    expected_timing: catalyst.expected_timing,
    source_url: catalyst.source_url,
    verification_status: catalyst.verification_status,
  }));
}

function buildManualReviewQueue(item, missingOrUnverifiedClaims, catalysts) {
  const fixtureItems = item.manual_review_items.length > 0 ? item.manual_review_items : [
    `Add manual research notes for ${item.ticker}.`,
  ];

  const generatedItems = [
    `Verify ${item.ticker} catalyst timing from investor relations or SEC filings.`,
  ];

  if (missingOrUnverifiedClaims.length > 0) {
    generatedItems.push(`Resolve ${missingOrUnverifiedClaims.length} missing or unverified claim(s) before deeper review.`);
  }
  if (catalysts.some((catalyst) => catalyst.verification_status !== "verified")) {
    generatedItems.push("Confirm all catalyst dates and source links manually.");
  }

  return unique([...fixtureItems, ...generatedItems]);
}

function scoreResearchPriority(item, missingOrUnverifiedClaims, catalysts, manualReviewQueue) {
  const severityScore = item.changes.reduce((sum, change) => {
    if (change.severity === "high") return sum + 30;
    if (change.severity === "medium") return sum + 20;
    return sum + 10;
  }, 0);
  const claimScore = Math.min(missingOrUnverifiedClaims.length * 10, 30);
  const catalystScore = catalysts.some((catalyst) => catalyst.verification_status !== "unavailable") ? 8 : 0;
  const reviewScore = Math.min(manualReviewQueue.length * 4, 20);
  const evidenceScore = Math.min(buildEvidence(item).filter((evidence) => evidence.source_url).length * 2, 8);
  return Math.min(severityScore + claimScore + catalystScore + reviewScore + evidenceScore, 100);
}

function tierFromScore(score) {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function buildPriorityReason(score, missingOrUnverifiedClaims, catalysts) {
  const pieces = [`Score ${score} reflects local fixture change severity`];
  if (missingOrUnverifiedClaims.length > 0) pieces.push(`${missingOrUnverifiedClaims.length} missing or unverified claim(s)`);
  if (catalysts.length > 0) pieces.push("available catalyst fields that require verification");
  return `${pieces.join(", ")}. This is a research triage rank only.`;
}

function buildPortfolioLevelReviewQueue(tickerDigests) {
  return tickerDigests.map((tickerDigest) =>
    `${tickerDigest.ticker}: ${tickerDigest.manual_review_queue[0]}`
  );
}

function sortByResearchPriority(a, b) {
  if (b.research_priority_score !== a.research_priority_score) {
    return b.research_priority_score - a.research_priority_score;
  }
  return a.ticker.localeCompare(b.ticker);
}

function buildMarkdownDigest(digest) {
  const lines = [
    "# Watchlist Research Digest v0",
    "",
    `Generated at: ${digest.generated_at}`,
    `Run ID: ${digest.run_id}`,
    `Input: ${digest.input.source_file}`,
    `Mode: ${digest.mode}`,
    "",
    "## Safety",
    "",
    "- Research-only local dry run.",
    "- No real-money connection, sizing content, valuation target content, or routing instructions.",
    "- Optional data that is unavailable stays marked unavailable or unverified.",
    "",
    "## Summary",
    "",
    `- Tickers reviewed: ${digest.summary.ticker_count}`,
    `- High-priority research items: ${digest.summary.high_priority_research_count}`,
    `- Missing or unverified claims: ${digest.summary.unverified_claim_count}`,
    `- Manual-review items: ${digest.summary.manual_review_item_count}`,
    "",
  ];

  for (const item of digest.tickers) {
    lines.push(`## ${item.research_priority_rank}. ${item.ticker}${item.company_name ? ` - ${item.company_name}` : ""}`);
    lines.push("");
    lines.push(`Research priority: ${item.research_priority_tier} (${item.research_priority_score})`);
    lines.push(`Reason: ${item.research_priority_reason}`);
    lines.push("");
    lines.push("What changed:");
    lines.push(...item.what_changed.map((entry) => `- ${entry}`));
    lines.push("");
    lines.push("Why it may matter:");
    lines.push(...item.why_it_may_matter.map((entry) => `- ${entry}`));
    lines.push("");
    lines.push("Evidence:");
    lines.push(...formatEvidence(item.evidence));
    lines.push("");
    lines.push("Missing or unverified claims:");
    lines.push(...item.missing_or_unverified_claims.map((claim) => `- ${claim.claim} (${claim.verification_status})`));
    lines.push("");
    lines.push("Upcoming earnings or catalysts:");
    lines.push(...item.upcoming_earnings_or_catalysts.map(formatCatalyst));
    lines.push("");
    lines.push("Manual-review queue:");
    lines.push(...item.manual_review_queue.map((entry) => `- ${entry}`));
    lines.push("");
  }

  lines.push("## Audit Trail");
  lines.push("");
  lines.push(`- Schema: ${digest.schema_version}`);
  lines.push(`- Method: ${digest.metadata.method}`);
  lines.push(`- Model: ${digest.metadata.model}`);
  lines.push(`- Prompt version: ${digest.metadata.prompt_version}`);
  lines.push(`- Live APIs called: ${digest.safety.live_apis_called}`);
  lines.push(`- External network called: ${digest.safety.external_network_called}`);
  lines.push(`- Production storage written: ${digest.safety.production_storage_written}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function writeWatchlistResearchOutputs(digest, options = {}) {
  const outputDir = path.resolve(process.cwd(), options.outputDir || DEFAULT_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = buildRunId(digest.generated_at);
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  const outputFiles = {
    json: toPosixPath(path.relative(process.cwd(), jsonPath)),
    markdown: toPosixPath(path.relative(process.cwd(), markdownPath)),
  };
  const digestForWrite = {
    ...digest,
    safety: {
      ...digest.safety,
      local_files_written: true,
    },
    local_output_files: outputFiles,
  };
  digestForWrite.validation = validateWatchlistResearchDigest(digestForWrite);

  fs.writeFileSync(jsonPath, `${JSON.stringify(digestForWrite, null, 2)}\n`);
  fs.writeFileSync(markdownPath, buildMarkdownDigest(digestForWrite));
  return outputFiles;
}

function formatEvidence(evidenceItems) {
  if (evidenceItems.length === 0) return ["- No evidence provided in local fixture."];
  return evidenceItems.map((evidence) => {
    const source = evidence.source_url ? ` ${evidence.source_url}` : "";
    return `- ${evidence.evidence_text || evidence.source_title || "Evidence note missing text."} (${evidence.verification_status})${source}`;
  });
}

function formatCatalyst(catalyst) {
  const timing = catalyst.date || catalyst.expected_timing || "timing unavailable";
  const source = catalyst.source_url ? ` ${catalyst.source_url}` : "";
  return `- ${catalyst.title} - ${timing} (${catalyst.verification_status})${source}`;
}

function buildRunId(generatedAt) {
  return `watchlist-research-dry-run-${generatedAt.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")}`;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  METHOD,
  MODEL,
  PROMPT_VERSION,
  buildMarkdownDigest,
  buildRunId,
  buildWatchlistResearchDigest,
  writeWatchlistResearchOutputs,
};
