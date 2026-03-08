import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { membersAPI, financeAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, Modal, LoadingState, Alert, ConfirmDialog } from '../components/common/UI';
import {
  ArrowLeft, Edit, UserCheck, GitBranch, Trash2, PlusCircle,
  Phone, Mail, MapPin, Calendar, Briefcase, GraduationCap, Star
} from 'lucide-react';
import { format, parseISO, differenceInYears, differenceInMonths } from 'date-fns';
import toast from 'react-hot-toast';

export default function MemberProfilePage() {
  const { uddami_id } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const [member, setMember] = useState(null);
  const [financeStatus, setFinanceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { loadMember(); }, [uddami_id]);

  const loadMember = async () => {
    setLoading(true);
    try {
      const [memberRes, financeRes] = await Promise.all([
        membersAPI.getOne(uddami_id),
        financeAPI.getMemberStatus(uddami_id).catch(() => null),
      ]);
      if (memberRes?.data) {
        setMember(memberRes.data);
        setEditForm(memberRes.data);
      }
      if (financeRes?.data) setFinanceStatus(financeRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const { uddami_id: _id, joining_date: _jd, ...updates } = editForm;
      await membersAPI.update(uddami_id, updates);
      toast.success('Member updated');
      setShowEditModal(false);
      loadMember();
    } catch {}
  };

  const handlePromote = async () => {
    try {
      await membersAPI.promote(uddami_id);
      toast.success('Member promoted to Active!');
      loadMember();
    } catch {}
  };

  const handleDelete = async () => {
    await membersAPI.delete(uddami_id);
    navigate('/members');
  };

  if (loading) return <LoadingState rows={8} />;
  if (!member) return <div className="text-center text-slate-400 mt-20">Member not found</div>;

  const age = member.date_of_birth
    ? differenceInYears(new Date(), parseISO(member.date_of_birth)) : null;
  const servicePeriod = member.joining_date
    ? differenceInMonths(new Date(), parseISO(member.joining_date)) : 0;

  const attendanceRate = member.stats?.participation_rate || 0;

  const finStatusColors = {
    paid: 'text-emerald-400', late: 'text-amber-400',
    inactive: 'text-red-400', suspension_review: 'text-red-500',
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back + Actions */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/members')} className="btn-secondary btn btn-sm">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex-1" />
        {can('members', 'write') && (
          <>
            <button onClick={() => setShowEditModal(true)} className="btn-secondary btn btn-sm">
              <Edit size={14} /> Edit
            </button>
            {member.status === 'probation' && (
              <button onClick={handlePromote} className="btn-success btn btn-sm">
                <UserCheck size={14} /> Promote to Active
              </button>
            )}
          </>
        )}
        {can('members', 'delete') && (
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger btn btn-sm">
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Photo */}
          {member.photo_url ? (
            <img
              src={member.photo_url} alt={member.full_name}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-white/10"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-brand-600/20 border-2 border-brand-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-brand-400 font-bold text-4xl">
                {member.full_name?.[0]?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3 mb-2">
              <h1 className="font-display font-black text-white text-2xl">{member.full_name}</h1>
              <StatusBadge status={member.status} />
            </div>
            <div className="font-mono text-brand-400 text-sm mb-3">{member.uddami_id}</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-500 text-xs">Age</div>
                <div className="text-white">{age ? `${age} years` : '—'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Branch</div>
                <div className="text-white">{member.branch_id || '—'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Joined</div>
                <div className="text-white">
                  {member.joining_date ? format(parseISO(member.joining_date), 'MMM d, yyyy') : '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Service Period</div>
                <div className="text-white">{servicePeriod} months</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 sm:flex-col text-center">
            <div className="card-sm min-w-20">
              <div className={`text-2xl font-display font-bold ${finStatusColors[financeStatus?.status] || 'text-slate-400'}`}>
                {financeStatus?.months_behind ?? '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">Months Behind</div>
            </div>
            <div className="card-sm min-w-20">
              <div className="text-2xl font-display font-bold text-brand-400">{attendanceRate}%</div>
              <div className="text-xs text-slate-500 mt-1">Attendance</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {financeStatus?.status === 'suspension_review' && (
          <div className="alert-danger mt-4">
            <span>⚠ This member is 4+ months behind on contributions — Suspension Review required</span>
          </div>
        )}
        {financeStatus?.status === 'late' && (
          <div className="alert-warning mt-4">
            <span>This member is {financeStatus.months_behind} month(s) late on contributions</span>
          </div>
        )}
        {member.status === 'probation' && member.probation_end_date && (
          <div className="alert-info mt-4">
            <span>Probation ends: {format(parseISO(member.probation_end_date), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className="card space-y-3">
          <h3 className="font-display font-bold text-white text-sm">Contact Information</h3>
          {[
            { icon: Phone, label: 'Phone', value: member.phone },
            { icon: Mail, label: 'Email', value: member.email },
            { icon: MapPin, label: 'Address', value: member.address },
            { icon: Briefcase, label: 'Occupation', value: member.occupation },
            { icon: GraduationCap, label: 'Education', value: member.education },
          ].map(({ icon: Icon, label, value }) => value ? (
            <div key={label} className="flex items-start gap-2 text-sm">
              <Icon size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-slate-500 text-xs">{label}</div>
                <div className="text-slate-200">{value}</div>
              </div>
            </div>
          ) : null)}
          {member.skills && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {member.skills.split(',').map(s => (
                <span key={s} className="badge bg-brand-500/10 text-brand-400 text-xs">{s.trim()}</span>
              ))}
            </div>
          )}
        </div>

        {/* Current Roles */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-white text-sm">Roles & Positions</h3>
            {can('members', 'write') && (
              <button onClick={() => setShowRoleModal(true)} className="btn-secondary btn btn-sm">
                <PlusCircle size={13} />
              </button>
            )}
          </div>
          {member.roles?.filter(r => r.is_active === 'true').map(role => (
            <div key={role.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/3 mb-2">
              <Star size={13} className="text-brand-400" />
              <div>
                <div className="text-sm text-white font-medium">{role.role_title}</div>
                <div className="text-xs text-slate-500">{role.role_type} · Since {role.start_date}</div>
              </div>
            </div>
          ))}
          {!member.roles?.some(r => r.is_active === 'true') && (
            <div className="text-slate-600 text-sm text-center py-4">No active roles</div>
          )}

          {/* Role History */}
          {member.roles?.filter(r => r.is_active !== 'true').length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-500 mb-2">Previous Roles</div>
              {member.roles.filter(r => r.is_active !== 'true').map(role => (
                <div key={role.id} className="text-xs text-slate-500 py-1">
                  {role.role_title} ({role.start_date} → {role.end_date || 'present'})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Finance Summary */}
        <div className="card">
          <h3 className="font-display font-bold text-white text-sm mb-3">Finance Summary</h3>
          {financeStatus && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={financeStatus.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Months Behind</span>
                <span className="text-white">{financeStatus.months_behind}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Paid Months</span>
                <span className="text-white">{financeStatus.total_paid}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Amount</span>
                <span className="text-emerald-400">৳{financeStatus.total_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Last Payment</span>
                <span className="text-slate-300">{financeStatus.last_paid_month || '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Records */}
      {member.attendance_records?.length > 0 && (
        <div className="card">
          <h3 className="font-display font-bold text-white mb-3">Recent Attendance</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {member.attendance_records.slice(0, 10).map(a => (
                  <tr key={a.id}>
                    <td className="font-mono text-brand-400 text-xs">{a.event_id}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="text-slate-500">{a.notes || '—'}</td>
                    <td className="text-slate-500 text-xs">{a.created_at?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer History */}
      {member.transfer_history?.length > 0 && (
        <div className="card">
          <h3 className="font-display font-bold text-white mb-3">Transfer History</h3>
          <div className="space-y-2">
            {member.transfer_history.map(t => (
              <div key={t.id} className="flex items-center gap-4 text-sm p-2 rounded-lg bg-white/3">
                <span className="text-slate-400">{t.from_branch}</span>
                <span className="text-slate-600">→</span>
                <span className="text-brand-400">{t.to_branch}</span>
                <span className="text-slate-600 ml-auto">{t.transfer_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Member" size="lg">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="alert-info text-xs">
            Note: Uddami ID and Joining Date cannot be edited.
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'full_name', label: 'Full Name', type: 'text' },
              { key: 'phone', label: 'Phone', type: 'tel' },
              { key: 'email', label: 'Email', type: 'email' },
              { key: 'address', label: 'Address', type: 'text' },
              { key: 'emergency_contact', label: 'Emergency Contact', type: 'text' },
              { key: 'occupation', label: 'Occupation', type: 'text' },
              { key: 'education', label: 'Education', type: 'text' },
              { key: 'photo_url', label: 'Photo URL', type: 'url' },
            ].map(({ key, label, type }) => (
              <div key={key} className="form-group">
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} value={editForm[key] || ''}
                  onChange={e => setEditForm({...editForm, [key]: e.target.value})} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" className="btn-primary btn">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Member"
        message={`Are you sure you want to delete ${member.full_name}? This action will soft-delete the member record.`}
      />
    </div>
  );
}
