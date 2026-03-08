/**
 * UYNBD MIS - Sample Data Seed Script (Standalone)
 * Run from the uynbd-mis root folder:
 *   node scripts/seed-sample-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { google } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'googleapis'));
const bcrypt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'bcryptjs'));

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// ── Helpers ───────────────────────────────────────────────────────────────────
let sheetsClient = null;
async function getSheets() {
  if (sheetsClient) return sheetsClient;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function appendRow(sheetName, rowObj) {
  const sheets = await getSheets();
  // Get headers from row 1
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = headerRes.data.values?.[0] || [];
  const row = headers.map(h => rowObj[h] !== undefined ? String(rowObj[h]) : '');
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2,4).toUpperCase()}`;
}

function subtractMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

function subtractYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

const today = new Date().toISOString().split('T')[0];
const now = new Date().toISOString();

// ── Sample Data ───────────────────────────────────────────────────────────────
const BRANCHES = [
  { branch_id: 'BR-DHK', branch_name: 'Dhaka Central',     short_code: 'DHK', district: 'Dhaka',      division: 'Dhaka' },
  { branch_id: 'BR-CTG', branch_name: 'Chittagong Branch',  short_code: 'CTG', district: 'Chittagong', division: 'Chittagong' },
  { branch_id: 'BR-SYL', branch_name: 'Sylhet Branch',      short_code: 'SYL', district: 'Sylhet',     division: 'Sylhet' },
  { branch_id: 'BR-RAJ', branch_name: 'Rajshahi Branch',    short_code: 'RAJ', district: 'Rajshahi',   division: 'Rajshahi' },
  { branch_id: 'BR-KHU', branch_name: 'Khulna Branch',      short_code: 'KHU', district: 'Khulna',     division: 'Khulna' },
];

const NAMES = [
  'Rahim Ahmed', 'Karim Hassan', 'Farhan Islam', 'Nusrat Jahan', 'Tasnim Akter',
  'Sabbir Rahman', 'Mitu Begum', 'Asif Hossain', 'Priya Das', 'Tanvir Khan',
  'Sadia Khanam', 'Rashed Ali', 'Mim Sultana', 'Imran Chowdhury', 'Lina Parvin',
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('Seeding sample data into Google Sheets...\n');

  // 1. Branches
  console.log('--- Branches ---');
  for (const b of BRANCHES) {
    await appendRow('Branches', {
      branch_id: b.branch_id,
      branch_name: b.branch_name,
      short_code: b.short_code,
      district: b.district,
      division: b.division,
      formed_date: subtractMonths(today, 18),
      status: 'active',
      chief_member_id: '',
      member_count: '0',
      description: `${b.branch_name} chapter of UYNBD`,
      contact_email: `${b.short_code.toLowerCase()}@uynbd.org`,
      contact_phone: '01700000000',
      created_at: now,
      updated_at: now,
    });
    console.log(`  OK  ${b.branch_name}`);
  }

  // 2. Members
  console.log('\n--- Members ---');
  for (let i = 0; i < NAMES.length; i++) {
    const branch = BRANCHES[i % BRANCHES.length];
    const uddami_id = `UYNBD-2024-${String(i + 1).padStart(4, '0')}`;
    const joinDate = subtractMonths(today, 6 + i);
    const probEnd = subtractMonths(today, 3 + i); // 3 months after join

    await appendRow('Members', {
      uddami_id,
      full_name: NAMES[i],
      phone: `0171${String(i).padStart(7, '0')}`,
      email: `${NAMES[i].split(' ')[0].toLowerCase()}${i}@example.com`,
      date_of_birth: subtractYears(today, 20 + (i % 8)),
      gender: i % 3 === 0 ? 'female' : 'male',
      address: `${branch.district}, Bangladesh`,
      emergency_contact: `0181${String(i).padStart(7, '0')}`,
      photo_url: '',
      branch_id: branch.branch_id,
      unit_id: '',
      status: i < 12 ? 'active' : 'probation',
      joining_date: joinDate,
      probation_end_date: probEnd,
      alumni_date: '',
      national_id: '',
      occupation: 'Student',
      education: 'BSc',
      skills: 'Leadership, Communication',
      notes: '',
      created_at: now,
      updated_at: now,
      created_by: 'seed',
    });
    console.log(`  OK  ${NAMES[i]}  (${uddami_id})`);
  }

  // 3. Finance Contributions (6 months for active members)
  console.log('\n--- Finance Contributions ---');
  for (let i = 0; i < 12; i++) {
    const uddami_id = `UYNBD-2024-${String(i + 1).padStart(4, '0')}`;
    const branch = BRANCHES[i % BRANCHES.length];
    for (let m = 1; m <= 6; m++) {
      const payDate = subtractMonths(today, 6 - m);
      const d = new Date(payDate);
      await appendRow('FinanceContributions', {
        id: genId('FIN'),
        member_id: uddami_id,
        branch_id: branch.branch_id,
        month: String(d.getMonth() + 1),
        year: String(d.getFullYear()),
        amount: '200',
        payment_date: payDate,
        payment_method: 'mobile_banking',
        receipt_url: '',
        status: 'paid',
        notes: '',
        recorded_by: 'seed',
        created_at: now,
      });
    }
    console.log(`  OK  Finance for UYNBD-2024-${String(i + 1).padStart(4, '0')} (6 months)`);
  }

  // 4. Events
  console.log('\n--- Events ---');
  const EVENTS = [
    { name: 'Monthly Central Meeting - January 2024', type: 'central_meeting', date: '2024-01-15', status: 'completed' },
    { name: 'Youth Leadership Workshop',              type: 'joint_event',     date: '2024-02-20', status: 'completed' },
    { name: 'Annual General Meeting 2024',            type: 'central_meeting', date: '2024-03-10', status: 'approved'  },
    { name: 'Community Cleanup Campaign',             type: 'campaign',        date: '2024-04-05', status: 'published' },
  ];
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    await appendRow('Events', {
      event_id: `EVT-2024-${String(i + 1).padStart(4, '0')}`,
      event_type: e.type,
      event_name: e.name,
      hosting_date: e.date,
      end_date: e.date,
      location: 'UYNBD Central Office, Dhaka',
      hosted_by_branch: 'BR-DHK',
      chief_host_name: 'Mohammed Rahman',
      chief_host_position: 'Chairman',
      chief_host_phone: '01700000001',
      chief_host_email: 'chairman@uynbd.org',
      expected_branches: BRANCHES.map(b => b.branch_id).join(','),
      photos_folder_url: '',
      report_url: '',
      remarks: '',
      status: e.status,
      is_attendance_mandatory: 'true',
      created_by: 'seed',
      approved_by: 'seed',
      created_at: now,
      updated_at: now,
    });
    console.log(`  OK  ${e.name}`);
  }

  // 5. Projects
  console.log('\n--- Projects ---');
  await appendRow('Projects', {
    project_id: 'PRJ-2024-0001',
    project_name: 'Digital Literacy for Rural Youth',
    description: 'Teaching basic computer skills to rural youth in 5 districts',
    branch_id: 'BR-DHK',
    category: 'Education',
    start_date: '2024-01-01',
    end_date: '2024-06-30',
    budget: '150000',
    actual_cost: '120000',
    status: 'ongoing',
    coordinator_id: 'UYNBD-2024-0001',
    linked_event_id: '',
    report_url: '',
    impact_score: '75',
    created_by: 'seed',
    approved_by: 'seed',
    created_at: now,
    updated_at: now,
  });
  console.log('  OK  Digital Literacy for Rural Youth');

  // 6. Admin User
  console.log('\n--- Admin User ---');
  const hash = await bcrypt.hash('Admin@123', 12);
  await appendRow('Users', {
    user_id: genId('USR'),
    email: 'admin@uynbd.org',
    password_hash: hash,
    role: 'super_admin',
    member_id: 'UYNBD-2024-0001',
    branch_id: 'BR-DHK',
    is_active: 'true',
    last_login: '',
    created_at: now,
    created_by: 'seed',
  });
  console.log('  OK  admin@uynbd.org  (role: super_admin)');

  console.log('\n====================================');
  console.log('Seed complete!');
  console.log('Login:    admin@uynbd.org');
  console.log('Password: Admin@123');
  console.log('CHANGE THIS PASSWORD AFTER FIRST LOGIN!');
  console.log('====================================\n');
  console.log('Now run:  npm run dev');
}

seed().catch(err => {
  console.error('\nSeed failed:', err.message);
  if (err.message.includes('Unable to parse range')) {
    console.error('Hint: Run setup-sheets.js first to create the sheet tabs.');
  }
  process.exit(1);
});
