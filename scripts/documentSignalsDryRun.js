const fs = require("fs");
const path = require("path");
const {
  DEFAULT_FIXTURE_PATH,
  runDocumentSignalDryRun,
} = require("../lib/agents/documentSignalAgent");

function main(argv = process.argv.slice(2)) {
  const fixturePath = getArgValue(argv, "--fixture") || DEFAULT_FIXTURE_PATH;
  const absoluteFixturePath = path.resolve(process.cwd(), fixturePath);
  const fixtureBundle = JSON.parse(fs.readFileSync(absoluteFixturePath, "utf8"));
  const output = runDocumentSignalDryRun(fixtureBundle, {
    fixturePath: toPosixPath(path.relative(process.cwd(), absoluteFixturePath)),
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!output.validation.passed) {
    process.stderr.write(`Document Signal Agent dry run failed validation: ${output.validation.errors.join("; ")}\n`);
    process.exitCode = 1;
  }
}

function getArgValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

if (require.main === module) {
  main();
}

module.exports = { main };
