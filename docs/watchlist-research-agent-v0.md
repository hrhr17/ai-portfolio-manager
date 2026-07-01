# Watchlist Research Agent v0

## Purpose

Watchlist Research Agent v0 is a deterministic local research-report pipeline.

Despite the name, this version is not an autonomous agent. It reads a small local watchlist fixture, builds a weekly-style research digest, writes Markdown and JSON files, and validates that the output stays research-only.

## What It Does

- Reads `examples/watchlist-research/sample-watchlist.json`.
- Normalizes a small ticker universe.
- Builds a per-ticker research digest with:
  - ticker and company name
  - research priority ranking
  - what changed
  - why it may matter
  - evidence links or notes where available
  - missing or unverified claims
  - upcoming earnings or catalyst placeholders when provided
  - manual-review queue items
  - generated timestamp, input file, and schema metadata
- Writes local JSON and Markdown reports under `reports/watchlist-research/`.
- Validates safety boundaries and schema shape.

## What It Does Not Do

- No live trading.
- No brokerage execution.
- No real-money activity.
- No margin.
- No options.
- No crypto or token trading.
- No automated direct trading labels.
- No allocation sizing.
- No target prices.
- No portfolio rebalancing instructions.
- No direct trade from X, social, or bookmark data.
- No live API calls.
- No LLM calls.
- No production database writes.
- No Vercel route.
- No scheduled behavior.

## Local Commands

```bash
npm run watchlist:research:dry-run
npm run watchlist:research:validate
```

The dry-run command writes:

```text
reports/watchlist-research/*.json
reports/watchlist-research/*.md
```

Those generated report files are ignored by git. Only `reports/watchlist-research/.gitkeep` is committed.

## Input

The default input is:

```text
examples/watchlist-research/sample-watchlist.json
```

The sample watchlist is intentionally small and marked sample-only. It includes local fixture notes for MSFT, NVDA, and PLTR. The notes are research leads, not confirmed facts.

Run with a different input file:

```bash
node scripts/run-watchlist-research-dry-run.js --input path/to/watchlist.json
```

## Output Shape

The top-level digest includes:

```text
schema_version
mode
generated_at
run_id
input
metadata
safety
summary
tickers
manual_review_queue
local_output_files
validation
```

Each ticker digest includes:

```text
ticker
company_name
research_priority_rank
research_priority_tier
research_priority_score
what_changed
why_it_may_matter
evidence
missing_or_unverified_claims
upcoming_earnings_or_catalysts
manual_review_queue
generated_at
input_source_file
schema_version
metadata
safety
```

## Safety Model

The validator checks that output remains:

- research-only
- local dry-run only
- deterministic
- human-review gated
- free of direct trading labels, allocation fields, execution fields, brokerage fields, margin fields, options fields, crypto fields, and target-price fields

Optional catalyst or evidence data may be unavailable. Missing optional data is labeled unavailable or unverified instead of failing the dry run.

## Future Steps

1. Replace the sample fixture with Henry's approved watchlist.
2. Add a simple manually maintained catalyst file.
3. Add document-signal links from filings, transcripts, earnings materials, and investor presentations.
4. Add source-quality scoring for each evidence item.
5. Add a weekly review packet that combines this digest with the Daily Investment Committee dry run.
