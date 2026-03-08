const { readSheet, findOne, insertRow, updateRow, hardDeleteRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { format } = require('date-fns');

const getDocuments = async (req, res) => {
  try {
    let docs = await readSheet('Documents');
    docs = docs.filter(d => d.status !== 'deleted');
    if (req.query.linked_to_id) docs = docs.filter(d => d.linked_to_id === req.query.linked_to_id);
    if (req.query.branch_id) docs = docs.filter(d => d.branch_id === req.query.branch_id);
    res.json({ success: true, data: docs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createDocument = async (req, res) => {
  try {
    const { title, doc_type, linked_to_type, linked_to_id, branch_id, file_url, description } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title required' });
    const doc = {
      doc_id: generateId('DOC'), title, doc_type: doc_type||'other',
      linked_to_type: linked_to_type||'', linked_to_id: linked_to_id||'',
      branch_id: branch_id||'', file_url: file_url||'', drive_id: '',
      is_locked: 'false', upload_date: format(new Date(),'yyyy-MM-dd'),
      uploaded_by: req.user.user_id, description: description||'',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await insertRow('Documents', doc);
    await auditLog(req, 'CREATE', 'Documents', doc.doc_id, null, doc);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateDocument = async (req, res) => {
  try {
    const { doc_id } = req.params;
    const existing = await findOne('Documents', 'doc_id', doc_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.is_locked === 'true' && req.user.role !== 'super_admin')
      return res.status(403).json({ success: false, message: 'Document is locked' });
    const updates = { ...req.body };
    delete updates.doc_id;
    const updated = await updateRow('Documents', 'doc_id', doc_id, updates);
    await auditLog(req, 'UPDATE', 'Documents', doc_id, existing, updates);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteDocument = async (req, res) => {
  try {
    const existing = await findOne('Documents', 'doc_id', req.params.doc_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    await hardDeleteRow('Documents', 'doc_id', req.params.doc_id);
    await auditLog(req, 'DELETE', 'Documents', req.params.doc_id, existing, null);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getDocuments, createDocument, updateDocument, deleteDocument };
