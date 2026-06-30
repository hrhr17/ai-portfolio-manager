const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const {
  METHOD,
  SUPPORTED_SIGNAL_TYPES,
} = require("../lib/agents/documentSignalAgent");

const REQUIRED_SIGNAL_FIELDS = [
  "ticker",
  "source_type",
  "source_date",
  "available_at",
  "signal_type",
  "evidence",
  "research_only",
  "portfolio_actionable",
  "requires_human_review",
];

function main() {
  const extractionOutput = runJsonScript("documentSourcesExtractDryRun.js");
  assertExtractionOutput(extractionOutput);

  const dryRunScript = path.join(__dirname, "documentSignalsDryRun.js");
  const result = spawnSync(process.execPath, [dryRunScript], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, result.stderr || "dry-run command failed");
  assert.ok(result.stdout, "dry-run command did not print JSON");

  const output = JSON.parse(result.stdout);
  assert.strictEqual(output.mode, "synthetic_fixture_dry_run");
  assert.strictEqual(output.safety.live_apis_called, false);
  assert.strictEqual(output.safety.google_drive_ingested, false);
  assert.strictEqual(output.safety.llm_used, false);
  assert.strictEqual(output.safety.portfolio_written, false);
  assert.strictEqual(output.safety.report_written, false);
  assert.ok(output.extraction, "output must include extraction summary");
  assert.strictEqual(output.extraction.validation.passed, true, JSON.stringify(output.extraction.validation.errors));
  assert.strictEqual(output.extraction.document_count, extractionOutput.documents.length);
  assert.strictEqual(output.extraction.section_count, extractionOutput.validation.section_count);
  assert.ok(Array.isArray(output.signals), "output.signals must be an array");
  assert.ok(output.signals.length > 0, "dry run should produce at least one signal");
  assert.strictEqual(output.validation.passed, true, JSON.stringify(output.validation.errors));

  for (const [index, signal] of output.signals.entries()) {
    for (const field of REQUIRED_SIGNAL_FIELDS) {
      assert.notStrictEqual(signal[field], undefined, `signals[${index}] missing ${field}`);
      assert.notStrictEqual(signal[field], null, `signals[${index}] missing ${field}`);
    }
    assert.ok(SUPPORTED_SIGNAL_TYPES.has(signal.signal_type), `signals[${index}] has unsupported signal_type`);
    assert.ok(Array.isArray(signal.evidence) && signal.evidence.length > 0, `signals[${index}] missing evidence`);
    assert.strictEqual(signal.research_only, true, `signals[${index}] must be research-only`);
    assert.strictEqual(signal.portfolio_actionable, false, `signals[${index}] must not be portfolio actionable`);
    assert.strictEqual(signal.requires_human_review, true, `signals[${index}] must require human review`);
    assert.strictEqual(signal.allowed_action, "research_only", `signals[${index}] must be research_only`);
    assert.strictEqual(signal.can_directly_trade, false, `signals[${index}] cannot directly trade`);
    assert.strictEqual(signal.model, "none", `signals[${index}] must not use a model`);
    assert.strictEqual(signal.method, METHOD, `signals[${index}] must use deterministic fixture/section rules`);
    assert.strictEqual(signal.prompt_version, "none", `signals[${index}] must not use prompts`);
    assertNoTradeInstruction(signal, index);
  }

  console.log(`Document Signal Agent dry-run validation passed (${output.signals.length} signals from ${extractionOutput.documents.length} extracted documents).`);
}

function runJsonScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, result.stderr || `${scriptName} failed`);
  assert.ok(result.stdout, `${scriptName} did not print JSON`);
  return JSON.parse(result.stdout);
}

function assertExtractionOutput(output) {
  assert.strictEqual(output.mode, "synthetic_fixture_source_extraction");
  assert.strictEqual(output.safety.live_apis_called, false);
  assert.strictEqual(output.safety.google_drive_ingested, false);
  assert.strictEqual(output.safety.llm_used, false);
  assert.strictEqual(output.safety.portfolio_written, false);
  assert.strictEqual(output.safety.report_written, false);
  assert.ok(Array.isArray(output.documents), "extraction output must include documents array");
  assert.ok(output.documents.length > 0, "extraction output should include documents");
  assert.strictEqual(output.validation.passed, true, JSON.stringify(output.validation.errors));

  for (const [documentIndex, document] of output.documents.entries()) {
    assert.ok(document.source_document_id, `documents[${documentIndex}] missing source_document_id`);
    assert.ok(document.source_date, `documents[${documentIndex}] missing source_date`);
    assert.ok(document.available_at, `documents[${documentIndex}] missing available_at`);
    assert.strictEqual(document.synthetic, true, `documents[${documentIndex}] must be synthetic`);
    assert.strictEqual(document.not_real_market_data, true, `documents[${documentIndex}] must not be real market data`);
    assert.strictEqual(document.allowed_action, "research_only", `documents[${documentIndex}] must be research_only`);
    assert.strictEqual(document.can_directly_trade, false, `documents[${documentIndex}] cannot directly trade`);
    assert.ok(Array.isArray(document.sections) && document.sections.length > 0, `documents[${documentIndex}] missing sections`);

    for (const [sectionIndex, section] of document.sections.entries()) {
      assert.ok(section.text, `documents[${documentIndex}].sections[${sectionIndex}] missing text`);
      assert.ok(section.locator, `documents[${documentIndex}].sections[${sectionIndex}] missing locator`);
      assert.strictEqual(section.source_document_id, document.source_document_id, "section must point back to source document");
    }
  }
}

function assertNoTradeInstruction(signal, index) {
  const forbiddenFields = [
    "action",
    "recommendation",
    "portfolio_recommendation",
    "trade_recommendation",
    "target_weight",
    "targetWeight",
    "order_size",
    "orderSize",
    "broker_action",
    "brokerAction",
    "execution_instruction",
    "executionInstruction",
  ];

  for (const field of forbiddenFields) {
    assert.strictEqual(signal[field], undefined, `signals[${index}] includes forbidden field ${field}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
