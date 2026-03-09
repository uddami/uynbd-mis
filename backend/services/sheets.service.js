/**
 * sheetsService.js
 * ─────────────────
 * Central helper for all Google Sheets read/write operations.
 * Used by every route handler. Handles header→column index mapping
 * so column order changes never break the app.
 */

const { google } = require("googleapis");
const path = require("path");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../../credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

/** Get authenticated sheets client */
async function getClient() {
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

/**
 * Read all rows from a sheet as an array of objects keyed by header.
 * @param {string} sheetName
 */
async function readSheet(sheetName) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  const [headers, ...rows] = res.data.values ?? [[]];
  if (!headers) return [];
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
  );
}

/**
 * Append a new row to a sheet.
 * @param {string} sheetName
 * @param {object} data  – key/value pairs matching header names
 */
async function appendRow(sheetName, data) {
  const sheets = await getClient();
  // Read headers to enforce correct column order
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = headerRes.data.values?.[0] ?? [];
  const row = headers.map((h) => data[h] ?? "");
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

/**
 * Update a specific row in a sheet by matching a primary key column.
 * @param {string} sheetName
 * @param {string} pkColumn  – e.g. "activity_id"
 * @param {string} pkValue
 * @param {object} updates   – partial object of fields to update
 */
async function updateRow(sheetName, pkColumn, pkValue, updates) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  const [headers, ...rows] = res.data.values ?? [[]];
  const pkIdx = headers.indexOf(pkColumn);
  if (pkIdx === -1) throw new Error(`Column '${pkColumn}' not found in ${sheetName}`);

  const rowIdx = rows.findIndex((r) => r[pkIdx] === pkValue);
  if (rowIdx === -1) throw new Error(`Record '${pkValue}' not found in ${sheetName}`);

  // Merge updates into existing row
  const existing = Object.fromEntries(headers.map((h, i) => [h, rows[rowIdx][i] ?? ""]));
  const merged = { ...existing, ...updates };
  const newRow = headers.map((h) => merged[h] ?? "");

  const sheetRowNum = rowIdx + 2; // +1 for header, +1 for 1-indexed
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${sheetRowNum}`,
    valueInputOption: "RAW",
    requestBody: { values: [newRow] },
  });
}

/**
 * Find a single row by primary key.
 */
async function findRow(sheetName, pkColumn, pkValue) {
  const rows = await readSheet(sheetName);
  return rows.find((r) => r[pkColumn] === pkValue) ?? null;
}

/**
 * Count rows matching a filter.
 * @param {string} sheetName
 * @param {object} filter – e.g. { activity_id: "A001", attendance_status: "Attended" }
 */
async function countRows(sheetName, filter) {
  const rows = await readSheet(sheetName);
  return rows.filter((r) =>
    Object.entries(filter).every(([k, v]) => r[k] === v)
  ).length;
}

module.exports = { readSheet, appendRow, updateRow, findRow, countRows };
