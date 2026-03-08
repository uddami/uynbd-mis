# UYNBD MIS — Uddami Youth Network Bangladesh
## Management Information System v1.0.0

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- Google Cloud project with Sheets API enabled
- A Google Spreadsheet (note its ID from the URL)

### 2. Google Sheets Setup
1. Create a Service Account in Google Cloud Console
2. Download the JSON key file
3. Share your spreadsheet with the service account email
4. Copy `backend/.env.example` to `backend/.env` and fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SPREADSHEET_ID`
   - `JWT_SECRET` (generate a strong random string)

### 3. Initialize Sheets
```bash
cd uynbd-mis
node scripts/setup-sheets.js     # Creates all sheet tabs with headers
node scripts/seed-sample-data.js # Optional: loads sample data
```

### 4. Run the Application
```bash
npm run install:all   # Install all dependencies
npm run dev           # Runs backend (port 5000) + frontend (port 3000)
```

### 5. First Login
Default credentials (from seed script): `admin@uynbd.org` / `Admin@123`  
**Change this password immediately after first login!**

---

## Architecture

```
uynbd-mis/
├── backend/
│   ├── config/
│   │   └── sheets.config.js      # Google Sheets schema & client
│   ├── controllers/
│   │   ├── auth.controller.js    # Login, profile, password
│   │   ├── members.controller.js # UMLT - member lifecycle
│   │   ├── branches.controller.js# UBMS - branch management
│   │   ├── events.controller.js  # Events & attendance
│   │   ├── projects.controller.js# UTPMS - project lifecycle
│   │   ├── finance.controller.js # Contributions & auto-status
│   │   ├── documents.controller.js# UDMS - document management
│   │   ├── sponsors.controller.js# Sponsors & assets/logistics
│   │   ├── analytics.controller.js# UOA - branch scores & charts
│   │   └── users.controller.js   # System user management
│   ├── middleware/
│   │   └── auth.middleware.js    # JWT + RBAC
│   ├── services/
│   │   ├── sheets.service.js     # Generic CRUD for Google Sheets
│   │   └── audit.service.js      # Immutable audit logging
│   └── server.js                 # Express app & routes
│
├── frontend/
│   └── src/
│       ├── components/common/
│       │   ├── Layout.jsx        # Sidebar + top bar
│       │   └── UI.jsx            # Modal, badges, stats, etc.
│       ├── context/
│       │   └── AuthContext.jsx   # Auth state + permission checks
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx # Main dashboard with charts
│       │   ├── MembersPage.jsx   # Member list + create
│       │   ├── MemberProfilePage.jsx # Full member profile
│       │   ├── BranchesPage.jsx
│       │   ├── EventsPage.jsx    # Event lifecycle management
│       │   ├── ProjectsPage.jsx  # Project management
│       │   ├── FinancePage.jsx   # Payment tracking + charts
│       │   ├── DocumentsPage.jsx
│       │   ├── SponsorsPage.jsx  # Sponsors + assets/logistics
│       │   ├── AnalyticsPage.jsx # Branch scoring + trends
│       │   ├── AuditPage.jsx     # Immutable audit log viewer
│       │   └── UsersPage.jsx     # System user management
│       └── utils/
│           └── api.js            # Axios client for all API calls
│
└── scripts/
    ├── setup-sheets.js           # One-time sheet initialization
    └── seed-sample-data.js       # Sample data population
```

---

## Roles & Permissions

| Role | Members | Finance | Events | Projects | Analytics | Audit | Users |
|------|---------|---------|--------|----------|-----------|-------|-------|
| Super Admin | Full | Full | Full | Full | Full | Full | Full |
| Chairman | Read | Read | Read | Read | Read | Read | — |
| MD | Read | Read | Read | Read | Read | — | — |
| Administrator | Read+Write | Read+Write | Read+Write+Approve | Full | Read | Read | — |
| Finance Director | — | Read+Write | — | — | — | — | — |
| Logistics Director | — | — | — | — | — | — | — |
| Branch Chief | Branch only | — | Branch only | Branch only | — | — | — |
| Event Chief | — | — | Assigned only | — | — | — | — |

---

## Key Business Rules

- **Minimum age**: 13 years to join
- **Probation**: 3 months before becoming Active (auto-promoted by cron)
- **Finance status auto-calculation**:
  - 1-2 months behind → Late
  - 3 months behind → Inactive (member status updated)
  - 4+ months behind → Suspension Review
- **Branch**: Cannot dissolve, only suspend. Min 5 members to form.
- **Roles**: Max 2 active roles per member (1 central + 1 branch allowed)
- **Branch Score** = Growth(30%) + Events(25%) + Attendance(20%) + Finance(15%) + Projects(10%)
- **Destructive actions**: Require `X-Destructive-Confirm: CONFIRMED` header
- **Audit logs**: Immutable — no edit or delete operations permitted

---

## Deployment

### Vercel (Frontend)
```
Build Command: cd frontend && npm run build
Output: frontend/dist
```

### Vercel / Railway (Backend)
Set all environment variables from `.env.example`

### Scheduled Jobs (Recommended)
Set up daily cron to call these endpoints:
- `GET /api/v1/members/probation-check` — auto-promote probation members
- `POST /api/v1/finance/run-status-update` — auto-update member finance status

---

## Security Notes

1. Never commit `.env` files
2. Rotate `JWT_SECRET` regularly
3. Use HTTPS in production
4. Restrict Google Service Account to only the specific spreadsheet
5. Change default admin password immediately after setup
