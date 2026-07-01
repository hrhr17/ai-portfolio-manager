# AGENTS.md

Standing instructions for Codex when working on the AI Portfolio Manager project.

## Project Posture

- Henry is not a coder. Keep PR summaries, validation reports, and status updates clear, concise, and non-technical where possible.
- Always inspect the repo, relevant files, branch state, and existing conventions before editing.
- Prefer small, reviewable draft PRs with narrow scope.
- Do not touch, print, infer, request, or commit secrets.

## Safety Boundaries

- Do not add live trading, brokerage execution, margin, options, crypto/token trading, or real-money functionality.
- X/social data may only create research tasks, watchlist items, report notes, learning resources, business/content ideas, or source-intake records.
- X/social data must never directly create BUY/SELL/HOLD recommendations, orders, target weights, quantities, or execution instructions.
- Every investment idea must preserve this path:

```text
Research -> Skeptic/Challenger -> Portfolio Manager -> deterministic Risk Engine -> Human Review
```

- The deterministic Risk Engine must remain rule-based, not LLM-based.
- Prefer fixture-only, dry-run, local-first implementations before production routes, cron jobs, persistence, or external APIs.
- If adding an API route, it must be protected and must not expose secrets.
- If adding scheduled behavior, explicitly justify why it is safe and wait for human approval unless already requested.

## Validation Expectations

Run and report validation before finishing. Use the checks relevant to the change:

- relevant npm scripts
- relevant `node --check` commands
- `npm test` when applicable
- `git diff --check`
- JSON parse checks for changed JSON files
- redacted secrets scan

## PR Report Expectations

Final PR reports should include:

- branch name
- changed files
- validation commands and results
- deployment status if available
- any skipped checks or failures
- confirmation that safety boundaries were preserved
