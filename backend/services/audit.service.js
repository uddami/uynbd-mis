/**
 * UYNBD MIS - Audit Log Service
 * 
 * All create/edit/delete/status-change actions are logged here.
 * Audit logs are IMMUTABLE - no update or delete operations allowed.
 * 
 * Usage: await auditLog(req, 'CREATE', 'Members', 'UYNBD-2024-0001', null, newData);
 */

const { insertRow, generateId } = require('./sheets.service');

/**
 * Records an audit log entry.
 * @param {Object} req - Express request (to extract user info)
 * @param {string} action - CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN | LOGOUT
 * @param {string} module - Sheet/module name
 * @param {string} recordId - ID of the affected record
 * @param {any} oldValue - Previous value (JSON stringified)
 * @param {any} newValue - New value (JSON stringified)
 * @param {string} notes - Optional notes
 */
const auditLog = async (req, action, module, recordId, oldValue = null, newValue = null, notes = '') => {
  try {
    const user = req?.user || {};
    const log = {
      log_id: generateId('LOG'),
      timestamp: new Date().toISOString(),
      user_id: user.user_id || 'system',
      user_email: user.email || 'system',
      action,
      module,
      record_id: String(recordId || ''),
      old_value: oldValue ? JSON.stringify(oldValue).substring(0, 500) : '',
      new_value: newValue ? JSON.stringify(newValue).substring(0, 500) : '',
      ip_address: req?.ip || req?.connection?.remoteAddress || '',
      notes: notes || '',
    };

    await insertRow('AuditLogs', log);
    return log;
  } catch (error) {
    // Audit logging failure should NOT block the main operation
    console.error('[AuditLog] Failed to write audit log:', error.message);
  }
};

module.exports = { auditLog };
