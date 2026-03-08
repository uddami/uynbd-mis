import { useState, useEffect } from 'react';
import { usersAPI } from '../utils/api';
import { Modal, LoadingState, EmptyState, SectionHeader, ConfirmDialog } from '../components/common/UI';
import { PlusCircle, RefreshCw, UserCog, Trash2 } from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = ['super_admin','chairman','md','administrator','finance_director','logistics_director','branch_chief','event_chief'];

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', role: 'administrator', branch_id: '', member_id: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const res = await usersAPI.getAll().catch(() => null);
    if (res?.data) setUsers(res.data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await usersAPI.create(form);
      toast.success('User created!');
      setShowModal(false);
      setForm({ email: '', password: '', role: 'administrator', branch_id: '', member_id: '' });
      loadUsers();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    await usersAPI.delete(deleteTarget);
    toast.success('User deleted');
    loadUsers();
  };

  const ROLE_COLOR = { super_admin: 'text-red-400', chairman: 'text-amber-400', md: 'text-amber-300', administrator: 'text-brand-400', finance_director: 'text-emerald-400', logistics_director: 'text-violet-400', branch_chief: 'text-blue-400', event_chief: 'text-pink-400' };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="User Management"
        subtitle="Manage system access and roles"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)} className="btn-primary btn"><PlusCircle size={16} /> New User</button>
            <button onClick={loadUsers} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      {loading ? <LoadingState rows={5} /> : users.length === 0 ? (
        <EmptyState icon="👤" title="No users found" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Email</th><th>Role</th><th>Branch</th><th>Member ID</th><th>Status</th><th>Last Login</th><th></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td className="text-slate-200">{u.email}</td>
                  <td><span className={`font-medium text-xs ${ROLE_COLOR[u.role] || 'text-slate-400'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td className="text-slate-500 text-xs">{u.branch_id || '—'}</td>
                  <td className="font-mono text-xs text-brand-400">{u.member_id || '—'}</td>
                  <td><span className={`badge ${u.is_active === 'true' ? 'badge-active' : 'badge-inactive'}`}>{u.is_active === 'true' ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-slate-500 text-xs">{u.last_login?.slice(0,10) || 'Never'}</td>
                  <td>
                    {u.user_id !== me?.user_id && (
                      <button onClick={() => setDeleteTarget(u.user_id)} className="btn-danger btn btn-sm"><Trash2 size={12} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create System User" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password * (min 8 chars)</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} minLength={8} required />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Branch ID (if applicable)</label>
              <input className="form-input" value={form.branch_id} onChange={e => setForm({...form, branch_id: e.target.value})} placeholder="BR-DHK" />
            </div>
            <div className="form-group">
              <label className="form-label">Member ID (if applicable)</label>
              <input className="form-input" value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})} placeholder="UYNBD-2024-0001" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? They will lose all system access."
      />
    </div>
  );
}
