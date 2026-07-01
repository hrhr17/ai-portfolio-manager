# Daily Investment Committee Dry-Run Orchestrator v0

## Purpose

The Daily Investment Committee dry-run orchestrator creates one safe daily packet from existing fixture-only modules.

It is meant to be the first local operating loop for the AI Portfolio Manager: gather fixture-only signals, summarize module status, run deterministic safety checks, and show Henry what needs human review.

This version is local/CLI-first. It is not scheduled by Vercel in this PR.

## What It Does

- Runs Manual X Intelligence Intake using the synthetic local fixture.
- Runs Document Signal Agent using synthetic sample documents only.
- Runs Google Drive source-pack metadata dry-run using fixture metadata only.
- Summarizes the paper portfolio placeholder/status without writing a ledger.
- Validates that the packet remains research-only.
- Prints a readable summary and JSON-compatible packet.

## What It Does Not Do

- No live trading.
- No brokerage execution.
- No real-money activity.
- No margin.
- No options.
- No crypto or token trading.
- No direct trade from X/social data.
- No X API, OAuth, MCP, scraping, or browser automation.
- No external network calls.
- No LLM calls.
- No Google Drive document download or parsing.
- No portfolio ledger writes.
- No report writes.

## Local Commands

```bash
npm run daily:dry-run
npm run daily:validate
```

The dry-run command exits nonzero if safety validation fails.

## Protected Route

The Vercel-compatible route is:

```text
/api/daily-dry-run
```

It requires:

```text
Authorization: Bearer <CRON_SECRET>
```

The route returns `401` when `CRON_SECRET` is missing or the header does not exactly match. It returns the daily packet JSON when authorized.

The route is dry-run only. It does not write to Google Drive, a portfolio ledger, a report store, or production storage.

## Scheduling

`/api/daily-dry-run` is not scheduled by `vercel.json` in this PR.

Scheduling can be considered in a future PR after explicit approval and a separate safety review.

The existing `/api/smart-money-analyst` cron remains unchanged.

## Output Safety

The packet always includes:

- `run_mode: "dry_run"`
- `allowed_action: "research_only"`
- `can_directly_trade: false`
- `human_review_required: true`
- `prohibited_actions_found: false` when validation passes

The validator fails if prohibited direct-action fields appear, including target sizing, order, brokerage, execution, quantity, margin, options, or crypto/token action fields.

## Future Steps

1. Persist daily packets.
2. Add a paper portfolio ledger.
3. Add benchmark and performance tracking.
4. Add a post-mortem loop.
5. Add live X bookmark import later, after separate approval.
