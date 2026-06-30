const { google } = require("googleapis");

/**
 * Authenticates with Google using a service account.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON env var (full JSON string).
 */
function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable");

  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/documents",
    ],
  });
}

/**
 * Writes a daily insider analysis report to a Google Doc in a specified Drive folder.
 *
 * @param {string} title - Document title (e.g. "Smart Money Report 2026-06-26")
 * @param {string} content - Plain text or Markdown-ish report body
 * @returns {Promise<{ docId: string, docUrl: string }>}
 */
async function writeDailyReportToDrive(title, content) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID environment variable");

  const auth = getAuthClient();
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  // Create blank doc
  const createRes = await docs.documents.create({ requestBody: { title } });
  const docId = createRes.data.documentId;

  // Insert report content
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    },
  });

  // Move doc into the target Drive folder
  const fileRes = await drive.files.get({ fileId: docId, fields: "parents" });
  const previousParents = (fileRes.data.parents ?? []).join(",");

  await drive.files.update({
    fileId: docId,
    addParents: folderId,
    removeParents: previousParents,
    fields: "id, parents",
  });

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

module.exports = { writeDailyReportToDrive };
