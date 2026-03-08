const bcrypt = require('bcryptjs');
const { readSheet, findOne, insertRow, updateRow, hardDeleteRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');

const getUsers = async (req, res) => {
  try {
    const users = await readSheet('Users');
    const safe = users.map(({ password_hash, ...u }) => u);
    res.json({ success: true, data: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createUser = async (req, res) => {
  try {
    const { email, password, role, branch_id, member_id } = req.body;
    if (!email || !password || !role) return res.status(400).json({ success: false, message: 'email, password, role required' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password min 8 chars' });
    const exists = await findOne('Users', 'email', email.toLowerCase());
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });
    const hash = await bcrypt.hash(password, 12);
    const user = {
      user_id: generateId('USR'), email: email.toLowerCase(), password_hash: hash,
      role, member_id: member_id||'', branch_id: branch_id||'', is_active: 'true',
      last_login: '', created_at: new Date().toISOString(), created_by: req.user.user_id,
    };
    await insertRow('Users', user);
    await auditLog(req, 'CREATE', 'Users', user.user_id, null, { email, role });
    const { password_hash, ...safe } = user;
    res.status(201).json({ success: true, data: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const updates = { ...req.body };
    delete updates.password_hash;
    delete updates.user_id;
    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, 12);
      delete updates.password;
    }
    const updated = await updateRow('Users', 'user_id', user_id, updates);
    await auditLog(req, 'UPDATE', 'Users', user_id, null, updates);
    const { password_hash, ...safe } = updated;
    res.json({ success: true, data: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (user_id === req.user.user_id) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    await hardDeleteRow('Users', 'user_id', user_id);
    await auditLog(req, 'DELETE', 'Users', user_id, null, null);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
