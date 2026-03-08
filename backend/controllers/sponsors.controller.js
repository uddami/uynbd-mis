const { readSheet, insertRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');

const getSponsors = async (req, res) => {
  try {
    const sponsors = await readSheet('Sponsors');
    res.json({ success: true, data: sponsors.filter(s => s.status !== 'deleted') });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSponsor = async (req, res) => {
  try {
    const { sponsor_name, sponsor_type, amount, contact_name, contact_phone, contact_email, notes } = req.body;
    if (!sponsor_name) return res.status(400).json({ success: false, message: 'sponsor_name required' });
    const sponsor = {
      sponsor_id: generateId('SPO'), sponsor_name, sponsor_type: sponsor_type||'corporate',
      amount: amount||'0', contact_name: contact_name||'', contact_phone: contact_phone||'',
      contact_email: contact_email||'', linked_project_id: '', linked_event_id: '',
      agreement_url: '', status: 'active', notes: notes||'',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await insertRow('Sponsors', sponsor);
    await auditLog(req, 'CREATE', 'Sponsors', sponsor.sponsor_id, null, sponsor);
    res.status(201).json({ success: true, data: sponsor });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAssets = async (req, res) => {
  try {
    const assets = await readSheet('Assets');
    res.json({ success: true, data: assets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createAsset = async (req, res) => {
  try {
    const { asset_name, category, quantity, condition, location, notes } = req.body;
    if (!asset_name) return res.status(400).json({ success: false, message: 'asset_name required' });
    const asset = {
      asset_id: generateId('AST'), asset_name, category: category||'',
      quantity: quantity||'1', condition: condition||'good', location: location||'',
      assigned_member_id: '', branch_id: req.user.branch_id||'',
      purchase_date: '', purchase_cost: '0', notes: notes||'',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await insertRow('Assets', asset);
    await auditLog(req, 'CREATE', 'Assets', asset.asset_id, null, asset);
    res.status(201).json({ success: true, data: asset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getSponsors, createSponsor, getAssets, createAsset };
