/**
 * UYNBD MIS - Google Sheets Setup Script (Standalone)
 * Run from the uynbd-mis root folder:
 *   node scripts/setup-sheets.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { google } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'googleapis'));

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

const SHEETS_AND_COLUMNS = {
  Members: ['uddami_id','full_name','phone','email','date_of_birth','gender','address','emergency_contact','photo_url','branch_id','unit_id','status','joining_date','probation_end_date','alumni_date','national_id','occupation','education','skills','notes','created_at','updated_at','created_by'],
  MemberRoles: ['id','member_id','role_title','role_type','branch_id','start_date','end_date','is_active','assigned_by','created_at'],
  MemberAttendance: ['id','member_id','event_id','status','notes','recorded_by','created_at'],
  MemberFinance: ['id','member_id','month','year','status','months_behind','last_updated'],
  MemberTransfers: ['id','member_id','from_branch','to_branch','transfer_date','reason','approved_by','created_at'],
  Branches: ['branch_id','branch_name','short_code','district','division','formed_date','status','chief_member_id','member_count','description','contact_email','contact_phone','created_at','updated_at'],
  BranchUnits: ['unit_id','branch_id','unit_name','leader_member_id','member_count','status','formed_date','created_at'],
  Events: ['event_id','event_type','event_name','hosting_date','end_date','location','hosted_by_branch','chief_host_name','chief_host_position','chief_host_phone','chief_host_email','expected_branches','photos_folder_url','report_url','remarks','status','is_attendance_mandatory','created_by','approved_by','created_at','updated_at'],
  EventAttendees: ['id','event_id','member_id','branch_id','attendance_status','notes','recorded_by','created_at'],
  Projects: ['project_id','project_name','description','branch_id','category','start_date','end_date','budget','actual_cost','status','coordinator_id','linked_event_id','report_url','impact_score','created_by','approved_by','created_at','updated_at'],
  ProjectMembers: ['id','project_id','member_id','role','joined_date','created_at'],
  FinanceContributions: ['id','member_id','branch_id','month','year','amount','payment_date','payment_method','receipt_url','status','notes','recorded_by','created_at'],
  Documents: ['doc_id','title','doc_type','linked_to_type','linked_to_id','branch_id','file_url','drive_id','is_locked','upload_date','uploaded_by','description','created_at','updated_at'],
  Sponsors: ['sponsor_id','sponsor_name','sponsor_type','amount','contact_name','contact_phone','contact_email','linked_project_id','linked_event_id','agreement_url','status','notes','created_at','updated_at'],
  Assets: ['asset_id','asset_name','category','quantity','condition','location','assigned_member_id','branch_id','purchase_date','purchase_cost','notes','created_at','updated_at'],
  AuditLogs: ['log_id','timestamp','user_id','user_email','action','module','record_id','old_value','new_value','ip_address','notes'],
  Users: ['user_id','email','password_hash','role','member_id','branch_id','is_active','last_login','created_at','created_by'],
  Applications: ['app_id','full_name','phone','email','date_of_birth','gender','address','branch_preference','motivation','skills','referral_member_id','status','reviewed_by','review_notes','submitted_at','reviewed_at'],
};

async function setup() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    console.error('\nERROR: backend\\.env file not found or missing credentials.');
    console.error('Make sure backend\\.env exists with GOOGLE_SERVICE_ACCOUNT_EMAIL filled in.\n');
    process.exit(1);
  }
  if (!SPREADSHEET_ID) {
    console.error('\nERROR: GOOGLE_SPREADSHEET_ID is missing from backend\\.env\n');
    process.exit(1);
  }

  console.log('Connecting to Google Sheets...');
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Get existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map(s => s.properties.title);
  console.log(`Connected! Found ${existing.length} existing sheet(s).\n`);

  // Create missing sheets
  const toCreate = Object.keys(SHEETS_AND_COLUMNS).filter(n => !existing.includes(n));
  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: toCreate.map(title => ({ addSheet: { properties: { title } } })) },
    });
    console.log(`Created ${toCreate.length} new sheet(s): ${toCreate.join(', ')}\n`);
  }

  // Write headers to every sheet
  for (const [sheetName, columns] of Object.entries(SHEETS_AND_COLUMNS)) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [columns] },
      });
      console.log(`OK  ${sheetName.padEnd(22)} ${columns.length} columns`);
    } catch (e) {
      console.log(`FAIL  ${sheetName}: ${e.message}`);
    }
  }

  console.log('\nSetup complete!');
  console.log('Next: node scripts/seed-sample-data.js   (optional, loads test data)');
  console.log('Or:   npm run dev                         (start the app)');
}

setup().catch(err => {
  console.error('\nFailed:', err.message);
  if (err.message.includes('invalid_grant') || err.message.includes('unauthorized')) {
    console.error('Hint: Check your GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in backend\\.env');
  }
  if (err.message.includes('not found') || err.message.includes('404')) {
    console.error('Hint: Check your GOOGLE_SPREADSHEET_ID in backend\\.env');
    console.error('Hint: Make sure you shared the spreadsheet with your service account email');
  }
  process.exit(1);
});
