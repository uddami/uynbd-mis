/**
 * auditLog.js
 * ────────────
 * Append-only audit log writer.
 * Every create/edit/delete/status-change goes here.
 * Audit rows can NEVER be edited or deleted via any API.
 */

const { appendRow } = require("./sheetsService");
const { v4: uuidv4 } = require("uuid");

/**
 * Write one audit log entry.
 * @param {object} opts
 * @param {object} opts.user        – { id, role, name }
 * @param {string} opts.action      – e.g. "CREATE", "UPDATE", "STATUS_CHANGE", "DELETE", "UNLOCK"
 * @param {string} opts.tableName   – sheet name, e.g. "Activities"
 * @param {string} opts.recordId    – primary key value
 * @param {object} opts.details     – any extra context (old vs new values, etc.)
 */
async function writeAuditLog({ user, action, tableName, recordId, details = {} }) {
  try {
    await appendRow("Audit_Log", {
      log_id: uuidv4(),
      timestamp: new Date().toISOString(),
      user_id: user?.id ?? "unknown",
      user_role: user?.role ?? "unknown",
      action,
      table_name: tableName,
      record_id: recordId,
      details: JSON.stringify(details),
    });
  } catch (err) {
    // Audit log failure should NEVER crash the main request
    console.error("[AuditLog] Failed to write log:", err.message);
  }
}

module.exports = { writeAuditLog };
