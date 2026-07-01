const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const {
  DRIVE_METADATA_SCHEMA_VERSION,
  validateDriveMetadataOutput,
} = require("../lib/utils/driveMetadata");

const FORBIDDEN_FILE_FIELDS = [
  "body",
  "bytes",
  "base64",
  "contents",
  "data",
  "document_text",
  "excerpt",
  "file_content",
  "parsed_text",
  "raw_text",
  "rawText",
  "text",
];

function main() {
  const output = runMetadataFixtureCommand();
  const validation = validateDriveMetadataOutput(output);

  assert.strictEqual(validation.passed, true, JSON.stringify(validation.errors));
  assert.strictEqual(output.schema_version, DRIVE_METADATA_SCHEMA_VERSION);
  assert.strictEqual(output.mode, "google_drive_metadata_only");
  assert.strictEqual(output.safety.metadata_only, true);
  assert.strictEqual(output.safety.content_fetched, false);
  assert.strictEqual(output.safety.content_parsed, false);
  assert.strictEqual(output.safety.live_api_called, false);
  assert.strictEqual(output.safety.llm_used, false);
  assert.strictEqual(output.safety.portfolio_written, false);
  assert.strictEqual(output.safety.report_written, false);
  assert.strictEqual(output.safety.production_storage_written, false);
  assert.ok(Array.isArray(output.files), "metadata output must include files array");
  assert.ok(output.files.length > 0, "fixture metadata should include at least one file");

  for (const [index, file] of output.files.entries()) {
    assert.ok(file.file_id, `files[${index}] missing file_id`);
    assert.ok(file.name, `files[${index}] missing name`);
    assert.ok(file.mime_type, `files[${index}] missing mime_type`);
    assert.strictEqual(file.content_fetched, false, `files[${index}] content_fetched must be false`);
    assert.strictEqual(file.content_parsed, false, `files[${index}] content_parsed must be false`);
    assertNoContentFields(file, index);
  }

  console.log(`Drive metadata dry-run validation passed (${output.files.length} metadata file record(s)).`);
}

function runMetadataFixtureCommand() {
  const scriptPath = path.join(__dirname, "driveSourcePacksMetadataDryRun.js");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, result.stderr || "drive metadata dry-run command failed");
  assert.ok(result.stdout, "drive metadata dry-run command did not print JSON");
  return JSON.parse(result.stdout);
}

function assertNoContentFields(file, index) {
  for (const field of FORBIDDEN_FILE_FIELDS) {
    assert.strictEqual(file[field], undefined, `files[${index}] includes forbidden content field ${field}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
