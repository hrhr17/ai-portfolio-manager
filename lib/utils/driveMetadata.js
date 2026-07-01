const DRIVE_METADATA_SCHEMA_VERSION = "drive_source_pack_metadata_v0";
const DEFAULT_DRIVE_METADATA_FIXTURE_PATH = "examples/document-signals/drive-source-pack-metadata.sample.json";
const DEFAULT_KNOWN_SOURCE_PACK_FILE_ID = "1dfP8xXMdw0YRnvvPisnZxdpNftc1_adu";

const DRIVE_FILE_FIELDS = "id,name,mimeType,createdTime,modifiedTime,size,webViewLink";

const FORBIDDEN_CONTENT_FIELDS = new Set([
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
]);

async function fetchDriveSourcePackMetadata({ fileId, folderId } = {}) {
  const auth = getDriveMetadataAuthClient();
  const drive = getDriveClient(auth);
  const targetFileId = fileId || (folderId ? null : DEFAULT_KNOWN_SOURCE_PACK_FILE_ID);
  const files = [];

  if (targetFileId) {
    const result = await drive.files.get({
      fileId: targetFileId,
      fields: DRIVE_FILE_FIELDS,
      supportsAllDrives: true,
    });
    files.push(result.data);
  } else if (folderId || process.env.GOOGLE_DRIVE_FOLDER_ID) {
    const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const result = await drive.files.list({
      q: `'${targetFolderId}' in parents and trashed = false`,
      fields: `files(${DRIVE_FILE_FIELDS})`,
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(result.data.files || []));
  } else {
    throw new Error("Missing Drive metadata target. Provide --file-id, --folder-id, or GOOGLE_DRIVE_FOLDER_ID.");
  }

  return buildDriveMetadataOutput({
    files,
    source: {
      drive_folder_id_env: "GOOGLE_DRIVE_FOLDER_ID",
      known_source_pack_file_id: targetFileId || null,
      folder_id_provided: Boolean(folderId),
      file_id_provided: Boolean(fileId),
    },
    liveApiCalled: true,
  });
}

function buildDriveMetadataOutput({ files, source = {}, liveApiCalled = false } = {}) {
  const normalizedFiles = (files || []).map(normalizeDriveFileMetadata);
  const output = {
    schema_version: DRIVE_METADATA_SCHEMA_VERSION,
    mode: "google_drive_metadata_only",
    source: {
      drive_folder_id_env: "GOOGLE_DRIVE_FOLDER_ID",
      known_source_pack_file_id: DEFAULT_KNOWN_SOURCE_PACK_FILE_ID,
      ...source,
    },
    files: normalizedFiles,
    safety: {
      metadata_only: true,
      content_fetched: false,
      content_parsed: false,
      live_api_called: liveApiCalled,
      llm_used: false,
      portfolio_written: false,
      report_written: false,
      production_storage_written: false,
    },
  };

  output.validation = validateDriveMetadataOutput(output);
  return output;
}

function normalizeDriveFileMetadata(file) {
  const fileId = file.file_id || file.id;
  const mimeType = file.mime_type || file.mimeType || null;
  const webViewLinkPresent = Boolean(file.web_view_link_present || file.webViewLink);

  return {
    file_id: fileId,
    name: file.name,
    mime_type: mimeType,
    created_time: file.created_time || file.createdTime || null,
    modified_time: file.modified_time || file.modifiedTime || null,
    size: file.size || null,
    web_view_link_present: webViewLinkPresent,
    source_type_guess: file.source_type_guess || guessSourceType(file.name, mimeType),
    content_fetched: false,
    content_parsed: false,
  };
}

function validateDriveMetadataOutput(output) {
  const errors = [];
  const warnings = [];

  if (!output || output.schema_version !== DRIVE_METADATA_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${DRIVE_METADATA_SCHEMA_VERSION}.`);
  }
  if (output?.mode !== "google_drive_metadata_only") {
    errors.push("mode must be google_drive_metadata_only.");
  }
  if (!Array.isArray(output?.files)) {
    errors.push("files must be an array.");
  }
  if (output?.safety?.metadata_only !== true) errors.push("safety.metadata_only must be true.");
  if (output?.safety?.content_fetched !== false) errors.push("safety.content_fetched must be false.");
  if (output?.safety?.content_parsed !== false) errors.push("safety.content_parsed must be false.");
  if (output?.safety?.llm_used !== false) errors.push("safety.llm_used must be false.");
  if (output?.safety?.portfolio_written !== false) errors.push("safety.portfolio_written must be false.");
  if (output?.safety?.report_written !== false) errors.push("safety.report_written must be false.");
  if (output?.safety?.production_storage_written !== false) errors.push("safety.production_storage_written must be false.");

  (output?.files || []).forEach((file, index) => {
    for (const field of ["file_id", "name", "mime_type", "source_type_guess"]) {
      if (file[field] == null || file[field] === "") {
        errors.push(`files[${index}] missing required field: ${field}`);
      }
    }
    if (file.content_fetched !== false) errors.push(`files[${index}] content_fetched must be false.`);
    if (file.content_parsed !== false) errors.push(`files[${index}] content_parsed must be false.`);
  });

  const forbiddenContentFields = findForbiddenContentFields(output);
  if (forbiddenContentFields.length > 0) {
    errors.push(`Forbidden content/body/text fields present: ${forbiddenContentFields.join(", ")}`);
  }

  if (output?.files?.length === 0) warnings.push("No Drive metadata files were returned.");

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    file_count: output?.files?.length || 0,
  };
}

function getDriveMetadataAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable");

  const { google } = require("googleapis");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
  });
}

function getDriveClient(auth) {
  const { google } = require("googleapis");
  return google.drive({ version: "v3", auth });
}

function guessSourceType(name, mimeType) {
  const lowerName = String(name || "").toLowerCase();
  const lowerMime = String(mimeType || "").toLowerCase();

  if (lowerName.endsWith(".zip") || lowerMime.includes("zip")) return "source_pack_zip";
  if (lowerName.endsWith(".docx")) return "word_document";
  if (lowerName.endsWith(".xlsx")) return "spreadsheet_workbook";
  if (lowerName.endsWith(".pptx")) return "presentation";
  if (lowerName.endsWith(".pdf")) return "pdf_document";
  return "unknown_metadata_file";
}

function findForbiddenContentFields(value, path = "output") {
  if (!value || typeof value !== "object") return [];
  const found = [];

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_CONTENT_FIELDS.has(key)) found.push(childPath);
    if (child && typeof child === "object") found.push(...findForbiddenContentFields(child, childPath));
  }

  return found;
}

module.exports = {
  DEFAULT_DRIVE_METADATA_FIXTURE_PATH,
  DEFAULT_KNOWN_SOURCE_PACK_FILE_ID,
  DRIVE_METADATA_SCHEMA_VERSION,
  buildDriveMetadataOutput,
  fetchDriveSourcePackMetadata,
  guessSourceType,
  normalizeDriveFileMetadata,
  validateDriveMetadataOutput,
};
