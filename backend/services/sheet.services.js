/**
 * UYNBD MIS - Google Sheets Service
 * 
 * Provides generic CRUD operations on top of the Google Sheets API.
 * All modules use this service to interact with the "database."
 * 
 * ARCHITECTURE NOTE:
 * - Each sheet = a table; Row 1 = headers; Rows 2+ = data
 * - Reads: fetches all rows, converts to objects using header row
 * - Writes: appends rows or updates by finding the row index first
 * - Filtering/sorting done in-memory (acceptable up to ~5000 rows per sheet)
 */

const { getSheetsClient, SPREADSHEET_ID, COLUMNS } = require('../config/sheets.config');
const { v4: uuidv4 } = require('uuid');

// ─── Simple In-Memory Cache ───────────────────────────────────────────────────
const cache = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const getCached = (sheetName) => {
  const entry = cache[sheetName];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
};

const setCached = (sheetName, data) => {
  cache[sheetName] = { data, timestamp: Date.now() };
};

const invalidateCache = (sheetName) => {
  delete cache[sheetName];
};

// ─── Read All Rows from a Sheet ───────────────────────────────────────────────
/**
 * Reads all data rows from a sheet and returns array of objects.
 * @param {string} sheetName - Name of the sheet tab
 * @returns {Array<Object>} Array of row objects keyed by header values
 */
const readSheet = async (sheetName) => {
  try {
    // Return cached data if available
    const cached = getCached(sheetName);
    if (cached) return cached;

    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A:ZZ`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      setCached(sheetName, []);
      return [];
    }

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });

    setCached(sheetName, data);
    return data;
  } catch (error) {
    console.error(`[SheetsService] Error reading ${sheetName}:`, error.message);
    throw new Error(`Failed to read ${sheetName}: ${error.message}`);
  }
};

// ─── Find Single Row by Field Value ───────────────────────────────────────────
const findOne = async (sheetName, field, value) => {
  const rows = await readSheet(sheetName);
  return rows.find((row) => row[field] === String(value)) || null;
};

// ─── Find Multiple Rows by Field Value ────────────────────────────────────────
const findMany = async (sheetName, filters = {}) => {
  const rows = await readSheet(sheetName);
  return rows.filter((row) =>
    Object.entries(filters).every(([key, val]) => row[key] === String(val))
  );
};

// ─── Append a New Row ─────────────────────────────────────────────────────────
/**
 * Appends a new row to the sheet. Column order follows COLUMNS config.
 * @param {string} sheetName
 * @param {Object} data - Key-value object of column:value pairs
 * @returns {Object} The inserted row with auto-generated timestamps
 */
const insertRow = async (sheetName, data) => {
  try {
    const sheets = await getSheetsClient();

    // Auto-populate timestamps if not provided
    const now = new Date().toISOString();
    if (!data.created_at) data.created_at = now;
    if (COLUMNS[sheetName.toUpperCase().replace(/\s/g, '_')]?.includes('updated_at')) {
      data.updated_at = now;
    }

    // Get headers to determine column order
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!1:1`,
    });

    const headers = headerRes.data.values?.[0] || [];
    const rowValues = headers.map((h) => data[h] !== undefined ? String(data[h]) : '');

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] },
    });

    // Invalidate cache so next read gets fresh data
    invalidateCache(sheetName);

    return data;
  } catch (error) {
    console.error(`[SheetsService] Error inserting into ${sheetName}:`, error.message);
    throw new Error(`Failed to insert into ${sheetName}: ${error.message}`);
  }
};

// ─── Update an Existing Row ───────────────────────────────────────────────────
/**
 * Updates a row where idField matches idValue.
 * Finds the row index first, then updates only changed cells.
 */
const updateRow = async (sheetName, idField, idValue, updates) => {
  try {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A:ZZ`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) throw new Error('Sheet is empty');

    const headers = rows[0];
    const idColIndex = headers.indexOf(idField);
    if (idColIndex === -1) throw new Error(`Column ${idField} not found`);

    const rowIndex = rows.findIndex((row, i) => i > 0 && row[idColIndex] === String(idValue));
    if (rowIndex === -1) throw new Error(`Record with ${idField}=${idValue} not found`);

    // Merge updates into existing row
    const existingRow = [...rows[rowIndex]];
    updates.updated_at = new Date().toISOString();

    Object.entries(updates).forEach(([key, val]) => {
      const colIdx = headers.indexOf(key);
      if (colIdx !== -1) existingRow[colIdx] = String(val);
    });

    // Pad to header length
    while (existingRow.length < headers.length) existingRow.push('');

    const sheetRowNumber = rowIndex + 1; // 1-indexed, headers at row 1 so data at row 2+
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [existingRow] },
    });

    // Invalidate cache so next read gets fresh data
    invalidateCache(sheetName);

    const updatedObj = {};
    headers.forEach((h, i) => { updatedObj[h] = existingRow[i] || ''; });
    return updatedObj;
  } catch (error) {
    console.error(`[SheetsService] Error updating ${sheetName}:`, error.message);
    throw new Error(`Failed to update ${sheetName}: ${error.message}`);
  }
};

// ─── Delete a Row (Mark as Deleted, Soft Delete) ──────────────────────────────
/**
 * Soft deletes by setting status to 'deleted' and adding deleted_at timestamp.
 * Hard delete is only available for Super Admin via hardDeleteRow.
 */
const softDeleteRow = async (sheetName, idField, idValue) => {
  return updateRow(sheetName, idField, idValue, {
    status: 'deleted',
    deleted_at: new Date().toISOString(),
  });
};

// Hard delete - removes the actual row (Super Admin only)
const hardDeleteRow = async (sheetName, idField, idValue) => {
  try {
    const sheets = await getSheetsClient();

    // Get sheet metadata to find sheetId
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID() });
    const sheet = meta.data.sheets.find(
      (s) => s.properties.title === sheetName
    );
    if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
    const sheetId = sheet.properties.sheetId;

    // Find row index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A:ZZ`,
    });
    const rows = response.data.values;
    const headers = rows[0];
    const idColIndex = headers.indexOf(idField);
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[idColIndex] === String(idValue));
    if (rowIndex === -1) throw new Error('Record not found');

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID(),
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        }],
      },
    });

    // Invalidate cache
    invalidateCache(sheetName);

    return { deleted: true };
  } catch (error) {
    console.error(`[SheetsService] Hard delete error:`, error.message);
    throw new Error(`Failed to hard delete: ${error.message}`);
  }
};

// ─── Generate Sequential ID ───────────────────────────────────────────────────
const generateUddamiId = async (year) => {
  const members = await readSheet('Members');
  const yearMembers = members.filter(m => m.uddami_id?.includes(String(year)));
  const seq = String(yearMembers.length + 1).padStart(4, '0');
  return `UYNBD-${year}-${seq}`;
};

const generateId = (prefix) => {
  return `${prefix}-${uuidv4().split('-')[0].toUpperCase()}`;
};

module.exports = {
  readSheet,
  findOne,
  findMany,
  insertRow,
  updateRow,
  softDeleteRow,
  hardDeleteRow,
  generateUddamiId,
  generateId,
};
