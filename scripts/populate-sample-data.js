/**
 * scripts/populate-sample-data.js
 * ─────────────────────────────────
 * Seeds sample data for the new Activity_News sheet
 * and updates sample activities with new fields.
 * Run ONLY in development / staging.
 */

const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const auth = new google.auth.GoogleAuth({
  keyFile: require("path").join(__dirname, "../credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

async function run() {
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  // ── Sample Activity_News rows ───────────────────────────────────────────
  const sampleNews = [
    {
      coverage_id: uuidv4(),
      activity_id: "ACT-SAMPLE01", // replace with real activity_id from your sheet
      media_name: "The Daily Star",
      coverage_link: "https://thedailystar.net/sample-coverage",
      coverage_date: "2025-06-15",
      verified: "TRUE",
      created_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      coverage_id: uuidv4(),
      activity_id: "ACT-SAMPLE01",
      media_name: "Prothom Alo",
      coverage_link: "https://prothomalo.com/sample-coverage",
      coverage_date: "2025-06-16",
      verified: "FALSE",
      created_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      coverage_id: uuidv4(),
      activity_id: "ACT-SAMPLE02",
      media_name: "BD News 24",
      coverage_link: "https://bdnews24.com/sample-coverage",
      coverage_date: "2025-07-01",
      verified: "TRUE",
      created_at: new Date().toISOString(),
      created_by: "admin",
    },
  ];

  const NEWS_HEADERS = [
    "coverage_id","activity_id","media_name","coverage_link",
    "coverage_date","verified","created_at","created_by",
  ];

  const newsRows = sampleNews.map((n) => NEWS_HEADERS.map((h) => n[h] ?? ""));

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Activity_News!A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: newsRows },
  });
  console.log(`✅ Inserted ${sampleNews.length} sample news coverage rows.`);

  // ── Sample Audit Log rows ───────────────────────────────────────────────
  const sampleLogs = [
    {
      log_id: uuidv4(),
      timestamp: new Date().toISOString(),
      user_id: "USR-001",
      user_role: "administrator",
      action: "CREATE",
      table_name: "Activities",
      record_id: "ACT-SAMPLE01",
      details: JSON.stringify({ activity_name: "Youth Summit 2025", status: "Draft" }),
    },
    {
      log_id: uuidv4(),
      timestamp: new Date().toISOString(),
      user_id: "USR-001",
      user_role: "administrator",
      action: "STATUS_CHANGE",
      table_name: "Activities",
      record_id: "ACT-SAMPLE01",
      details: JSON.stringify({ from: "Draft", to: "Approved" }),
    },
  ];

  const LOG_HEADERS = [
    "log_id","timestamp","user_id","user_role","action","table_name","record_id","details",
  ];
  const logRows = sampleLogs.map((l) => LOG_HEADERS.map((h) => l[h] ?? ""));

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Audit_Log!A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: logRows },
  });
  console.log(`✅ Inserted ${sampleLogs.length} sample audit log entries.`);

  console.log("\n🎉 Sample data population complete.");
  console.log("⚠  Update activity_id values to match real records in your sheet.");
}

run().catch((err) => {
  console.error("Population failed:", err.message);
  process.exit(1);
});
