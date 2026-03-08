const { readSheet, findOne, insertRow, updateRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { format } = require('date-fns');

const getBranches = async (req, res) => {
  try {
    let branches = await readSheet('Branches');
    branches = branches.filter(b => b.status !== 'deleted');
    if (req.user.role === 'branch_chief') {
      branches = branches.filter(b => b.branch_id === req.user.branch_id);
    }
    res.json({ success: true, data: branches, total: branches.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getBranch = async (req, res) => {
  try {
    const branch = await findOne('Branches', 'branch_id', req.params.branch_id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    const members = await readSheet('Members');
    const branchMembers = members.filter(m => m.branch_id === req.params.branch_id && m.status !== 'deleted');
    res.json({ success: true, data: { ...branch, members: branchMembers } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createBranch = async (req, res) => {
  try {
    const { branch_name, short_code, district, division, contact_email, contact_phone, description } = req.body;
    if (!branch_name) return res.status(400).json({ success: false, message: 'branch_name required' });
    const code = short_code || branch_name.substring(0,3).toUpperCase();
    const branch_id = `BR-${code}`;
    const branch = {
      branch_id, branch_name, short_code: code, district: district||'', division: division||'',
      formed_date: format(new Date(),'yyyy-MM-dd'), status: 'active',
      chief_member_id: '', member_count: '0', description: description||'',
      contact_email: contact_email||'', contact_phone: contact_phone||'',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await insertRow('Branches', branch);
    await auditLog(req, 'CREATE', 'Branches', branch_id, null, branch);
    res.status(201).json({ success: true, data: branch });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateBranch = async (req, res) => {
  try {
    const { branch_id } = req.params;
    const existing = await findOne('Branches', 'branch_id', branch_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    const updates = { ...req.body };
    delete updates.branch_id;
    const updated = await updateRow('Branches', 'branch_id', branch_id, updates);
    await auditLog(req, 'UPDATE', 'Branches', branch_id, existing, updates);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getBranchStats = async (req, res) => {
  try {
    const branches = await readSheet('Branches');
    const members = await readSheet('Members');
    const stats = branches.filter(b => b.status !== 'deleted').map(b => ({
      branch_id: b.branch_id, branch_name: b.branch_name, status: b.status,
      active_members: members.filter(m => m.branch_id === b.branch_id && m.status === 'active').length,
      total_members: members.filter(m => m.branch_id === b.branch_id && m.status !== 'deleted').length,
    }));
    res.json({ success: true, data: stats });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getBranches, getBranch, createBranch, updateBranch, getBranchStats };
