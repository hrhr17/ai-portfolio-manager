# Manual X Intelligence Intake v0 Roadmap

## 1. Purpose

Manual X Intelligence Intake v0 defines how Henry's X bookmarks, pasted X links, and short notes should later become structured intelligence leads.

The goal is to let Henry collect signals with minimal friction while the system eventually classifies, summarizes, dedupes, scores source quality, and routes the material internally.

This is a roadmap and schema document only. It does not implement X OAuth, X MCP, API sync, scraping, paid reads, runtime agents, API routes, cron jobs, portfolio writes, or trading behavior.

## 2. Henry's Role as Signal Collector

Henry is the human signal collector. He should be able to bookmark freely and paste links or notes without maintaining detailed filing discipline.

Henry is actively bookmarking material related to:

- AI infrastructure
- Semiconductors
- Data centers, networking, cooling, memory, and power infrastructure
- Nuclear energy, uranium, small modular reactors, electrification, and grid infrastructure
- Defense technology, autonomy, drones, space, cybersecurity, and electronic warfare
- Robotics and automation
- Quantum and frontier compute
- Public-company tickers
- Macro and quant research
- Agentic AI workflows
- Business and content ideas
- Codex and ChatGPT workflow upgrades

The system should do the organization work later.

## 3. Manual v0 Workflow

Manual v0 workflow:

```text
Henry bookmarks freely or pastes X links/notes
-> system receives manual fixture or Google Sheet-style rows
-> system normalizes each item into an X intelligence signal
-> system classifies category/theme
-> system dedupes against prior signals
-> system scores source quality/confidence
-> system routes to the correct queue
-> no portfolio action without full research/risk/human-review chain
```

X/social signals may create:

- Research tasks
- Watchlist items
- Daily report notes
- Document follow-ups
- Business intelligence notes
- Content ideas
- Learning resources
- Noise or ignore labels

X/social signals must never directly create:

- BUY, SELL, or HOLD recommendations
- Portfolio trades
- Target weights
- Order sizes
- Broker actions
- Execution instructions

## 4. Minimal-Friction Bookmarking Principle

Manual X Intake v0 should not depend on Henry maintaining detailed bookmark folders.

Preferred workflow:

```text
Henry bookmarks freely
-> intake gathers raw bookmarks or pasted links
-> system classifies, summarizes, dedupes, scores source quality, and routes internally
-> internal categories/routes become the real organizational layer
```

The system should treat raw bookmarks and pasted links as unstructured intake. Internal classification, deduplication, and routing are the durable organizational layer.

## 5. Optional X Folder Metadata

X folders are optional metadata only. They are not the source of truth.

Do not require detailed X folder hygiene.

If folder guidance is useful, keep it minimal:

- `AI Portfolio`
- `AI / Agent Workflows`
- `Business / Content`

Future versions may try to auto-organize X bookmarks into folders if X API or MCP permissions support it. v0 does not implement auto-foldering.

## 6. Proposed Google Sheet Intake Format

Recommended Google Sheet columns:

```text
captured_at
x_url
optional_bookmark_folder
source_account
raw_note
raw_claim
ticker_mentions
company_mentions
category
theme
portfolio_relevance
business_relevance
summary
confidence
source_quality
recommended_route
required_verification
duplicate_of
status
reviewed_by_henry
```

The Google Sheet format is only a planning shape for manual/pasted intake. This PR does not create a sheet, read a sheet, or add any Google API integration.

## 7. Manual JSON Fixture Format

Manual JSON fixtures should support the same fields as the Google Sheet format:

```json
{
  "fixture_name": "manual_x_intelligence_samples_v0",
  "fixture_version": "0.1.0",
  "synthetic": true,
  "items": [
    {
      "captured_at": "2026-07-01T00:00:00Z",
      "x_url": "https://x.com/example/status/123",
      "optional_bookmark_folder": "AI Portfolio",
      "source_account": "@example",
      "raw_note": "Henry note or pasted context",
      "raw_claim": "Brief claim from post",
      "ticker_mentions": ["MSFT"],
      "company_mentions": ["Microsoft"],
      "category": "ai_infrastructure",
      "theme": "data_centers_power",
      "portfolio_relevance": "medium",
      "business_relevance": "low",
      "summary": "Short summary",
      "confidence": 0.5,
      "source_quality": "unknown",
      "recommended_route": "portfolio_research_queue",
      "required_verification": [
        "corroborate with primary source",
        "check company filing",
        "verify ticker exposure"
      ],
      "duplicate_of": null,
      "status": "new",
      "reviewed_by_henry": false
    }
  ]
}
```

Fixtures should not contain secrets, private tokens, copied paywalled text, or trading instructions.

## 8. Normalized X Signal Schema

Normalized signals should use a stable shape similar to:

```json
{
  "signal_id": "deterministic-id",
  "captured_at": "2026-07-01T00:00:00Z",
  "x_url": "https://x.com/example/status/123",
  "optional_bookmark_folder": "AI Portfolio",
  "source_account": "@example",
  "raw_note": "Henry note or pasted context",
  "raw_claim": "brief claim from post",
  "ticker_mentions": ["MSFT"],
  "company_mentions": ["Microsoft"],
  "category": "ai_infrastructure",
  "theme": "data_centers_power",
  "summary": "short summary",
  "confidence": 0.5,
  "source_quality": "unknown",
  "portfolio_relevance": "medium",
  "business_relevance": "low",
  "recommended_route": "portfolio_research_queue",
  "required_verification": [
    "corroborate with primary source",
    "check company filing",
    "verify ticker exposure"
  ],
  "duplicate_of": null,
  "status": "new",
  "allowed_action": "research_only",
  "can_directly_trade": false,
  "requires_human_review": true
}
```

Required safety fields:

- `allowed_action: "research_only"`
- `can_directly_trade: false`
- `requires_human_review: true`

## 9. Categories and Routes

Finance categories:

- `insider_trading`
- `politician_trading`
- `unusual_options_flow`
- `equity_research`
- `macro`
- `earnings_catalyst`
- `valuation`
- `copy_trade_alert`
- `company_news`
- `watchlist`
- `ai_infrastructure`
- `defense_tech`
- `nuclear_energy`
- `robotics`
- `quantum_frontier_compute`
- `data_centers_power`
- `cybersecurity`
- `crypto_adjacent_ai_infrastructure`
- `noise`

General intelligence categories:

- `ai_tool_or_workflow`
- `business_opportunity`
- `startup_to_watch`
- `content_idea`
- `learning_resource`
- `codex_chatgpt_workflow_upgrade`
- `general_intelligence`
- `noise`

Allowed routes:

- `portfolio_research_queue`
- `watchlist_candidate`
- `daily_report_note`
- `document_signal_followup`
- `business_opportunity_queue`
- `content_idea_queue`
- `learning_resource_queue`
- `ignore_noise`

## 10. Portfolio-Specific Guardrails

X signals can trigger research, not trades.

Rules:

- A ticker mention is not an investment thesis.
- A viral thread is not evidence by itself.
- Single-post claims are unverified until corroborated.
- Any portfolio-relevant signal must be corroborated with primary or higher-quality sources.
- X/social data cannot directly create BUY, SELL, or HOLD recommendations.
- X/social data cannot directly create portfolio trades, target weights, order sizes, broker actions, or execution instructions.
- Any paper allocation idea must pass the full investment committee chain and deterministic Risk Engine.
- No real-money execution.

Portfolio-relevant X signals must route through:

```text
Research -> Skeptic/Challenger -> Portfolio Manager -> deterministic Risk Engine -> Human Review
```

Crypto-adjacent public equities may be researched only when the thesis is AI compute, HPC, data centers, power capacity, grid interconnects, cooling, or strategic infrastructure. No crypto or token speculation is allowed.

## 11. General Intelligence Use Cases

X intake is broader than the portfolio manager. It should also route:

- AI tools and resources
- Agentic workflow ideas
- Codex and ChatGPT workflow improvements
- Startups to watch
- Business and revenue opportunities
- Content ideas
- Learning resources
- Things worth ignoring

These can become general intelligence notes, report notes, learning resources, business idea queues, or content idea queues.

## 12. Source Quality and Verification

Source quality levels:

- `unknown`: unverified source, one-off post, unclear credibility.
- `low`: promotional, anonymous, engagement bait, unsupported claim.
- `medium`: plausible source, some supporting evidence, but not primary.
- `high`: primary source, credible expert, official filing, company release, or corroborated by multiple reliable sources.

Required verification examples:

- Corroborate with a primary source.
- Check company filings, earnings releases, presentations, or transcripts.
- Verify ticker exposure and whether the claim is material.
- Check whether the post is stale, promotional, copied, or contradicted by higher-quality evidence.
- Separate market narrative from factual evidence.

## 13. Deduplication Rules

Deduplication guidance:

- Same URL should dedupe exactly.
- Same source account plus same core claim should be flagged as a potential duplicate.
- Same ticker/theme from multiple sources should not be discarded; it should be clustered.
- Clustered signals should preserve individual source evidence.
- Repeated independent signals can raise research priority, but not bypass verification.

Deduplication should reduce clutter without deleting useful evidence.

## 14. Daily Intake Vision

Future daily intake vision:

```text
Once daily
-> gather new X bookmarks / pasted links / manual notes
-> classify and summarize
-> dedupe against prior signals
-> identify useful tickers/themes/sources
-> route to research queue, watchlist, report note, content idea, learning resource, or ignore/noise
-> include important items in the daily Investment Committee packet
```

This is a future vision. It is not implemented by this PR.

## 15. Future X API/MCP Sync

Future versions may support:

- Henry's bookmarks
- Bookmark folders, if available
- Monitored accounts
- X lists
- Keyword and cashtag searches
- General following/feed only as later discovery

Boundaries:

- v0 does not use OAuth, MCP, API sync, scraping, or paid X reads.
- v0 is manual/pasted-link or Google Sheet-style planning only.
- Any future X integration must not expose or commit credentials.
- X credentials must remain in environment variables or local secure config only.
- X never directly creates portfolio actions.

## 16. Open Questions

- Should the first manual intake fixture separate finance and general-intelligence examples?
- What minimum fields should Henry have to provide when pasting a link?
- Should source quality start as `unknown` unless Henry explicitly labels it?
- How much deduplication should happen before human review?
- Which portfolio themes deserve dedicated internal tags?
- Should business/content ideas appear in the daily Investment Committee packet or a separate Henry Intelligence Brief?

## 17. Next Implementation PR

Proposed next PR:

```text
Manual X Intake dry-run prototype
```

It should:

- Read a local JSON fixture of pasted X links and notes.
- Normalize records into X intelligence signals.
- Classify using deterministic rules only.
- Route signals to allowed queues.
- Validate no direct trading/action fields.
- Avoid X API, OAuth, MCP, scraping, paid reads, and LLM calls.
- Avoid portfolio writes, report writes, cron jobs, and production storage.

The next implementation should remain research-only and human-review-gated.
