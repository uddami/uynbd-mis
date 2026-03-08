/**
 * UYNBD MIS - Authentication & Authorization Middleware
 * 
 * JWT-based authentication with role-based access control (RBAC).
 * 
 * ROLES (in order of power):
 * 1. super_admin    - Full access, destructive actions need confirmation
 * 2. chairman       - Read-only analytics, cannot delete
 * 3. md             - Read-only
 * 4. administrator  - Read & entry, approve events/projects
 * 5. finance_director - Read & entry on finance module only
 * 6. logistics_director - Read & entry on logistics only
 * 7. branch_chief   - Read-only for their own branch
 * 8. event_chief    - Read-only for assigned events
 */

const jwt = require('jsonwebtoken');
const { findOne } = require('../services/sheets.service');

// ─── Role Hierarchy & Permissions ─────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CHAIRMAN: 'chairman',
  MD: 'md',
  ADMINISTRATOR: 'administrator',
  FINANCE_DIRECTOR: 'finance_director',
  LOGISTICS_DIRECTOR: 'logistics_director',
  BRANCH_CHIEF: 'branch_chief',
  EVENT_CHIEF: 'event_chief',
};

// Permissions: module -> allowed roles and their access level
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
    read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief', 'event_chief'],
    write: ['super_admin', 'administrator'],
    approve: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  projects: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
    write: ['super_admin', 'administrator'],
    approve: ['super_admin', 'administrator'],
    delete: ['super_admin'],
  },
  finance: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'finance_director'],
    write: ['super_admin', 'administrator', 'finance_director'],
    delete: ['super_admin'],
  },
  documents: {
    read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
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

// ─── Middleware: Super Admin Destructive Action Confirmation ──────────────────
// For delete operations, require explicit confirmation header
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

// ─── Check if user has specific permission (for inline checks) ────────────────
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
