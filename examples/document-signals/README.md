# Document Signal Sample Fixtures

These files are synthetic/manual fixtures for future Document Signal Agent v0 parser validation.

They are not real market data, not copied company filings, not copied earnings releases, and not copied earnings call transcripts. They should be treated as small mock documents that help test shape, routing, and guardrails before any runtime implementation exists.

Fixture rules:

- Research-only.
- Dry-run parser validation only.
- No direct BUY or SELL recommendations.
- No live trading, brokerage execution, margin, options, crypto, OAuth, paid data, or automated SEC ingestion.
- No secrets or environment variables.
- Document-derived signals should route only to future research signal extraction.
- Any future investment idea must still pass Research -> Skeptic/Challenger -> Portfolio Manager -> deterministic Risk Engine -> human review.

The sample pack uses one ticker, MSFT, and includes tiny synthetic excerpts for:

- One earnings release excerpt
- One earnings call transcript excerpt
- One 10-K/10-Q MD&A/Risk Factors style excerpt
