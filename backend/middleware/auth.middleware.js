/**
 * UYNBD MIS - Authentication & Authorization Middleware (Updated)
 *
 * REPLACES: backend/middleware/auth.middleware.js
 *
 * CHANGES FROM ORIGINAL:
 * - Added 'project_chief' role
 * - Expanded events.write to include branch_chief, event_chief, project_chief
 * - Expanded projects.write to include branch_chief, project_chief
 * - All original logic preserved exactly
 *
 * JWT-based authentication with role-based access control (RBAC).
 *
 * ROLES (in order of power):
 * 1. super_admin         - Full access
 * 2. chairman            - Read-only analytics, cannot delete
 * 3. md                  - Read-only
 * 4. administrator       - Read & entry, approve events/projects
 * 5. finance_director    - Read & entry on finance module only
 * 6. logistics_director  - Read & entry on logistics only
 * 7. branch_chief        - Read + create activities for their branch
 * 8. event_chief         - Read + create events
 * 9. project_chief       - Read + create projects (NEW)
 */

const jwt = require('jsonwebtoken');
const { findOne } = require('../services/sheets.service');

// ─── Role Constants ────────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CHAIRMAN: 'chairman',
  MD: 'md',
  ADMINISTRATOR: 'administrator',
  FINANCE_DIRECTOR: 'finance_director',
  LOGISTICS_DIRECTOR: 'logistics_director',
  BRANCH_CHIEF: 'branch_chief',
  EVENT_CHIEF: 'event_chief',
  PROJECT_CHIEF: 'project_chief', // NEW
};

// ─── Module Permissions ────────────────────────────────────────────────────────
const MODULE_PERMISSIONS = {
  members: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
    write: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  branches: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
    write: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  events: {
    // READ: all roles with system access
    read: [
      'super_admin', 'chairman', 'md', 'administrator',
      'branch_chief', 'event_chief', 'project_chief',
    ],
    // WRITE: expanded – branch_chief, event_chief, project_chief can now create
    write: [
      'super_admin', 'administrator',
      'branch_chief', 'event_chief', 'project_chief',
    ],
    // APPROVE: administrators only
    approve: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  projects: {
    read: [
      'super_admin', 'chairman', 'md', 'administrator',
      'branch_chief', 'project_chief',
    ],
    // WRITE: expanded – branch_chief, project_chief can now create
    write: [
      'super_admin', 'administrator',
      'branch_chief', 'project_chief',
    ],
    approve: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  finance: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'finance_director'],
    write: ['super_admin', 'administrator', 'finance_director'],
    delete: ['super_admin'],
  },
  documents: {
    read: [
      'super_admin', 'chairman', 'md', 'administrator',
      'branch_chief',
    ],
    write: ['super_admin', 'administrator'],
    delete: ['super_admin'],
    lock: ['super_admin', 'administrator'],
  },
  sponsors: {
    read: ['super_admin', 'chairman', 'md', 'administrator'],
    write: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  logistics: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'logistics_director'],
    write: ['super_admin', 'administrator', 'logistics_director'],
    delete: ['super_admin'],
  },
  analytics: {
    read: ['super_admin', 'chairman', 'md', 'administrator'],
  },
  audit: {
    read: ['super_admin', 'chairman', 'administrator'],
  },
  users: {
    read: ['super_admin'],
    write: ['super_admin'],
    delete: ['super_admin'],
  },
};

// ─── Middleware: Verify JWT ────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still active in DB
    const user = await findOne('Users', 'user_id', decoded.user_id);
    if (!user || user.is_active !== 'true') {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }

    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      branch_id: decoded.branch_id || user.branch_id,
      member_id: decoded.member_id || user.member_id,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Middleware: Check Module Permission ──────────────────────────────────────
const authorize = (module, action = 'read') => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const permissions = MODULE_PERMISSIONS[module];

    if (!permissions) {
      return res.status(403).json({ success: false, message: 'Module not found' });
    }

    const allowedRoles = permissions[action] || [];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${module}:${action}`,
      });
    }

    // Branch chiefs can only access their own branch
    if (userRole === ROLES.BRANCH_CHIEF && req.params.branchId) {
      if (req.params.branchId !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          message: 'Branch chiefs can only access their own branch',
        });
      }
    }

    next();
  };
};

// ─── Middleware: Destructive Action Confirmation ──────────────────────────────
const requireDestructiveConfirmation = (req, res, next) => {
  const confirmation = req.headers['x-destructive-confirm'];
  if (confirmation !== 'CONFIRMED') {
    return res.status(400).json({
      success: false,
      message: 'Destructive action requires X-Destructive-Confirm: CONFIRMED header',
    });
  }
  next();
};

// ─── Inline Permission Check ──────────────────────────────────────────────────
const hasPermission = (role, module, action) => {
  const permissions = MODULE_PERMISSIONS[module];
  if (!permissions) return false;
  return (permissions[action] || []).includes(role);
};

module.exports = {
  authenticate,
  authorize,
  requireDestructiveConfirmation,
  hasPermission,
  ROLES,
  MODULE_PERMISSIONS,
};
