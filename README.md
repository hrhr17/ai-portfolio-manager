# AI Portfolio Manager

AI Portfolio Manager is a paper-only AI Investment Committee for supervised investment research.

It behaves like a small research team: it gathers data, opens research tasks, writes theses, forces skeptic objections, proposes paper portfolio actions, applies deterministic risk rules, writes a report, and records process lessons.

## What This Is Not

This is not a live trading bot.

It does not:

- connect to a brokerage
- place real-money trades
- use margin
- trade options
- trade crypto
- claim or guarantee returns

Every recommendation is paper-only and should be reviewed by a human.

## Vercel Routes

```text
/api/health
/api/daily-investment-committee
/api/smart-money-analyst
/api/x-intake
```

The existing Vercel cron still points to:

```text
/api/smart-money-analyst
```

That legacy route delegates to:

```text
/api/daily-investment-committee
```

This keeps the old cron working while the new committee pipeline becomes the main system.

## Daily Pipeline

1. Data Agent
   Pulls raw EODHD insider transactions and checks the X/social placeholder source.

2. Signal Scout Agent
   Converts raw inputs into research tasks. Social signals can only create research tasks, not trades.

3. Quant Research Agent / Factor Lab
   Converts repeated ideas into research-only factor hypotheses. Factors cannot create trades and do not affect paper allocation yet.

4. Equity Research Agent
   Builds a concise thesis for each candidate: business summary, valuation context, catalyst, risks, time horizon, and verification needs.

5. Skeptic Agent
   Challenges every thesis before allocation. It flags missing data, stale evidence, valuation risk, social manipulation risk, liquidity concerns, and other objections.

6. Portfolio Manager Agent
   Converts reviewed theses into paper-only BUY, SELL, HOLD, or WATCH recommendations.

7. Risk Engine
   Applies deterministic hard rules: no live trading, no margin, no options, no crypto, position caps, turnover caps, and concentration caps.

8. Reporting Agent
   Writes the daily Google Doc report when the run is not a dry run.

9. Post-Mortem / Learning Agent
   Reviews available paper-portfolio history, benchmark placeholders, source reliability, and process lessons.

## Quant Research / Factor Lab Roadmap

The long-term goal is a quantamental investment committee: human-supervised research that combines investment judgment with disciplined, testable factor work.

Repeated ideas should become testable factors. X/social, insider, and fundamental signals can inspire hypotheses, but they are not enough to justify trades by themselves. For example, repeated insider clusters, recurring earnings-revision patterns, or repeated high-quality social research mentions should become factor hypotheses with named data requirements, benchmarks, holding periods, expected edge, known biases, and validation status.

Factors cannot directly create BUY or SELL recommendations. Before a factor can influence even paper allocation, it must pass the same committee discipline:

```text
Research hypothesis -> Skeptic/Challenger review -> Backtest/validation -> Portfolio review -> Deterministic Risk Engine -> Human review
```

The Factor Lab roadmap emphasizes transparent tools: probability, Bayesian updating, regime awareness, position sizing, portfolio construction, signal extraction, optimization, simulation, and post-mortem discipline. The current implementation is only lightweight scaffolding. It does not include a full backtesting engine, paid data dependency, black-box ML allocation, live brokerage execution, margin, options, crypto, or guaranteed returns.

The deterministic Risk Engine remains the only risk gate for paper recommendations. Factor Lab `riskControls` are research metadata for future hypothesis validation, not a second execution or risk system.

Future ideas should move through explicit orchestrator states instead of jumping from signal to recommendation:

```text
captured
normalized
hypothesis_created
researching
challenged
validated
paper_trading
human_review
approved
rejected
monitoring
retired
```

The current route does not implement a full state machine yet. It only documents the interface and emits research-only placeholders.

Standard factor hypotheses should use this shape:

```text
id
title
sourceSignals
hypothesis
economicRationale
factorDefinition
requiredData
benchmark
holdingPeriod
entryRules
exitRules
riskControls
decayConditions
knownBiases
validationStatus
allowedAction
canDirectlyTrade
```

Hypotheses must be specific, falsifiable, timestamp-aware, and research-only. `allowedAction` may be `research_only`, `watch`, or `paper_candidate`, but this scaffold currently emits only `research_only`. `canDirectlyTrade` must remain `false`.

Future quant challenge and model-risk review should explicitly test:

```text
look-ahead bias
survivorship bias
overfitting
data leakage
multiple comparisons
weak sample size
transaction cost realism
regime dependency
factor crowding
missing economic rationale
```

Future statistical validation should require:

```text
benchmark versus SPY/QQQ
block bootstrap or appropriate time-series null model
multiple-comparisons correction such as Benjamini-Hochberg
strict t-statistic threshold for new factors
walk-forward validation
holding-period sensitivity
transaction cost/slippage assumptions
data availability at decision time
```

Future monitoring should track:

```text
signal health
performance health
data health
drawdown breaches
Sharpe degradation
signal inactivity
stale/missing inputs
human-review escalation
```

The human review gate is permanent. AI can generate and pre-filter hypotheses, write research tasks, and propose paper recommendations, but AI cannot bypass human review for live capital. Any live trading or brokerage integration is out of scope until paper performance, auditability, monitoring, and deterministic risk gates are proven.

Starter factors currently tracked in code:

```text
insider_cluster_buying
politician_trade_following
unusual_options_flow
earnings_revision_momentum
social_research_density
relative_strength
valuation_reset
post_earnings_drift
quality_value_momentum_combo
```

## Google Drive Report

The report includes:

- Executive Summary
- New Signals
- X/Social/Bookmark Signals
- X / Social Signal Desk
- Henry X Intelligence Brief
- Research Queue
- Quant Research / Factor Lab
- Approved Paper Trades
- Rejected Ideas and Why
- Risk Committee Output
- Portfolio Review
- Performance Review
- Mistakes / Lessons / Process Improvements
- Watchlist
- Audit Trail

If there are no real insider transactions, the pipeline still writes a report with empty signal counts, no approved paper trades, portfolio status, and process notes. It does not invent trades.

## Required Vercel Environment Variables

Set these in Vercel Project Settings. Do not commit secret values to the repo.

```text
EODHD_API_KEY
FINNHUB_API_KEY
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_DRIVE_FOLDER_ID
CRON_SECRET
```

Recommended:

```text
WATCHLIST_TICKERS
RESEARCH_QUEUE_LIMIT
```

Optional:

```text
PAPER_PORTFOLIO_JSON
PAPER_PORTFOLIO_HISTORY_JSON
X_SOURCE_MOCK_SIGNALS
X_INTAKE_SECRET
MAX_SINGLE_POSITION_TARGET_WEIGHT_PCT
MAX_NEW_POSITIONS_PER_DAY
MAX_DAILY_TURNOVER_PCT
MAX_SECTOR_CONCENTRATION_PCT
MAX_THEME_CONCENTRATION_PCT
```

## Dry Run

Dry run mode is for safe review. It uses sample data and does not call EODHD, Finnhub, X, or Google Drive.

```text
/api/daily-investment-committee?dryRun=true
```

Manual dry runs require the same authorization header used by the cron:

```text
Authorization: Bearer <CRON_SECRET>
```

Dry runs return JSON with pipeline outputs from each agent and a report preview.

By default, dry runs do not write to Google Drive. To explicitly write a sample dry-run report, call:

```text
/api/daily-investment-committee?dryRun=true&writeReport=true
```

## Health Check

Use:

```text
/api/health
```

The health endpoint returns project status, version, configured env var names, and missing env var names. It never prints secret values.

## X / Social Integration

X integration is currently a mock/manual source-intake layer only.

The interface is prepared for future X MCP or direct X API ingestion, but this repo does not authenticate to X today and does not require X `CLIENT_ID`, `CLIENT_SECRET`, bearer tokens, access tokens, or refresh tokens.

Current v0 source priority:

1. User bookmarks
2. User-provided monitored accounts
3. User-provided X lists
4. Keyword/cashtag searches
5. General feed/following only as future discovery

There are two separate use cases:

- General Henry X Intelligence Hub: useful AI tools, startups, business ideas, revenue opportunities, learning resources, workflows, Codex/ChatGPT improvements, content ideas, and things worth ignoring.
- AI Portfolio Manager X Signal Desk: finance-relevant signals only. These become research tasks, watchlist items, or report notes.

X/social inputs are idea-generation inputs only. They are not a trading engine. They can never directly create BUY or SELL recommendations.

Any investment idea sourced from X must still pass:

```text
Signal Scout -> Equity Research -> Skeptic -> Portfolio Manager -> Risk Engine
```

The normalizer classifies each X/social signal with:

```text
source
sourceAccount
sourceUrl
capturedAt
rawText
tickers
companies
people
themes
signalType
category
claim
initialConfidence
sourceQuality
signalStrength
actionabilityScore
verificationNeeded
primarySourceNeeded
requiredVerification
recommendedNextStep
relatedTickers
relatedThemes
timeSensitivity
projectTags
status
```

Supported categories:

```text
insider_trading
politician_trading
unusual_options_flow
equity_research
macro
earnings_catalyst
valuation
copy_trade_alert
company_news
ai_tool_or_workflow
business_opportunity
startup_to_watch
content_idea
watchlist
noise
```

Supported outcomes:

```text
ignore
watch
send_to_research
send_to_skeptic
add_to_report
add_to_general_intelligence_brief
```

### Manual X Intake

`/api/x-intake` accepts a small manual batch of copied X posts/bookmarks and normalizes them into structured signals. It is protected by `X_INTAKE_SECRET` if present, otherwise by `CRON_SECRET`.

Example request body:

```json
{
  "source": "manual_bookmark_batch",
  "posts": [
    {
      "sourceAccount": "@sample_researcher",
      "sourceUrl": "https://x.example/sample/nvda-ai-demand",
      "rawText": "$NVDA checks suggest hyperscaler AI accelerator demand remains strong into earnings."
    }
  ]
}
```

Example files:

```text
examples/x-signals.sample.json
examples/monitored-x-accounts.sample.json
```

## Document Signal Agent v0 Dry Run

Document Signal Agent v0.1 is a synthetic-fixture-only prototype. It reads the committed MSFT sample documents, extracts source-like document records and sections, normalizes them into research-only document signal records, and prints deterministic JSON.

Current flow:

```text
synthetic fixture records -> extracted document records -> section records -> normalized research-only signals
```

Inspect the extraction layer only:

```text
npm run --silent document-signals:extract-dry-run
```

Run:

```text
npm run --silent document-signals:dry-run
```

Validate the dry-run shape:

```text
npm run document-signals:validate
```

The normalized schema and validation guardrails live in:

```text
lib/agents/documentSignalAgent.js
lib/agents/documentSourceExtractor.js
```

Current boundaries:

- Uses only `examples/document-signals/msft-sample-documents.json`.
- Extracts sections deterministically from synthetic fixture metadata and excerpts.
- Does not call LLMs.
- Does not call live APIs.
- Does not fetch Google Drive files.
- Does not ingest the real MSFT FY26 Q3 source pack yet.
- Does not parse DOCX, XLSX, PPTX, or PDF files yet.
- Does not write reports, portfolio state, production storage, or Google Drive documents.
- Does not create BUY, SELL, HOLD, allocation, order, broker, or execution instructions.
- Emits research-only signals that require human review.

The real MSFT FY26 Q3 source pack is represented only by a metadata manifest:

```text
examples/document-signals/msft-fy26-q3-source-pack-manifest.json
```

Real Drive ingestion, DOCX/XLSX/PPTX parsing, LLM scoring, report writing, and portfolio integration are later PRs.

## Paper Portfolio Committee v0 Dry Run

Paper Portfolio Committee v0 creates simulated paper-portfolio actions from local fixtures. It is local, deterministic, and dry-run only.

Run:

```text
npm run paper:committee:dry-run
```

Validate:

```text
npm run paper:committee:validate
```

Inputs:

```text
fixtures/watchlist-research/watchlist.sample.json
fixtures/watchlist-research/research-queue.sample.json
fixtures/paper-portfolio/sample-portfolio.json
```

Generated reports:

```text
reports/paper-committee/
```

Allowed simulated paper labels:

```text
PAPER BUY CANDIDATE
PAPER HOLD
PAPER REDUCE / TRIM CANDIDATE
AVOID
WATCH
```

Current boundaries:

- Uses local fixtures only.
- Does not call live APIs.
- Does not call LLMs.
- Does not write production storage.
- Does not connect to a brokerage or create account orders.
- Does not use margin, options, or crypto.
- Outputs simulated paper actions only, not real-money financial advice.

## Drive Source-Pack Metadata Dry Run

Drive source-pack metadata dry run is a metadata-only scaffold for future document intake. It can describe source-pack files by file ID, name, MIME type, timestamps, size, and source-type guess without downloading or parsing file contents.

Fixture mode is the default and does not require secrets:

```text
npm run --silent drive-source-packs:metadata-dry-run
```

Validate the metadata-only shape:

```text
npm run drive-source-packs:validate
```

The sample fixture lives at:

```text
examples/document-signals/drive-source-pack-metadata.sample.json
```

If existing Google Drive env vars are configured, an explicit live metadata-only dry run can be attempted with:

```text
npm run --silent drive-source-packs:metadata-dry-run -- --live --file-id 1dfP8xXMdw0YRnvvPisnZxdpNftc1_adu
```

or:

```text
npm run --silent drive-source-packs:metadata-dry-run -- --live --folder-id <GOOGLE_DRIVE_FOLDER_ID>
```

The command prints only metadata JSON. It does not print secret values.

Current boundaries:

- Metadata only.
- No file content download.
- No real document ingestion.
- No zip extraction.
- No DOCX, XLSX, PPTX, or PDF parsing.
- No LLM scoring.
- No report writing.
- No portfolio impact.
- No production storage writes.

## File Map

```text
api/daily-investment-committee.js
api/smart-money-analyst.js
api/health.js
api/x-intake.js
lib/agents/documentSignalAgent.js
lib/agents/documentSourceExtractor.js
lib/agents/dataAgent.js
lib/agents/signalScoutAgent.js
lib/agents/equityResearchAgent.js
lib/agents/skepticAgent.js
lib/agents/portfolioManagerAgent.js
lib/agents/reportingAgent.js
lib/agents/postMortemAgent.js
lib/agents/quantResearchAgent.js
lib/agents/backtestValidationAgent.js
lib/agents/modelRiskAgent.js
lib/agents/monitoringAgent.js
lib/factors/factorLibrary.js
lib/risk/riskEngine.js
lib/portfolio/paperPortfolio.js
lib/sources/xSourceAgent.js
lib/utils/fetchInsiders.js
lib/utils/fetchFundamentals.js
lib/utils/sampleData.js
lib/utils/driveMetadata.js
lib/utils/writeToDrive.js
scripts/driveSourcePacksMetadataDryRun.js
scripts/documentSourcesExtractDryRun.js
scripts/documentSignalsDryRun.js
scripts/run-paper-portfolio-committee-dry-run.js
scripts/validate-paper-portfolio-committee.js
scripts/validateDocumentSignals.js
scripts/validateDriveMetadata.js
```

Only actual HTTP endpoints live under `api/`. Shared modules live under `lib/` so Vercel does not deploy each helper as a separate serverless function.
