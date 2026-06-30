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

## Real Source Pack Manifests

Real source packs should live outside the repo, such as in a manually managed Google Drive upload. The repo may include a manifest that records expected file names, roles, and verification needs without committing the actual real documents.

For the MSFT FY26 Q3 source pack:

- The real documents remain in Google Drive.
- The manifest records what files exist without committing those files.
- Core v0 sources are the earnings release, 10-Q, and earnings call transcript.
- Spreadsheets and slides are supporting context only for now.
- No real filings, transcripts, spreadsheets, or slides should be committed until explicitly approved.
