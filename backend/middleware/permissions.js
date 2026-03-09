/**
 * middleware/permissions.js
 * ─────────────────────────
 * Role-based access control middleware.
 * Attach to routes to enforce who can do what.
 */

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: "super_admin",
  CHAIRMAN: "chairman",
  ADMINISTRATOR: "administrator",
  MD: "md",
  BRANCH_CHIEF: "branch_chief",
  FINANCE_DIRECTOR: "finance_director",
  LOGISTICS_DIRECTOR: "logistics_director",
  EVENT_CHIEF: "event_chief",
  PROJECT_CHIEF: "project_chief",
};

// ── Who can CREATE activities ─────────────────────────────────────────────────
const ACTIVITY_CREATE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMINISTRATOR,
  ROLES.BRANCH_CHIEF,
  ROLES.EVENT_CHIEF,
  ROLES.PROJECT_CHIEF,
];

// ── Who can APPROVE activities ────────────────────────────────────────────────
const ACTIVITY_APPROVE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMINISTRATOR,
];

// ── Who can enter SPENDING data ───────────────────────────────────────────────
const SPENDING_ENTRY_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMINISTRATOR,
  ROLES.BRANCH_CHIEF,
  ROLES.FINANCE_DIRECTOR,
];

// ── Who can UNLOCK completed activities ──────────────────────────────────────
const UNLOCK_ROLES = [ROLES.SUPER_ADMIN];

// ── Middleware factory ────────────────────────────────────────────────────────
/**
 * Require one of the specified roles.
 * Usage: router.post("/", requireRole(ACTIVITY_CREATE_ROLES), handler)
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = req.user; // populated by auth middleware
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Role '${user.role}' cannot perform this action.`,
      });
    }
    next();
  };
}

/**
 * For Branch Chief: ensure they only create activities for their own branch.
 * For Event/Project Chief: scoped to their assigned activity.
 */
function requireBranchScope(req, res, next) {
  const user = req.user;
  if ([ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR].includes(user.role)) {
    return next(); // no restriction
  }
  if (user.role === ROLES.BRANCH_CHIEF) {
    const branchId = req.body.branch_id ?? req.params.branch_id;
    if (branchId && branchId !== user.branch_id) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Branch Chief can only manage their own branch activities.",
      });
    }
  }
  next();
}

/**
 * Block edits on locked (Completed) activities.
 * Pass the activity object as req.activity before this middleware.
 */
function blockIfLocked(req, res, next) {
  const activity = req.activity;
  if (!activity) return next();
  if (activity.locked === "TRUE" && !UNLOCK_ROLES.includes(req.user?.role)) {
    return res.status(403).json({
      error: "Locked",
      message: "This activity is completed and locked. Only Super Admin can unlock it.",
    });
  }
  next();
}

module.exports = {
  ROLES,
  ACTIVITY_CREATE_ROLES,
  ACTIVITY_APPROVE_ROLES,
  SPENDING_ENTRY_ROLES,
  UNLOCK_ROLES,
  requireRole,
  requireBranchScope,
  blockIfLocked,
};
