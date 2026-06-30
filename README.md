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

3. Equity Research Agent
   Builds a concise thesis for each candidate: business summary, valuation context, catalyst, risks, time horizon, and verification needs.

4. Skeptic Agent
   Challenges every thesis before allocation. It flags missing data, stale evidence, valuation risk, social manipulation risk, liquidity concerns, and other objections.

5. Portfolio Manager Agent
   Converts reviewed theses into paper-only BUY, SELL, HOLD, or WATCH recommendations.

6. Risk Engine
   Applies deterministic hard rules: no live trading, no margin, no options, no crypto, position caps, turnover caps, and concentration caps.

7. Reporting Agent
   Writes the daily Google Doc report when the run is not a dry run.

8. Post-Mortem / Learning Agent
   Reviews available paper-portfolio history, benchmark placeholders, source reliability, and process lessons.

## Google Drive Report

The report includes:

- Executive Summary
- New Signals
- X/Social/Bookmark Signals
- Research Queue
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
```

Recommended:

```text
CRON_SECRET
WATCHLIST_TICKERS
RESEARCH_QUEUE_LIMIT
```

Optional:

```text
PAPER_PORTFOLIO_JSON
PAPER_PORTFOLIO_HISTORY_JSON
X_SOURCE_MOCK_SIGNALS
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

If `CRON_SECRET` is configured, include the same authorization header used by the cron:

```text
Authorization: Bearer YOUR_CRON_SECRET
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

X integration is currently a placeholder/source-intake layer only.

The interface is prepared for future monitored accounts, bookmarks, lists, cashtags, unusual-alert accounts, and trader/researcher accounts. It does not authenticate to X today, and X/social inputs are not allowed to create trades directly.

## File Map

```text
api/daily-investment-committee.js
api/smart-money-analyst.js
api/health.js
lib/agents/dataAgent.js
lib/agents/signalScoutAgent.js
lib/agents/equityResearchAgent.js
lib/agents/skepticAgent.js
lib/agents/portfolioManagerAgent.js
lib/agents/reportingAgent.js
lib/agents/postMortemAgent.js
lib/risk/riskEngine.js
lib/portfolio/paperPortfolio.js
lib/sources/xSourceAgent.js
lib/utils/fetchInsiders.js
lib/utils/fetchFundamentals.js
lib/utils/sampleData.js
lib/utils/writeToDrive.js
```

Only actual HTTP endpoints live under `api/`. Shared modules live under `lib/` so Vercel does not deploy each helper as a separate serverless function.
