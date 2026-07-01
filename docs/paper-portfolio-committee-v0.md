# Paper Portfolio Committee v0

## Purpose

Paper Portfolio Committee v0 is a deterministic local dry-run pipeline that turns watchlist and research-queue fixtures into simulated paper-portfolio actions.

This is more decisive than a passive research digest, but it is still paper-only. It does not connect to a brokerage, place orders, manage Henry's real money, or automate real portfolio changes.

## Allowed Paper Actions

The report may output only these labels:

```text
PAPER BUY CANDIDATE
PAPER HOLD
PAPER REDUCE / TRIM CANDIDATE
AVOID
WATCH
```

These labels are for a simulated paper portfolio review only. Human review remains required.

## Inputs

Local fixtures:

```text
fixtures/watchlist-research/watchlist.sample.json
fixtures/watchlist-research/research-queue.sample.json
fixtures/paper-portfolio/sample-portfolio.json
```

The watchlist and research queue mirror a small pilot subset of the Google Sheet `AI Portfolio Manager - First Watchlist`. v0 does not read Google Sheets at runtime.

The sample paper portfolio fixture includes:

- cash balance
- cash weight
- simulated holdings
- ticker
- current mock weight
- cost basis when available
- theme/category
- max single-name rule
- max theme rule
- blocked asset classes: options, margin, crypto

## Output

The dry run writes ignored local files:

```text
reports/paper-committee/*.json
reports/paper-committee/*.md
```

The report includes:

- portfolio summary
- watchlist summary
- per-ticker paper action
- action rationale
- evidence links or unavailable markers
- what changed
- why it may matter
- risk and skeptic case
- missing verification
- risk engine pass/fail
- manual-review items

## Local Commands

```bash
npm run paper:committee:dry-run
npm run paper:committee:validate
```

## Safety Boundaries

This version does not do any of the following:

- no live trading
- no brokerage integration
- no account orders
- no real-money portfolio instructions
- no margin
- no options
- no crypto or token trading
- no guaranteed-return claims
- no production database
- no cron or scheduled behavior
- no paid API requirement

The validator fails if generated output contains blocked real-money language, if any ticker has an unsupported paper action label, or if action rationale, risk case, manual review, evidence, or risk-engine fields are missing.

## Future Steps

1. Replace sample fixture rows with Henry's approved first paper-committee universe.
2. Add a manually maintained catalyst fixture.
3. Link each action to document signals from filings, earnings materials, transcripts, and investor presentations.
4. Add a paper-portfolio ledger after the report schema is stable.
5. Add a protected read-only latest-report route only after separate approval.
