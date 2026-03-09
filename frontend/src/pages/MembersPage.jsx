import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { membersAPI, branchesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Modal, StatusBadge, LoadingState, EmptyState, Pagination, SearchBar, SectionHeader
} from '../components/common/UI';
import { UserPlus, Filter, RefreshCw, User } from 'lucide-react';
import { format, parseISO, differenceInYears } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'active', 'probation', 'inactive', 'alumni', 'suspended'];

const initialForm = {
  full_name: '', phone: '', email: '', date_of_birth: '', gender: 'male',
  address: '', emergency_contact: '', photo_url: '', branch_id: '',
  national_id: '', occupation: '', education: '', skills: '', notes: '',
};

export default function MembersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({ status: '', branch_id: '', search: '' });

  useEffect(() => { loadBranches(); }, []);

  useEffect(() => {
    const t = setTimeout(() => loadMembers(), filters.search ? 400 : 0);
    return () => clearTimeout(t);
  }, [filters, page]);

  const loadBranches = async () => {
    const res = await branchesAPI.getAll({ limit: 100 }).catch(() => null);
    if (res?.data) setBranches(res.data);
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      if (!params.status) delete params.status;
      if (!params.branch_id) delete params.branch_id;
      if (!params.search) delete params.search;

      const res = await membersAPI.getAll(params);
      if (res?.data) {
        setMembers(res.data);
        setTotal(res.total || 0);
      }
    } catch { /* error handled by interceptor */ }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await membersAPI.create(form);
      if (res?.success) {
        toast.success(res.message || 'Member created!');
        setShowCreateModal(false);
        setForm(initialForm);
        loadMembers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Members (UMLT)"
        subtitle={`${total} total records`}
        actions={
          <div className="flex items-center gap-2">
            {can('members', 'write') && (
              <button onClick={() => setShowCreateModal(true)} className="btn-primary btn">
                <UserPlus size={16} /> Add Member
              </button>
            )}
            <button onClick={loadMembers} className="btn-secondary btn">
              <RefreshCw size={15} />
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card-sm flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchBar
            value={filters.search}
            onChange={v => handleFilterChange('search', v)}
            placeholder="Search name, ID, phone..."
          />
        </div>
        <select
          value={filters.status}
          onChange={e => handleFilterChange('status', e.target.value)}
          className="form-input w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          value={filters.branch_id}
          onChange={e => handleFilterChange('branch_id', e.target.value)}
          className="form-input w-auto"
        >
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
          ))}
        </select>
      </div>

      {/* Member Cards Grid */}
      {loading ? <LoadingState rows={6} /> : (
        <>
          {members.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No members found"
              subtitle="Try adjusting your filters or add a new member"
              action={can('members', 'write') && (
                <button onClick={() => setShowCreateModal(true)} className="btn-primary btn">
                  <UserPlus size={16} /> Add First Member
                </button>
              )}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {members.map(member => (
                <MemberCard
                  key={member.uddami_id}
                  member={member}
                  onClick={() => navigate(`/members/${member.uddami_id}`)}
                />
              ))}
            </div>
          )}

          <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
        </>
      )}

      {/* Create Member Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Member" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.full_name}
                onChange={e => setForm({...form, full_name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-input" type="tel" value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth * (min age: 13)</label>
              <input className="form-input" type="date" value={form.date_of_birth}
                onChange={e => setForm({...form, date_of_birth: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-input" value={form.gender}
                onChange={e => setForm({...form, gender: e.target.value})}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <select className="form-input" value={form.branch_id} required
                onChange={e => setForm({...form, branch_id: e.target.value})}>
                <option value="">Select Branch</option>
                {branches.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">National ID</label>
              <input className="form-input" value={form.national_id}
                onChange={e => setForm({...form, national_id: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address}
                onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Contact</label>
              <input className="form-input" value={form.emergency_contact}
                onChange={e => setForm({...form, emergency_contact: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Photo URL</label>
              <input className="form-input" type="url" value={form.photo_url}
                onChange={e => setForm({...form, photo_url: e.target.value})} placeholder="https://" />
            </div>
            <div className="form-group">
              <label className="form-label">Occupation</label>
              <input className="form-input" value={form.occupation}
                onChange={e => setForm({...form, occupation: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Education</label>
              <input className="form-input" value={form.education}
                onChange={e => setForm({...form, education: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Skills</label>
              <input className="form-input" value={form.skills}
                onChange={e => setForm({...form, skills: e.target.value})} placeholder="Comma separated" />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Notes</label>
              <textarea className="form-input resize-none" rows={2} value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary btn">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary btn">
              {submitting ? 'Creating...' : 'Create Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Member Card Component ─────────────────────────────────────────────────────
function MemberCard({ member, onClick }) {
  const age = member.date_of_birth
    ? differenceInYears(new Date(), parseISO(member.date_of_birth))
    : null;

  return (
    <div className="member-card" onClick={onClick}>
      <div className="flex items-start gap-3 mb-3">
        {member.photo_url ? (
          <img
            src={member.photo_url}
            alt={member.full_name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white/10"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-600/20 border-2 border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-400 font-bold text-lg">
              {member.full_name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-white text-sm truncate">{member.full_name}</div>
          <div className="text-xs text-slate-500 font-mono">{member.uddami_id}</div>
        </div>
        <StatusBadge status={member.status} />
      </div>

      <div className="space-y-1.5 text-xs text-slate-400">
        <div className="flex justify-between">
          <span className="text-slate-600">Branch</span>
          <span className="text-slate-300 truncate max-w-32">{member.branch_id || '—'}</span>
        </div>
        {age && (
          <div className="flex justify-between">
            <span className="text-slate-600">Age</span>
            <span className="text-slate-300">{age} years</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-600">Joined</span>
          <span className="text-slate-300">
            {member.joining_date ? format(parseISO(member.joining_date), 'MMM yyyy') : '—'}
          </span>
        </div>
        {member.current_roles?.length > 0 && (
          <div className="pt-1 border-t border-white/5">
            <span className="text-slate-600">Roles: </span>
            <span className="text-brand-400">
              {member.current_roles.map(r => r.role_title).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
