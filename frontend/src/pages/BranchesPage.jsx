import { useState, useEffect } from 'react';
import { branchesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, StatusBadge, LoadingState, EmptyState, SectionHeader } from '../components/common/UI';
import { PlusCircle, RefreshCw, GitBranch, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BranchesPage() {
  const { can } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ branch_name: '', short_code: '', district: '', division: '', contact_email: '', contact_phone: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadBranches(); }, []);

  const loadBranches = async () => {
    setLoading(true);
    const res = await branchesAPI.getAll({}).catch(() => null);
    if (res?.data) setBranches(res.data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await branchesAPI.create(form);
      toast.success('Branch created!');
      setShowModal(false);
      loadBranches();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Branches (UBMS)"
        subtitle={`${branches.length} total branches`}
        actions={
          <div className="flex gap-2">
            {can('branches', 'write') && (
              <button onClick={() => setShowModal(true)} className="btn-primary btn">
                <PlusCircle size={16} /> New Branch
              </button>
            )}
            <button onClick={loadBranches} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      {loading ? <LoadingState rows={4} /> : branches.length === 0 ? (
        <EmptyState icon="🌿" title="No branches found" subtitle="Create the first branch (minimum 5 members required)" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.branch_id} className="card hover:border-white/10 transition-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <GitBranch size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-white text-sm truncate">{b.branch_name}</div>
                  <div className="text-xs font-mono text-slate-500">{b.branch_id}</div>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between"><span className="text-slate-600">District</span><span>{b.district || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Division</span><span>{b.division || '—'}</span></div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Members</span>
                  <span className="flex items-center gap-1 text-brand-400"><Users size={11} />{b.member_count || 0}</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-600">Formed</span><span>{b.formed_date || '—'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Branch" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="alert-info text-xs">Minimum 5 active members required to form a branch.</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Branch Name *</label>
              <input className="form-input" value={form.branch_name} onChange={e => setForm({...form, branch_name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Short Code (3 letters)</label>
              <input className="form-input" value={form.short_code} maxLength={3}
                onChange={e => setForm({...form, short_code: e.target.value.toUpperCase()})} placeholder="DHK" />
            </div>
            <div className="form-group">
              <label className="form-label">District</label>
              <input className="form-input" value={form.district} onChange={e => setForm({...form, district: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Division</label>
              <input className="form-input" value={form.division} onChange={e => setForm({...form, division: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input className="form-input" type="tel" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Contact Email</label>
              <input className="form-input" type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-input resize-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Creating...' : 'Create Branch'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
