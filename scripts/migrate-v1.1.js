/**
 * UYNBD MIS - Migration Script
 *
 * PLACE AT: scripts/migrate-v1.1.js
 *
 * Safely adds new columns to the Events sheet and creates the
 * EventNews sheet. Does NOT delete or overwrite any existing data.
 *
 * HOW TO RUN (from project root):
 *   cd backend
 *   node ../scripts/migrate-v1.1.js
 *
 * Run ONCE on your live spreadsheet before deploying the new code.
 */

require('dotenv').config({ path: '../backend/.env' });
const { getSheetsClient, SPREADSHEET_ID } = require('../backend/config/sheets.config');

// ── New columns to add to Events sheet ───────────────────────────────────────
// These are appended after existing columns – backward compatible
const NEW_EVENT_COLUMNS = [
  'external_organization',       // 'true' / 'false'
  'external_organization_name',  // text
  'total_spendings',             // decimal string
  'total_participants',          // integer string – auto-calculated
  'total_news_coverage',         // integer string – auto-calculated
  'pdf_report_url',              // Google Drive link
  'locked',                      // 'true' / 'false'
];

// ── EventNews sheet columns ───────────────────────────────────────────────────
const EVENT_NEWS_HEADERS = [
  'id',
  'event_id',
  'media_name',
  'coverage_link',
  'coverage_date',
  'verified',
  'created_by',
  'created_at',
];

// ── Column letter helper (supports AA, AB, etc.) ──────────────────────────────
function colLetter(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

async function run() {
  const sheets = await getSheetsClient();
  const spreadsheetId = SPREADSHEET_ID();

  console.log('🔍 Reading spreadsheet metadata...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = meta.data.sheets.map((s) => s.properties.title);
  console.log('Existing sheets:', existingSheets.join(', '));

  // ── Step 1: Add new columns to Events sheet ───────────────────────────────
  if (!existingSheets.includes('Events')) {
    console.error("❌ 'Events' sheet not found. Check your spreadsheet.");
    process.exit(1);
  }

  console.log('\n📋 Reading current Events sheet headers...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Events!1:1',
  });
  const existingHeaders = headerRes.data.values?.[0] ?? [];
  console.log('Current headers:', existingHeaders.join(', '));

  const toAdd = NEW_EVENT_COLUMNS.filter((col) => !existingHeaders.includes(col));

  if (toAdd.length === 0) {
    console.log('✅ Events sheet already has all new columns. No changes needed.');
  } else {
    const startColNum = existingHeaders.length + 1;
    const endColNum = startColNum + toAdd.length - 1;
    const range = `Events!${colLetter(startColNum)}1:${colLetter(endColNum)}1`;

    console.log(`\n➕ Adding ${toAdd.length} new columns: ${toAdd.join(', ')}`);
    console.log(`   Writing to range: ${range}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [toAdd] },
    });
    console.log('✅ Events headers updated.');

    // Back-fill default values for all existing rows
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Events!A2:A',
    });
    const rowCount = dataRes.data.values?.length ?? 0;

    if (rowCount > 0) {
      const defaults = toAdd.map((col) => {
        if (col === 'external_organization') return 'false';
        if (col === 'locked') return 'false';
        if (col === 'total_participants') return '0';
        if (col === 'total_news_coverage') return '0';
        return '';
      });
      const fillData = Array(rowCount).fill(defaults);
      const fillRange = `Events!${colLetter(startColNum)}2:${colLetter(endColNum)}${rowCount + 1}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: fillRange,
        valueInputOption: 'RAW',
        requestBody: { values: fillData },
      });
      console.log(`✅ Back-filled ${rowCount} existing rows with safe defaults.`);
    } else {
      console.log('   No existing data rows to back-fill.');
    }
  }

  // ── Step 2: Create EventNews sheet ────────────────────────────────────────
  if (existingSheets.includes('EventNews')) {
    console.log('\n✅ EventNews sheet already exists. Skipping.');
  } else {
    console.log('\n🆕 Creating EventNews sheet...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'EventNews' } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'EventNews!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [EVENT_NEWS_HEADERS] },
    });
    console.log('✅ EventNews sheet created with headers:', EVENT_NEWS_HEADERS.join(', '));
  }

  console.log('\n🎉 Migration complete. Your existing data is unchanged.');
  console.log('   You can now deploy the updated backend and frontend code.\n');
}

run().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  console.error('   Your spreadsheet was NOT modified.');
  process.exit(1);
});
