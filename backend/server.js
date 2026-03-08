/**
 * UYNBD MIS - Express.js Server
 * 
 * Main application entry point. Configures middleware, routes, and starts server.
 * 
 * API Base: /api/v1
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// ─── Body & Logging Middleware ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ─── Import Middleware ─────────────────────────────────────────────────────────
const { authenticate, authorize, requireDestructiveConfirmation } = require('./middleware/auth.middleware');

// ─── Import Controllers ────────────────────────────────────────────────────────
const authController = require('./controllers/auth.controller');
const membersController = require('./controllers/members.controller');
const financeController = require('./controllers/finance.controller');
const eventsController = require('./controllers/events.controller');
const analyticsController = require('./controllers/analytics.controller');

// Lazy-load remaining controllers
const getBranchesController = () => require('./controllers/branches.controller');
const getProjectsController = () => require('./controllers/projects.controller');
const getDocumentsController = () => require('./controllers/documents.controller');
const getSponsorsController = () => require('./controllers/sponsors.controller');
const getUsersController = () => require('./controllers/users.controller');

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/v1/auth/login', authController.login);
app.get('/api/v1/auth/profile', authenticate, authController.getProfile);
app.put('/api/v1/auth/change-password', authenticate, authController.changePassword);
app.post('/api/v1/auth/bootstrap', authController.bootstrapAdmin); // One-time only

// ─── Member Routes (UMLT) ──────────────────────────────────────────────────────
app.get('/api/v1/members', authenticate, authorize('members', 'read'), membersController.getMembers);
app.get('/api/v1/members/stats', authenticate, authorize('members', 'read'), membersController.getMemberStats);
app.get('/api/v1/members/probation-check', authenticate, authorize('members', 'write'), membersController.runProbationCheck);
app.get('/api/v1/members/:uddami_id', authenticate, authorize('members', 'read'), membersController.getMember);
app.post('/api/v1/members', authenticate, authorize('members', 'write'), membersController.createMember);
app.put('/api/v1/members/:uddami_id', authenticate, authorize('members', 'write'), membersController.updateMember);
app.post('/api/v1/members/:uddami_id/promote', authenticate, authorize('members', 'write'), membersController.promoteMember);
app.post('/api/v1/members/:uddami_id/transfer', authenticate, authorize('members', 'write'), membersController.transferMember);
app.post('/api/v1/members/:uddami_id/roles', authenticate, authorize('members', 'write'), membersController.assignRole);
app.delete('/api/v1/members/:uddami_id', authenticate, authorize('members', 'delete'), requireDestructiveConfirmation, membersController.deleteMember);

// ─── Branch Routes (UBMS) ──────────────────────────────────────────────────────
app.get('/api/v1/branches', authenticate, authorize('branches', 'read'), (req, res) => {
  getBranchesController().getBranches(req, res);
});
app.get('/api/v1/branches/stats', authenticate, authorize('branches', 'read'), (req, res) => {
  getBranchesController().getBranchStats(req, res);
});
app.get('/api/v1/branches/:branch_id', authenticate, authorize('branches', 'read'), (req, res) => {
  getBranchesController().getBranch(req, res);
});
app.post('/api/v1/branches', authenticate, authorize('branches', 'write'), (req, res) => {
  getBranchesController().createBranch(req, res);
});
app.put('/api/v1/branches/:branch_id', authenticate, authorize('branches', 'write'), (req, res) => {
  getBranchesController().updateBranch(req, res);
});

// ─── Event Routes ──────────────────────────────────────────────────────────────
app.get('/api/v1/events', authenticate, authorize('events', 'read'), eventsController.getEvents);
app.get('/api/v1/events/stats', authenticate, authorize('events', 'read'), eventsController.getEventStats);
app.get('/api/v1/events/:event_id', authenticate, authorize('events', 'read'), eventsController.getEvent);
app.post('/api/v1/events', authenticate, authorize('events', 'write'), eventsController.createEvent);
app.put('/api/v1/events/:event_id', authenticate, authorize('events', 'write'), eventsController.updateEvent);
app.post('/api/v1/events/:event_id/advance-status', authenticate, authorize('events', 'write'), eventsController.advanceEventStatus);
app.post('/api/v1/events/:event_id/attendance', authenticate, authorize('events', 'write'), eventsController.recordAttendance);

// ─── Project Routes (UTPMS) ───────────────────────────────────────────────────
app.get('/api/v1/projects', authenticate, authorize('projects', 'read'), (req, res) => {
  getProjectsController().getProjects(req, res);
});
app.get('/api/v1/projects/:project_id', authenticate, authorize('projects', 'read'), (req, res) => {
  getProjectsController().getProject(req, res);
});
app.post('/api/v1/projects', authenticate, authorize('projects', 'write'), (req, res) => {
  getProjectsController().createProject(req, res);
});
app.put('/api/v1/projects/:project_id', authenticate, authorize('projects', 'write'), (req, res) => {
  getProjectsController().updateProject(req, res);
});
app.post('/api/v1/projects/:project_id/advance-status', authenticate, authorize('projects', 'write'), (req, res) => {
  getProjectsController().advanceProjectStatus(req, res);
});

// ─── Finance Routes ────────────────────────────────────────────────────────────
app.get('/api/v1/finance', authenticate, authorize('finance', 'read'), financeController.getFinanceRecords);
app.get('/api/v1/finance/dashboard', authenticate, authorize('finance', 'read'), financeController.getFinanceDashboard);
app.get('/api/v1/finance/members/:uddami_id/status', authenticate, authorize('finance', 'read'), financeController.getMemberFinanceStatus);
app.post('/api/v1/finance', authenticate, authorize('finance', 'write'), financeController.recordPayment);
app.post('/api/v1/finance/run-status-update', authenticate, authorize('finance', 'write'), financeController.runFinanceStatusUpdate);

// ─── Documents Routes (UDMS) ───────────────────────────────────────────────────
app.get('/api/v1/documents', authenticate, authorize('documents', 'read'), (req, res) => {
  getDocumentsController().getDocuments(req, res);
});
app.post('/api/v1/documents', authenticate, authorize('documents', 'write'), (req, res) => {
  getDocumentsController().createDocument(req, res);
});
app.put('/api/v1/documents/:doc_id', authenticate, authorize('documents', 'write'), (req, res) => {
  getDocumentsController().updateDocument(req, res);
});
app.delete('/api/v1/documents/:doc_id', authenticate, authorize('documents', 'delete'), requireDestructiveConfirmation, (req, res) => {
  getDocumentsController().deleteDocument(req, res);
});

// ─── Sponsors & Logistics Routes ───────────────────────────────────────────────
app.get('/api/v1/sponsors', authenticate, authorize('sponsors', 'read'), (req, res) => {
  getSponsorsController().getSponsors(req, res);
});
app.post('/api/v1/sponsors', authenticate, authorize('sponsors', 'write'), (req, res) => {
  getSponsorsController().createSponsor(req, res);
});
app.get('/api/v1/assets', authenticate, authorize('logistics', 'read'), (req, res) => {
  getSponsorsController().getAssets(req, res);
});
app.post('/api/v1/assets', authenticate, authorize('logistics', 'write'), (req, res) => {
  getSponsorsController().createAsset(req, res);
});

// ─── Analytics Routes (UOA) ────────────────────────────────────────────────────
app.get('/api/v1/analytics/dashboard', authenticate, authorize('analytics', 'read'), analyticsController.getAnalyticsDashboard);
app.get('/api/v1/analytics/branches/:branch_id', authenticate, authorize('analytics', 'read'), analyticsController.getBranchAnalytics);

// ─── Audit Log Routes ──────────────────────────────────────────────────────────
app.get('/api/v1/audit-logs', authenticate, authorize('audit', 'read'), analyticsController.getAuditLogs);

// ─── User Management Routes (Super Admin only) ─────────────────────────────────
app.get('/api/v1/users', authenticate, authorize('users', 'read'), (req, res) => {
  getUsersController().getUsers(req, res);
});
app.post('/api/v1/users', authenticate, authorize('users', 'write'), (req, res) => {
  getUsersController().createUser(req, res);
});
app.put('/api/v1/users/:user_id', authenticate, authorize('users', 'write'), (req, res) => {
  getUsersController().updateUser(req, res);
});
app.delete('/api/v1/users/:user_id', authenticate, authorize('users', 'delete'), requireDestructiveConfirmation, (req, res) => {
  getUsersController().deleteUser(req, res);
});

// ─── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║     UYNBD MIS Server - v1.0.0               ║
  ║     Running on http://localhost:${PORT}        ║
  ║     Environment: ${(process.env.NODE_ENV || 'development').padEnd(14)}        ║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
