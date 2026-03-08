const { readSheet, findOne, insertRow, updateRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { format } = require('date-fns');

const LIFECYCLE = ['proposed','approved','ongoing','completed','closed'];

const getProjects = async (req, res) => {
  try {
    let projects = await readSheet('Projects');
    const { status, branch_id, page = 1, limit = 20 } = req.query;
    if (status) projects = projects.filter(p => p.status === status);
    if (branch_id) projects = projects.filter(p => p.branch_id === branch_id);
    projects = projects.filter(p => p.status !== 'deleted');
    if (req.user.role === 'branch_chief') projects = projects.filter(p => p.branch_id === req.user.branch_id);
    const total = projects.length;
    const paginated = projects.slice((page-1)*limit, page*limit);
    res.json({ success: true, data: paginated, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getProject = async (req, res) => {
  try {
    const p = await findOne('Projects', 'project_id', req.params.project_id);
    if (!p) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createProject = async (req, res) => {
  try {
    const { project_name, description, branch_id, category, start_date, end_date, budget } = req.body;
    if (!project_name) return res.status(400).json({ success: false, message: 'project_name required' });
    const year = new Date().getFullYear();
    const existing = await readSheet('Projects');
    const seq = String(existing.length + 1).padStart(4,'0');
    const project = {
      project_id: `PRJ-${year}-${seq}`, project_name, description: description||'',
      branch_id: branch_id||'', category: category||'', start_date: start_date||'',
      end_date: end_date||'', budget: budget||'0', actual_cost: '0', status: 'proposed',
      coordinator_id: req.user.member_id||'', linked_event_id: '', report_url: '', impact_score: '0',
      created_by: req.user.user_id, approved_by: '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await insertRow('Projects', project);
    await auditLog(req, 'CREATE', 'Projects', project.project_id, null, project);
    res.status(201).json({ success: true, data: project });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateProject = async (req, res) => {
  try {
    const existing = await findOne('Projects', 'project_id', req.params.project_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    const updates = { ...req.body };
    delete updates.project_id;
    const updated = await updateRow('Projects', 'project_id', req.params.project_id, updates);
    await auditLog(req, 'UPDATE', 'Projects', req.params.project_id, existing, updates);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const advanceProjectStatus = async (req, res) => {
  try {
    const p = await findOne('Projects', 'project_id', req.params.project_id);
    if (!p) return res.status(404).json({ success: false, message: 'Not found' });
    const idx = LIFECYCLE.indexOf(p.status);
    if (idx >= LIFECYCLE.length - 1) return res.status(400).json({ success: false, message: 'Already at final status' });
    const next = LIFECYCLE[idx + 1];
    if (next === 'approved' && !['super_admin','administrator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only administrators can approve projects' });
    }
    const upd = { status: next, updated_at: new Date().toISOString() };
    if (next === 'approved') upd.approved_by = req.user.user_id;
    await updateRow('Projects', 'project_id', req.params.project_id, upd);
    await auditLog(req, 'STATUS_CHANGE', 'Projects', req.params.project_id, { status: p.status }, { status: next });
    res.json({ success: true, message: `Project status: ${next}`, new_status: next });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getProjects, getProject, createProject, updateProject, advanceProjectStatus };
