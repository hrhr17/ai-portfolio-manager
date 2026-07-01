const fs = require("fs");
const path = require("path");
const {
  DEFAULT_DRIVE_METADATA_FIXTURE_PATH,
  buildDriveMetadataOutput,
  fetchDriveSourcePackMetadata,
} = require("../lib/utils/driveMetadata");

async function main(argv = process.argv.slice(2)) {
  const useLiveDrive = argv.includes("--live");
  const fixturePath = getArgValue(argv, "--fixture") || DEFAULT_DRIVE_METADATA_FIXTURE_PATH;

  const output = useLiveDrive
    ? await fetchDriveSourcePackMetadata({
        fileId: getArgValue(argv, "--file-id"),
        folderId: getArgValue(argv, "--folder-id"),
      })
    : loadFixtureOutput(fixturePath);

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!output.validation.passed) {
    process.stderr.write(`Drive source-pack metadata dry run failed validation: ${output.validation.errors.join("; ")}\n`);
    process.exitCode = 1;
  }
}

function loadFixtureOutput(fixturePath) {
  const absoluteFixturePath = path.resolve(process.cwd(), fixturePath);
  const fixture = JSON.parse(fs.readFileSync(absoluteFixturePath, "utf8"));
  return buildDriveMetadataOutput({
    files: fixture.files,
    source: {
      ...fixture.source,
      fixture_path: toPosixPath(path.relative(process.cwd(), absoluteFixturePath)),
    },
    liveApiCalled: false,
  });
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
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
