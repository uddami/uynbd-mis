/**
 * UYNBD MIS – Database Migration Script
 * ======================================
 * Safe migration for Google Sheets backend.
 * Adds new columns to Activities sheet and creates Activity_News sheet.
 *
 * HOW TO RUN:
 *   node scripts/migrate-sheets.js
 *
 * SAFETY: Only adds new columns/sheets. Never deletes existing data.
 */

const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

// ── Auth ─────────────────────────────────────────────────────────────────────
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// ── New columns to add to Activities sheet ───────────────────────────────────
// Appended after existing columns – backward compatible
const NEW_ACTIVITY_COLUMNS = [
  "external_organization",       // BOOLEAN → "TRUE"/"FALSE"
  "external_organization_name",  // TEXT
  "total_spendings",             // DECIMAL → number string
  "total_participants",          // INTEGER → auto-calculated, read-only
  "total_news_coverage",         // INTEGER → auto-calculated, read-only
  "news_links",                  // JSON string array
  "pdf_report_url",              // TEXT – Google Drive link
  "locked",                      // BOOLEAN – locked after Completed
];

// ── Activity_News sheet columns ───────────────────────────────────────────────
const ACTIVITY_NEWS_HEADERS = [
  "coverage_id",
  "activity_id",
  "media_name",
  "coverage_link",
  "coverage_date",
  "verified",
  "created_at",
  "created_by",
];

async function run() {
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  console.log("🔍 Reading spreadsheet metadata...");
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = meta.data.sheets.map((s) => s.properties.title);
  console.log("Existing sheets:", existingSheets);

  // ── Step 1: Update Activities sheet headers ─────────────────────────────
  if (!existingSheets.includes("Activities")) {
    console.error("❌ 'Activities' sheet not found. Aborting.");
    process.exit(1);
  }

  console.log("\n📋 Reading current Activities headers...");
  const headerRow = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Activities!1:1",
  });
  const existingHeaders = headerRow.data.values?.[0] ?? [];
  console.log("Current headers:", existingHeaders);

  const toAdd = NEW_ACTIVITY_COLUMNS.filter((col) => !existingHeaders.includes(col));
  if (toAdd.length === 0) {
    console.log("✅ Activities sheet already has all new columns. Skipping.");
  } else {
    const startCol = existingHeaders.length + 1;
    const endCol = startCol + toAdd.length - 1;
    const colLetter = (n) => {
      let s = "";
      while (n > 0) {
        n--;
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26);
      }
      return s;
    };
    const range = `Activities!${colLetter(startCol)}1:${colLetter(endCol)}1`;
    console.log(`\n➕ Adding ${toAdd.length} new columns at range ${range}:`, toAdd);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [toAdd] },
    });
    console.log("✅ Activities headers updated.");

    // Back-fill default values for existing rows
    console.log("\n⚙️  Back-filling default values for existing rows...");
    const allData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Activities!A2:A",
    });
    const rowCount = allData.data.values?.length ?? 0;
    if (rowCount > 0) {
      const defaults = toAdd.map((col) => {
        if (col === "external_organization") return "FALSE";
        if (col === "locked") return "FALSE";
        if (col === "total_news_coverage") return "0";
        if (col === "total_participants") return "0";
        return "";
      });
      const fillData = Array(rowCount).fill(defaults);
      const fillRange = `Activities!${colLetter(startCol)}2:${colLetter(endCol)}${rowCount + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: fillRange,
        valueInputOption: "RAW",
        requestBody: { values: fillData },
      });
      console.log(`✅ Back-filled ${rowCount} existing rows with defaults.`);
    }
  }

  // ── Step 2: Create Activity_News sheet ──────────────────────────────────
  if (existingSheets.includes("Activity_News")) {
    console.log("\n✅ Activity_News sheet already exists. Skipping creation.");
  } else {
    console.log("\n🆕 Creating Activity_News sheet...");
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Activity_News" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Activity_News!A1",
      valueInputOption: "RAW",
      requestBody: { values: [ACTIVITY_NEWS_HEADERS] },
    });
    console.log("✅ Activity_News sheet created with headers.");
  }

  // ── Step 3: Create Audit_Log sheet (if missing) ─────────────────────────
  if (!existingSheets.includes("Audit_Log")) {
    console.log("\n🆕 Creating Audit_Log sheet...");
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Audit_Log" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Audit_Log!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          ["log_id", "timestamp", "user_id", "user_role", "action", "table_name", "record_id", "details"],
        ],
      },
    });
    console.log("✅ Audit_Log sheet created.");
  }

  console.log("\n🎉 Migration complete. All changes are backward compatible.");
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
