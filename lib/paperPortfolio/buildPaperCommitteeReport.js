const fs = require("fs");
const path = require("path");
const {
  ACTION_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  validatePaperCommitteeReport,
} = require("./validatePaperCommitteeReport");
const {
  buildPortfolioRiskSnapshot,
  choosePaperAction,
  evaluatePaperActionRisk,
} = require("./riskRules");

const DEFAULT_OUTPUT_DIR = "reports/paper-committee";
const METHOD = "deterministic_paper_committee_rules_v0";
const MODEL = "none";
const PROMPT_VERSION = "none";

function buildPaperCommitteeReport(inputs, options = {}) {
  const generatedAt = options.createdAt || new Date().toISOString();
  const holdingsByTicker = new Map(inputs.portfolio.holdings.map((holding) => [holding.ticker, holding]));
  const actions = inputs.watchlist.tickers.map((item) => {
    const holding = holdingsByTicker.get(item.ticker) || null;
    const paperAction = choosePaperAction(item, holding, inputs.portfolio);
    const riskEngine = evaluatePaperActionRisk({
      paperAction,
      watchlistItem: item,
      holding,
      portfolio: inputs.portfolio,
    });

    return buildTickerAction({
      item,
      holding,
      paperAction,
      riskEngine,
      generatedAt,
      inputPaths: inputs.input_paths,
    });
  });

  const report = {
    schema_version: REPORT_SCHEMA_VERSION,
    mode: "local_dry_run",
    run_id: buildRunId(generatedAt),
    generated_at: generatedAt,
    inputs: {
      watchlist_fixture: inputs.input_paths.watchlist,
      research_queue_fixture: inputs.input_paths.research_queue,
      paper_portfolio_fixture: inputs.input_paths.paper_portfolio,
      product_reference: {
        source_title: inputs.watchlist.product_reference.source_title,
        source_tabs: inputs.watchlist.product_reference.source_tabs,
        runtime_google_sheets_integration: false,
      },
    },
    metadata: {
      method: METHOD,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      deterministic: true,
      runtime_live_data_used: false,
    },
    portfolio_summary: buildPortfolioSummary(inputs.portfolio),
    watchlist_summary: buildWatchlistSummary(inputs.watchlist),
    research_queue_summary: buildResearchQueueSummary(inputs.researchQueue),
    actions,
    manual_review_queue: buildManualReviewQueue(actions),
    safety: {
      paper_simulated_only: true,
      real_money_advice_provided: false,
      live_trading_enabled: false,
      brokerage_integration_enabled: false,
      automated_ordering_enabled: false,
      margin_enabled: false,
      options_enabled: false,
      crypto_enabled: false,
      production_storage_written: false,
      local_files_written: false,
    },
    local_output_files: null,
  };

  report.validation = validatePaperCommitteeReport(report);
  return report;
}

function buildTickerAction({ item, holding, paperAction, riskEngine, generatedAt, inputPaths }) {
  const currentWeight = holding ? holding.current_mock_weight_pct : 0;
  return {
    schema_version: ACTION_SCHEMA_VERSION,
    ticker: item.ticker,
    company_name: item.company_name,
    category: item.category,
    primary_theme: item.primary_theme,
    holding_status: holding ? "in_sample_paper_portfolio" : "not_in_sample_paper_portfolio",
    current_mock_weight_pct: currentWeight,
    paper_action: paperAction,
    action_rationale: buildActionRationale(item, holding, paperAction, riskEngine),
    evidence: item.evidence.length > 0 ? item.evidence : [buildUnavailableEvidenceMarker(item.ticker)],
    what_changed: item.what_changed.length > 0 ? item.what_changed : ["No change note provided in fixture."],
    why_it_may_matter: item.why_it_may_matter.length > 0 ? item.why_it_may_matter : ["Business impact is unavailable in fixture."],
    risk_skeptic_case: buildRiskSkepticCase(item, holding),
    missing_verification: item.missing_verification,
    risk_engine: riskEngine,
    manual_review_items: buildManualReviewItems(item, paperAction, riskEngine),
    generated_at: generatedAt,
    input_source_files: {
      watchlist: inputPaths.watchlist,
      research_queue: inputPaths.research_queue,
      paper_portfolio: inputPaths.paper_portfolio,
    },
    metadata: {
      method: METHOD,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      committee_score: item.committee_score,
    },
    safety: {
      paper_simulated_only: true,
      real_money_instruction: false,
      automated_order_created: false,
      requires_human_review: true,
    },
  };
}

function buildActionRationale(item, holding, paperAction, riskEngine) {
  const rationale = [
    `${paperAction} is based on deterministic fixture score ${item.committee_score}, current sample paper exposure, and local risk-rule checks.`,
  ];

  if (paperAction === "PAPER BUY CANDIDATE") {
    rationale.push("High score, source links, and no current sample paper exposure make this eligible for simulated committee review.");
  }
  if (paperAction === "PAPER HOLD") {
    rationale.push("Existing sample paper exposure remains inside current rule limits, but still requires manual review.");
  }
  if (paperAction === "PAPER REDUCE / TRIM CANDIDATE") {
    rationale.push("Current sample paper exposure or risk burden requires a concentration review before the next simulated committee pass.");
  }
  if (paperAction === "AVOID") {
    rationale.push("Risk burden or blocked-rule context is too high for sample paper escalation.");
  }
  if (paperAction === "WATCH") {
    rationale.push("Evidence exists, but the fixture does not clear the deterministic threshold for a stronger paper action.");
  }
  if (holding) {
    rationale.push(`Current mock weight is ${holding.current_mock_weight_pct}%.`);
  }
  if (!riskEngine.passed) {
    rationale.push(`Risk engine failed: ${riskEngine.violations.join("; ")}`);
  }

  return rationale;
}

function buildRiskSkepticCase(item, holding) {
  const cases = [item.risk_skeptic_lens || "Risk case unavailable in fixture."];
  if (holding && holding.current_mock_weight_pct > 0) {
    cases.push(`Existing sample paper exposure is ${holding.current_mock_weight_pct}%, so concentration and theme risk need review.`);
  }
  if (item.missing_verification.length > 0) {
    cases.push(`Missing verification count: ${item.missing_verification.length}.`);
  }
  return cases;
}

function buildManualReviewItems(item, paperAction, riskEngine) {
  const items = [...item.manual_review_items];
  items.push(`Confirm ${item.ticker} evidence and risk case before accepting the ${paperAction} label in a paper review.`);
  if (!riskEngine.passed) items.push("Resolve risk engine failure before any further paper workflow step.");
  if (item.evidence.length === 0) items.push("Add at least one source link or explicit unavailable marker.");
  return unique(items);
}

function buildUnavailableEvidenceMarker(ticker) {
  return {
    source_title: "Evidence unavailable in local fixture",
    source_url: null,
    verification_status: "unavailable",
    evidence_note: `${ticker} needs source links before deeper paper committee review.`,
  };
}

function buildPortfolioSummary(portfolio) {
  const riskSnapshot = buildPortfolioRiskSnapshot(portfolio);
  const investedWeightPct = round(portfolio.holdings.reduce((sum, holding) => sum + Number(holding.current_mock_weight_pct || 0), 0));
  return {
    as_of: portfolio.as_of,
    currency: portfolio.currency,
    cash_balance: portfolio.cash_balance,
    cash_weight_pct: portfolio.cash_weight_pct,
    holdings_count: portfolio.holdings.length,
    invested_mock_weight_pct: investedWeightPct,
    rules: portfolio.rules,
    theme_weights: riskSnapshot.theme_weights,
    single_name_violations: riskSnapshot.single_name_violations,
    theme_violations: riskSnapshot.theme_violations,
    paper_only: portfolio.paper_only,
    simulated: portfolio.simulated,
  };
}

function buildWatchlistSummary(watchlist) {
  return {
    fixture_name: watchlist.fixture_name,
    fixture_version: watchlist.fixture_version,
    ticker_count: watchlist.tickers.length,
    count_by_category: countBy(watchlist.tickers, "category"),
    high_priority_count: watchlist.tickers.filter((item) => item.priority.toLowerCase() === "high").length,
    product_reference_source: watchlist.product_reference.source_title,
  };
}

function buildResearchQueueSummary(researchQueue) {
  return {
    fixture_name: researchQueue.fixture_name,
    fixture_version: researchQueue.fixture_version,
    task_count: researchQueue.tasks.length,
    ready_task_count: researchQueue.tasks.filter((task) => task.status.toLowerCase().includes("ready")).length,
    high_priority_task_count: researchQueue.tasks.filter((task) => task.priority.toLowerCase() === "high").length,
    task_types: researchQueue.tasks.map((task) => task.task_type),
  };
}

function buildManualReviewQueue(actions) {
  return actions.flatMap((action) =>
    action.manual_review_items.slice(0, 2).map((item) => `${action.ticker}: ${item}`)
  );
}

function buildMarkdownReport(report) {
  const lines = [
    "# Paper Portfolio Committee v0",
    "",
    `Generated at: ${report.generated_at}`,
    `Run ID: ${report.run_id}`,
    `Mode: ${report.mode}`,
    "",
    "## Safety",
    "",
    "- Simulated paper portfolio output only.",
    "- No real-money instruction, live trading, account order, actual-portfolio change, margin, options, crypto, or guaranteed-return claim.",
    "- Human review is required before any future workflow step.",
    "",
    "## Portfolio Summary",
    "",
    `- Cash balance: ${report.portfolio_summary.currency} ${report.portfolio_summary.cash_balance}`,
    `- Cash weight: ${report.portfolio_summary.cash_weight_pct}%`,
    `- Holdings: ${report.portfolio_summary.holdings_count}`,
    `- Invested mock weight: ${report.portfolio_summary.invested_mock_weight_pct}%`,
    `- Max single-name rule: ${report.portfolio_summary.rules.max_single_name_weight_pct}%`,
    `- Max theme rule: ${report.portfolio_summary.rules.max_theme_weight_pct}%`,
    "",
    "## Watchlist Summary",
    "",
    `- Tickers reviewed: ${report.watchlist_summary.ticker_count}`,
    `- High-priority items: ${report.watchlist_summary.high_priority_count}`,
    `- Product reference: ${report.watchlist_summary.product_reference_source}`,
    "",
    "## Paper Actions",
    "",
  ];

  for (const action of report.actions) {
    lines.push(`### ${action.ticker} - ${action.company_name || "Company name unavailable"}`);
    lines.push("");
    lines.push(`Paper action: ${action.paper_action}`);
    lines.push(`Risk engine: ${action.risk_engine.decision}`);
    lines.push(`Current mock weight: ${action.current_mock_weight_pct}%`);
    lines.push("");
    lines.push("Rationale:");
    lines.push(...action.action_rationale.map((item) => `- ${item}`));
    lines.push("");
    lines.push("What changed:");
    lines.push(...action.what_changed.map((item) => `- ${item}`));
    lines.push("");
    lines.push("Why it may matter:");
    lines.push(...action.why_it_may_matter.map((item) => `- ${item}`));
    lines.push("");
    lines.push("Evidence:");
    lines.push(...action.evidence.map(formatEvidence));
    lines.push("");
    lines.push("Risk / skeptic case:");
    lines.push(...action.risk_skeptic_case.map((item) => `- ${item}`));
    lines.push("");
    lines.push("Missing verification:");
    lines.push(...formatListOrNone(action.missing_verification));
    lines.push("");
    lines.push("Manual review:");
    lines.push(...action.manual_review_items.map((item) => `- ${item}`));
    lines.push("");
  }

  lines.push("## Audit Trail");
  lines.push("");
  lines.push(`- Schema: ${report.schema_version}`);
  lines.push(`- Method: ${report.metadata.method}`);
  lines.push(`- Model: ${report.metadata.model}`);
  lines.push(`- Prompt version: ${report.metadata.prompt_version}`);
  lines.push(`- Runtime live data used: ${report.metadata.runtime_live_data_used}`);
  lines.push(`- Production storage written: ${report.safety.production_storage_written}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function writePaperCommitteeOutputs(report, options = {}) {
  const outputDir = path.resolve(process.cwd(), options.outputDir || DEFAULT_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = buildRunId(report.generated_at);
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  const localOutputFiles = {
    json: toPosixPath(path.relative(process.cwd(), jsonPath)),
    markdown: toPosixPath(path.relative(process.cwd(), markdownPath)),
  };
  const reportForWrite = {
    ...report,
    safety: {
      ...report.safety,
      local_files_written: true,
    },
    local_output_files: localOutputFiles,
  };
  reportForWrite.validation = validatePaperCommitteeReport(reportForWrite);

  fs.writeFileSync(jsonPath, `${JSON.stringify(reportForWrite, null, 2)}\n`);
  fs.writeFileSync(markdownPath, buildMarkdownReport(reportForWrite));
  return localOutputFiles;
}

function formatEvidence(evidence) {
  const source = evidence.source_url ? ` ${evidence.source_url}` : "";
  return `- ${evidence.source_title || "Source unavailable"} (${evidence.verification_status})${source}`;
}

function formatListOrNone(items) {
  if (!items || items.length === 0) return ["- None listed in fixture."];
  return items.map((item) => `- ${item}`);
}

function buildRunId(generatedAt) {
  return `paper-committee-dry-run-${generatedAt.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")}`;
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  METHOD,
  MODEL,
  PROMPT_VERSION,
  buildMarkdownReport,
  buildPaperCommitteeReport,
  buildRunId,
  writePaperCommitteeOutputs,
};
