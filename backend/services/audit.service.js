/**
 * UYNBD MIS - Audit Service
 *
 * REPLACES: backend/services/audit.service.js
 *
 * Append-only audit log writer.
 * Every create/edit/delete/status-change goes here.
 * Audit rows can NEVER be edited or deleted via any API.
 */

const { insertRow, generateId } = require('./sheets.service');

/**
 * Write one audit log entry.
 * @param {object} req          – Express request (for user info)
 * @param {string} action       – e.g. "CREATE", "UPDATE", "STATUS_CHANGE", "DELETE", "UNLOCK"
 * @param {string} tableName    – sheet name, e.g. "Events"
 * @param {string} recordId     – primary key value of the affected record
 * @param {object} oldData      – data before the change (null for creates)
 * @param {object} newData      – data after the change
 * @param {string} notes        – optional extra notes
 */
const auditLog = async (req, action, tableName, recordId, oldData = null, newData = null, notes = '') => {
  try {
    await insertRow('AuditLog', {
      log_id: generateId('LOG'),
      timestamp: new Date().toISOString(),
      user_id: req?.user?.user_id ?? 'unknown',
      user_role: req?.user?.role ?? 'unknown',
      action,
      table_name: tableName,
      record_id: recordId,
      old_data: oldData ? JSON.stringify(oldData) : '',
      new_data: newData ? JSON.stringify(newData) : '',
      notes: notes || '',
    });
  } catch (err) {
    // Audit log failure should NEVER crash the main request
    console.error('[AuditService] Failed to write log:', err.message);
  }
};

module.exports = { auditLog };
