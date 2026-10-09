// scripts/getDriveToken.js
//
// ONE-TIME SETUP for Google Drive storage (OAuth mode).
//
// 1. In Google Cloud Console: create a project, enable "Google Drive API",
//    create OAuth client ID of type "Web application" with redirect URI
//        http://localhost:5555/oauth2callback
//    and set the OAuth consent screen "Publishing status" to "In production"
//    (in "Testing" status Google expires the refresh token after 7 days).
// 2. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env
// 3. Run:   node scripts/getDriveToken.js
// 4. Open the printed link, sign in with the DEDICATED papers account
//    (not your personal account), allow access.
// 5. Copy the two printed values into backend/.env (and Vercel env vars).

import "dotenv/config";
import http from "http";
import { drive as googleDrive, auth } from "@googleapis/drive";
import { OAUTH_SCOPES } from "../src/config/googleDrive.js";

const PORT = 5555;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const oauth = new auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT);

const url = oauth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: OAUTH_SCOPES,
});

console.log("\nOpen this link in the browser and sign in with the papers account:\n");
console.log(url, "\n");

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) return res.end();
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  try {
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);

    // The app may only use folders it created itself (drive.file scope),
    // so we create the vault folder here.
    const drive = googleDrive({ version: "v3", auth: oauth });
    const folder = await drive.files.create({
      requestBody: {
        name: "QP-VAULT (encrypted - do not edit)",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    res.end("Done. You can close this tab and go back to the terminal.");
    console.log("Add these to backend/.env:\n");
    console.log(`GOOGLE_DRIVE_AUTH=oauth`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`GOOGLE_DRIVE_PAPERS_FOLDER_ID=${folder.data.id}\n`);
    if (!tokens.refresh_token) {
      console.log("No refresh token returned. Remove the app's access at https://myaccount.google.com/permissions and run again.");
    }
  } catch (e) {
    res.end("Failed: " + e.message);
    console.error(e);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => console.log(`Waiting for Google sign-in on port ${PORT}...`));
