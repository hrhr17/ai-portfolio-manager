# Document Signal Agent v0 Roadmap

## Purpose

Document Signal Agent v0 is a research-only roadmap for turning company documents into structured investment research signals. Its job is to organize evidence, timestamps, uncertainty, and follow-up work.

Document-derived signals are inputs to research. They cannot directly create BUY or SELL recommendations, alter portfolio weights, or bypass committee review.

## Scope

Initial document sources:

- Earnings releases
- 10-K and 10-Q filings
- Investor presentations
- Earnings call transcripts
- Company guidance and management commentary
- Curated X/bookmark signals as supplemental context only

Out of scope for v0:

- Live trading
- Brokerage execution
- Margin
- Options
- Crypto
- Direct BUY or SELL recommendations from documents
- Direct BUY or SELL recommendations from X/social signals
- Paid data dependencies unless explicitly approved later
- Automated portfolio allocation impact

## Guardrails

Document Signal Agent v0 should preserve the existing supervised Investment Committee flow:

Document Signal Agent -> Research Queue -> Equity Research Agent -> Skeptic/Challenger Agent -> Portfolio Manager Agent -> deterministic Risk Engine -> Human Review

Hard rules:

- Every signal is research-only.
- Every document-derived idea must pass Research, Skeptic/Challenger, Portfolio Manager, deterministic Risk Engine, and human review before any paper-portfolio action.
- X/social and bookmark context can create research leads only.
- Factors, document signals, and social signals cannot directly create BUY or SELL recommendations.
- Deterministic parsing and metadata extraction should come first.
- LLM calls should be used only where they add useful judgment, extraction, or summarization.
- No secrets should be stored, printed, committed, or included in examples.
- No black-box live trading or automated model allocation.

## Proposed Normalized Signal Schema

```json
{
  "ticker": "AAPL",
  "company": "Apple Inc.",
  "source_type": "earnings_release",
  "source_url": "https://example.com/company-document",
  "source_label": "company_published_document",
  "source_date": "2026-01-30",
  "available_at": "2026-01-30T21:05:00Z",
  "captured_at": "2026-01-30T21:20:00Z",
  "document_title": "Q1 2026 Earnings Release",
  "signal_type": "guidance_sentiment",
  "raw_score": 0.25,
  "confidence": 0.7,
  "evidence_snippets": [
    {
      "text": "Short excerpt from the source document.",
      "location": "page 2, guidance section"
    }
  ],
  "model": "none_or_model_name",
  "prompt_version": "none_or_document_signal_v0",
  "data_available_at_decision_time": true,
  "required_verification": [
    "Confirm source timestamp",
    "Compare guidance language against prior quarter"
  ],
  "allowed_action": "research_only",
  "can_directly_trade": false
}
```

Field notes:

- `source_date` is the document publication date when available.
- `source_label` is a plain-language label for local, pasted, or manually provided documents.
- `available_at` records when the information was available to the market or to the system.
- `captured_at` records when the system ingested or reviewed the document.
- `evidence_snippets` are required for any non-empty signal so reviewers can audit the claim.
- `model` and `prompt_version` should be logged even when no LLM was used.
- `data_available_at_decision_time` must be false if the source was not available at the relevant decision time.
- `allowed_action` must remain `research_only`.
- `can_directly_trade` must remain `false`.

## Initial Signal Types

- `guidance_sentiment`: Change in management guidance tone or explicit guidance range.
- `demand_commentary`: Commentary about customer demand, backlog, bookings, pipeline, or usage.
- `margin_pricing`: Gross margin, operating margin, pricing power, discounting, input costs, or mix shift.
- `earnings_quality`: Quality of reported earnings, one-time items, accruals, or revenue recognition concerns.
- `capital_allocation`: Buybacks, dividends, debt reduction, M&A, capex, or reinvestment plans.
- `cash_flow_quality`: Operating cash flow, free cash flow, working capital, and cash conversion signals.
- `balance_sheet_risk`: Leverage, liquidity, refinancing risk, covenant pressure, or maturity walls.
- `competitive_moat`: Evidence of durable advantage, switching costs, network effects, scale, or brand strength.
- `ai_exposure`: Concrete AI revenue, productivity, capex, product, or margin exposure.
- `disruption_risk`: Evidence of technology, business model, regulatory, or competitive disruption.
- `management_uncertainty`: Ambiguous guidance, withdrawn guidance, leadership changes, or inconsistent messaging.
- `litigation_regulatory_risk`: Litigation, investigations, regulatory pressure, enforcement risk, or compliance concerns.

## Bias Controls

Document Signal Agent v0 should be designed around timestamp discipline and auditability:

- Record publication timestamp when available.
- Record market availability timestamp separately from capture time.
- Do not use future data in historical evaluation.
- Do not blend later analyst revisions into the original document signal unless stored as a separate later source.
- Log source URL, source type, document title, source version, and capture time.
- Log model and prompt version for any LLM-assisted extraction.
- Require evidence snippets for every extracted signal.
- Flag stale documents and missing timestamps for reviewer verification.
- Keep raw document metadata separate from interpreted research conclusions.

## Routing

Document signals should enter the existing committee as research inputs only:

1. Document Signal Agent extracts normalized signals and evidence.
2. Research Queue stores follow-up tasks and required verification.
3. Equity Research Agent may use the signal to build or update a thesis.
4. Skeptic/Challenger Agent must challenge source quality, stale data, contradictions, and overinterpretation.
5. Portfolio Manager Agent may consider the reviewed thesis, but documents cannot directly force BUY or SELL.
6. Deterministic Risk Engine remains the hard risk gate.
7. Human review remains permanent before any paper-portfolio action.

## v0 Implementation Proposal

Smallest useful implementation path:

1. Start with manually provided sample documents or pasted excerpts.
2. Parse deterministic metadata first: ticker, company, document title, source type, source date, source URL, and capture time.
3. Extract a small set of normalized signals from sample text.
4. Return dry-run JSON output only.
5. Add a report-only section summarizing document signals and required verification.
6. Do not write reports unless explicitly requested by the existing report-write flag.
7. Do not add paid data APIs.
8. Do not add automated SEC ingestion unless it is trivial, free, and separately approved.
9. Do not change paper-trade behavior or portfolio allocation.

## Current v0 Dry-Run Prototype

The first runnable prototype is intentionally small and deterministic. v0.1 adds an intermediate source extraction layer:

```text
synthetic fixture records -> extracted document records -> section records -> normalized research-only signals
```

- Reads only the committed synthetic MSFT fixture at `examples/document-signals/msft-sample-documents.json`.
- Extracts source-like document records and section records with `lib/agents/documentSourceExtractor.js`.
- Normalizes extracted sections into research-only document signal records.
- Uses deterministic fixture rules in `lib/agents/documentSignalAgent.js`.
- Runs source extraction from `npm run --silent document-signals:extract-dry-run`.
- Runs from `npm run --silent document-signals:dry-run` for clean JSON stdout.
- Validates shape and safety with `npm run document-signals:validate`.
- Does not use LLMs, prompts, live APIs, Google Drive, production storage, reports, portfolio state, or cron.
- Does not ingest the real MSFT FY26 Q3 source pack.
- Does not parse DOCX, XLSX, PPTX, or PDF files.
- Does not create BUY, SELL, HOLD, allocation, order, broker, or execution instructions.

Current extraction output shape:

```json
{
  "schema_version": "document_source_extraction_v0_1",
  "mode": "synthetic_fixture_source_extraction",
  "documents": [
    {
      "source_document_id": "synthetic-q2-earnings-release-excerpt",
      "ticker": "MSFT",
      "source_type": "earnings_release",
      "source_date": "2026-01-30",
      "available_at": "2026-01-30T21:05:00Z",
      "synthetic": true,
      "not_real_market_data": true,
      "sections": [
        {
          "section_id": "synthetic-q2-earnings-release-excerpt-revenue-demand",
          "heading": "Revenue / Demand",
          "locator": "documents[0].expected_signal_types[0]"
        }
      ],
      "allowed_action": "research_only",
      "can_directly_trade": false
    }
  ]
}
```

Next planned step after v0.1: add a reviewed local text extraction fixture that more closely resembles pasted or manually uploaded documents, still without real Google Drive ingestion, binary file parsing, LLM scoring, report writing, or portfolio impact.

## Drive Source-Pack Metadata v0

The Drive source-pack metadata scaffold is a metadata-only bridge toward future real source-pack intake:

```text
Google Drive folder or known file id -> metadata-only listing -> source-pack manifest object -> validation -> dry-run JSON stdout
```

Fixture mode:

```text
npm run --silent drive-source-packs:metadata-dry-run
```

Validation:

```text
npm run drive-source-packs:validate
```

Optional live metadata-only mode, when existing Google Drive env vars are configured:

```text
npm run --silent drive-source-packs:metadata-dry-run -- --live --file-id 1dfP8xXMdw0YRnvvPisnZxdpNftc1_adu
```

This scaffold records file IDs, names, MIME types, timestamps when available, size when available, and a source-type guess. It explicitly records `content_fetched: false` and `content_parsed: false`.

Current boundaries:

- Does not download file contents.
- Does not parse the real MSFT FY26 Q3 zip.
- Does not parse DOCX, XLSX, PPTX, PDF, or zip contents.
- Does not use LLMs.
- Does not write reports, portfolio state, Google Drive files, or production storage.
- Does not add API routes, env vars, cron jobs, or trading paths.

Next planned step after Drive metadata v0: review whether metadata-only discovery should connect to a local manifest reconciliation step before any file content extraction is considered.

## v0 Planning Decisions

First sample set:

- Use one ticker only for v0, preferably MSFT or NVDA.
- Use one earnings release.
- Use one earnings call transcript excerpt.
- Use one 10-Q or 10-K MD&A/Risk Factors section.
- Keep the sample set tiny and manual until the flow is reviewed.

Manual or pasted source labeling:

```json
{
  "source_type": "manual_upload",
  "source_url": null,
  "source_label": "manual_sample_document",
  "available_at": "user_provided_if_known_otherwise_captured_at",
  "data_available_at_decision_time": "unknown"
}
```

For pasted text, use `source_type: "pasted_text"` with the same `source_url`, `source_label`, `available_at`, and `data_available_at_decision_time` conventions.

Automated SEC ingestion should wait until the manual sample-document flow is reviewed and proves useful. v0 should not add automated SEC ingestion by default.

## Cost Discipline

Preferred order of operations:

1. Use deterministic parsing and metadata extraction.
2. Use keyword or rules-based signal candidates where sufficient.
3. Use LLM extraction only for targeted evidence classification or summarization.
4. Keep prompt versions small, explicit, and reviewable.
5. Avoid repeated analysis of unchanged documents by tracking source URL, source date, and captured hash when implemented.

## Validation Checklist

Before any runtime implementation is merged:

- Parser checks pass.
- Dry-run sample document produces normalized research-only signals.
- No report is written unless explicitly requested.
- No document signal directly creates BUY or SELL.
- No X/social signal directly creates BUY or SELL.
- `allowed_action` remains `research_only`.
- `can_directly_trade` remains `false`.
- No secrets are exposed in code, logs, docs, examples, tests, or fixtures.
- No new environment variables are added unless justified.
- No paid data dependency is introduced for v0.
- Paper-portfolio behavior remains unchanged.
