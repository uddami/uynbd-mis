/**
 * UYNBD MIS - Google Sheets Configuration
 * 
 * This file defines all sheet names, column mappings, and the Google Sheets
 * API client initialization. Each sheet acts as a database table.
 * 
 * SHEET STRUCTURE:
 * - Row 1: Headers (column names)
 * - Row 2+: Data rows
 * 
 * ID CONVENTIONS:
 * - Members: UYNBD-{YEAR}-{4-digit-seq} e.g. UYNBD-2024-0001
 * - Branches: BR-{3-letter-code} e.g. BR-DHK
 * - Events: EVT-{YEAR}-{4-digit-seq}
 * - Projects: PRJ-{YEAR}-{4-digit-seq}
 */

const { google } = require('googleapis');

// ─── Sheet Names ──────────────────────────────────────────────────────────────
const SHEETS = {
  MEMBERS: 'Members',
  MEMBER_ROLES: 'MemberRoles',
  MEMBER_ATTENDANCE: 'MemberAttendance',
  MEMBER_FINANCE: 'MemberFinance',
  MEMBER_TRANSFERS: 'MemberTransfers',
  BRANCHES: 'Branches',
  BRANCH_UNITS: 'BranchUnits',
  EVENTS: 'Events',
  EVENT_ATTENDEES: 'EventAttendees',
  PROJECTS: 'Projects',
  PROJECT_MEMBERS: 'ProjectMembers',
  FINANCE_CONTRIBUTIONS: 'FinanceContributions',
  DOCUMENTS: 'Documents',
  SPONSORS: 'Sponsors',
  ASSETS: 'Assets',
  AUDIT_LOGS: 'AuditLogs',
  USERS: 'Users',
  APPLICATIONS: 'Applications',
};

// ─── Column Definitions ───────────────────────────────────────────────────────
const COLUMNS = {
  MEMBERS: [
    'uddami_id', 'full_name', 'phone', 'email', 'date_of_birth', 'gender',
    'address', 'emergency_contact', 'photo_url', 'branch_id', 'unit_id',
    'status', 'joining_date', 'probation_end_date', 'alumni_date',
    'national_id', 'occupation', 'education', 'skills', 'notes',
    'created_at', 'updated_at', 'created_by'
  ],
  MEMBER_ROLES: [
    'id', 'member_id', 'role_title', 'role_type', 'branch_id',
    'start_date', 'end_date', 'is_active', 'assigned_by', 'created_at'
  ],
  MEMBER_ATTENDANCE: [
    'id', 'member_id', 'event_id', 'status', 'notes', 'recorded_by', 'created_at'
  ],
  MEMBER_TRANSFERS: [
    'id', 'member_id', 'from_branch', 'to_branch', 'transfer_date',
    'reason', 'approved_by', 'created_at'
  ],
  BRANCHES: [
    'branch_id', 'branch_name', 'short_code', 'district', 'division',
    'formed_date', 'status', 'chief_member_id', 'member_count',
    'description', 'contact_email', 'contact_phone', 'created_at', 'updated_at'
  ],
  BRANCH_UNITS: [
    'unit_id', 'branch_id', 'unit_name', 'leader_member_id',
    'member_count', 'status', 'formed_date', 'created_at'
  ],
  EVENTS: [
    'event_id', 'event_type', 'event_name', 'hosting_date', 'end_date',
    'location', 'hosted_by_branch', 'chief_host_name', 'chief_host_position',
    'chief_host_phone', 'chief_host_email', 'expected_branches',
    'photos_folder_url', 'report_url', 'remarks', 'status',
    'is_attendance_mandatory', 'created_by', 'approved_by',
    'created_at', 'updated_at'
  ],
  EVENT_ATTENDEES: [
    'id', 'event_id', 'member_id', 'branch_id', 'attendance_status',
    'notes', 'recorded_by', 'created_at'
  ],
  PROJECTS: [
    'project_id', 'project_name', 'description', 'branch_id', 'category',
    'start_date', 'end_date', 'budget', 'actual_cost', 'status',
    'coordinator_id', 'linked_event_id', 'report_url', 'impact_score',
    'created_by', 'approved_by', 'created_at', 'updated_at'
  ],
  PROJECT_MEMBERS: [
    'id', 'project_id', 'member_id', 'role', 'joined_date', 'created_at'
  ],
  FINANCE_CONTRIBUTIONS: [
    'id', 'member_id', 'branch_id', 'month', 'year', 'amount',
    'payment_date', 'payment_method', 'receipt_url', 'status',
    'notes', 'recorded_by', 'created_at'
  ],
  DOCUMENTS: [
    'doc_id', 'title', 'doc_type', 'linked_to_type', 'linked_to_id',
    'branch_id', 'file_url', 'drive_id', 'is_locked', 'upload_date',
    'uploaded_by', 'description', 'created_at', 'updated_at'
  ],
  SPONSORS: [
    'sponsor_id', 'sponsor_name', 'sponsor_type', 'amount', 'contact_name',
    'contact_phone', 'contact_email', 'linked_project_id', 'linked_event_id',
    'agreement_url', 'status', 'notes', 'created_at', 'updated_at'
  ],
  ASSETS: [
    'asset_id', 'asset_name', 'category', 'quantity', 'condition',
    'location', 'assigned_member_id', 'branch_id', 'purchase_date',
    'purchase_cost', 'notes', 'created_at', 'updated_at'
  ],
  AUDIT_LOGS: [
    'log_id', 'timestamp', 'user_id', 'user_email', 'action',
    'module', 'record_id', 'old_value', 'new_value', 'ip_address', 'notes'
  ],
  USERS: [
    'user_id', 'email', 'password_hash', 'role', 'member_id',
    'branch_id', 'is_active', 'last_login', 'created_at', 'created_by'
  ],
  APPLICATIONS: [
    'app_id', 'full_name', 'phone', 'email', 'date_of_birth', 'gender',
    'address', 'branch_preference', 'motivation', 'skills',
    'referral_member_id', 'status', 'reviewed_by', 'review_notes',
    'submitted_at', 'reviewed_at'
  ],
};

// ─── Initialize Google Auth ───────────────────────────────────────────────────
let sheetsClient = null;

const getGoogleAuth = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '';

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
};

const getSheetsClient = async () => {
  if (sheetsClient) return sheetsClient;
  const auth = getGoogleAuth();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
};

const SPREADSHEET_ID = () => process.env.GOOGLE_SPREADSHEET_ID;

module.exports = {
  SHEETS,
  COLUMNS,
  getSheetsClient,
  SPREADSHEET_ID,
};
