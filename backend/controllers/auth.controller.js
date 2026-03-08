/**
 * UYNBD MIS - Auth Controller
 * Handles login, token refresh, and user profile operations.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findOne, insertRow, updateRow, generateId, readSheet } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');

// ─── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await findOne('Users', 'email', email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!['true', 'TRUE', 'True', '1', 'yes', 'YES'].includes(String(user.is_active).trim())) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    await updateRow('Users', 'user_id', user.user_id, {
      last_login: new Date().toISOString(),
    });

    const tokenPayload = {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      member_id: user.member_id,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    // Fetch member info if linked
    let memberInfo = null;
    if (user.member_id) {
      memberInfo = await findOne('Members', 'uddami_id', user.member_id);
    }

    await auditLog(
      { user: tokenPayload, ip: req.ip },
      'LOGIN', 'Users', user.user_id, null, { email: user.email }
    );

    res.json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        member_id: user.member_id,
        member_name: memberInfo?.full_name || null,
        photo_url: memberInfo?.photo_url || null,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// ─── Get Current User Profile ─────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await findOne('Users', 'user_id', req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let memberInfo = null;
    if (user.member_id) {
      memberInfo = await findOne('Members', 'uddami_id', user.member_id);
    }

    res.json({
      success: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        member_id: user.member_id,
        member_name: memberInfo?.full_name || null,
        photo_url: memberInfo?.photo_url || null,
        last_login: user.last_login,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// ─── Change Password ───────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const user = await findOne('Users', 'user_id', req.user.user_id);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await updateRow('Users', 'user_id', req.user.user_id, { password_hash: newHash });
    await auditLog(req, 'UPDATE', 'Users', req.user.user_id, null, { action: 'password_changed' });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// ─── Bootstrap Super Admin (One-time setup) ───────────────────────────────────
const bootstrapAdmin = async (req, res) => {
  try {
    const users = await readSheet('Users');
    const existingAdmin = users.find(u => u.role === 'super_admin' && u.is_active === 'true');
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
    if (!email || !password) {
      return res.status(500).json({ success: false, message: 'Bootstrap credentials not configured' });
    }

    const hash = await bcrypt.hash(password, 12);
    const adminUser = {
      user_id: generateId('USR'),
      email: email.toLowerCase(),
      password_hash: hash,
      role: 'super_admin',
      member_id: '',
      branch_id: '',
      is_active: 'true',
      last_login: '',
      created_at: new Date().toISOString(),
      created_by: 'system_bootstrap',
    };

    await insertRow('Users', adminUser);
    res.json({ success: true, message: 'Super admin created. Change password immediately.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Bootstrap failed: ' + error.message });
  }
};

module.exports = { login, getProfile, changePassword, bootstrapAdmin };
