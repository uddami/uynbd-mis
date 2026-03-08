import { useState, useEffect } from 'react';
import { projectsAPI, branchesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, StatusBadge, LoadingState, EmptyState, SectionHeader, Pagination } from '../components/common/UI';
import { PlusCircle, RefreshCw, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';

const PROJECT_LIFECYCLE = ['proposed','approved','ongoing','completed','closed'];

export default function ProjectsPage() {
  const { can } = useAuth();
  const [projects, setProjects] = useState([]);
  const [branches, setBranches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ status: '' });
  const [form, setForm] = useState({ project_name: '', description: '', branch_id: '', category: '', start_date: '', end_date: '', budget: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { branchesAPI.getAll({limit:100}).then(r => { if(r?.data) setBranches(r.data); }); }, []);
  useEffect(() => { loadProjects(); }, [filters, page]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      if (!params.status) delete params.status;
      const res = await projectsAPI.getAll(params);
      if (res?.data) { setProjects(res.data); setTotal(res.total || 0); }
    } finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await projectsAPI.create(form);
      toast.success('Project created!');
      setShowModal(false);
      loadProjects();
    } finally { setSubmitting(false); }
  };

  const handleAdvance = async (project_id) => {
    try {
      const res = await projectsAPI.advanceStatus(project_id, {});
      toast.success(res.message || 'Status updated');
      loadProjects();
    } catch {}
  };

  const STATUS_NEXT = { proposed: 'Approve', approved: 'Start', ongoing: 'Complete', completed: 'Close' };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Projects (UTPMS)"
        subtitle={`${total} total projects`}
        actions={
          <div className="flex gap-2">
            {can('projects','write') && <button onClick={() => setShowModal(true)} className="btn-primary btn"><PlusCircle size={16} /> New Project</button>}
            <button onClick={loadProjects} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      <div className="card-sm flex gap-3">
        <select value={filters.status} onChange={e => setFilters({status: e.target.value})} className="form-input w-auto">
          <option value="">All Statuses</option>
          {PROJECT_LIFECYCLE.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      {loading ? <LoadingState rows={4} /> : projects.length === 0 ? (
        <EmptyState icon="📁" title="No projects found" />
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.project_id} className="card hover:border-white/10 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <FolderKanban size={16} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h3 className="font-display font-bold text-white">{p.project_name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-slate-500">{p.description}</div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1">
                    <span>Branch: {p.branch_id || 'Central'}</span>
                    {p.budget && <span className="text-emerald-400">Budget: ৳{Number(p.budget).toLocaleString()}</span>}
                    <span>{p.start_date} → {p.end_date || 'TBD'}</span>
                    <span className="font-mono text-slate-600">{p.project_id}</span>
                  </div>
                </div>
                {can('projects','write') && STATUS_NEXT[p.status] && (
                  <button onClick={() => handleAdvance(p.project_id)} className="btn-secondary btn btn-sm flex-shrink-0">
                    {STATUS_NEXT[p.status]}
                  </button>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Project" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} required />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-input resize-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select className="form-input" value={form.branch_id} onChange={e => setForm({...form, branch_id: e.target.value})}>
                <option value="">Central</option>
                {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Social, Education..." />
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Budget (৳)</label>
              <input className="form-input" type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Creating...' : 'Create Project'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
