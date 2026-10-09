// src/config/googleDrive.js
//
// Two ways to connect to Google Drive (choose with GOOGLE_DRIVE_AUTH):
//
// A) "oauth"  (works with a normal Gmail / college Google account)
//    A dedicated account such as  coe.papers.kpt@gmail.com  owns the files.
//    Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//    Get the refresh token once with:  node scripts/getDriveToken.js
//
// B) "service_account"  (only if the college has Google Workspace)
//    Service accounts have NO storage of their own, so the folder MUST be
//    inside a Shared Drive where the service account is a member.
//    Env: GOOGLE_SERVICE_ACCOUNT_JSON  (the key JSON, base64 encoded)
//
// OAuth mode uses the narrow "drive.file" scope: the app can only see files
// and folders it created itself, never anything else in that Google account.
// (That is why the papers folder must be created by scripts/getDriveToken.js,
// not by hand in the Drive website.)
// A service account can only see what is shared with it, so it uses "drive".

import { drive as googleDrive, auth } from "@googleapis/drive";

export const OAUTH_SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const SA_SCOPES = ["https://www.googleapis.com/auth/drive"];

let client = null;

export function getDrive() {
  if (client) return client;

  const mode = process.env.GOOGLE_DRIVE_AUTH || "oauth";
  let authClient;

  if (mode === "service_account") {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    const credentials = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8")
    );
    authClient = new auth.GoogleAuth({ credentials, scopes: SA_SCOPES });
  } else {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } =
      process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      throw new Error(
        "Google Drive OAuth env vars missing (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)"
      );
    }
    authClient = new auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    authClient.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  }

  client = googleDrive({ version: "v3", auth: authClient });
  return client;
}

export function getPaperFolderId() {
  const id = process.env.GOOGLE_DRIVE_PAPERS_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_PAPERS_FOLDER_ID is not set");
  return id;
}
