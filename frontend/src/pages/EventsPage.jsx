import { useState, useEffect } from 'react';
import { eventsAPI, branchesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, StatusBadge, LoadingState, EmptyState, SectionHeader, Pagination } from '../components/common/UI';
import { PlusCircle, RefreshCw, CalendarDays, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_TYPES = ['central_meeting','branch_meeting','project','joint_event','campaign'];

export default function EventsPage() {
  const { can } = useAuth();
  const [events, setEvents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ status: '', event_type: '' });
  const [form, setForm] = useState({
    event_type: 'central_meeting', event_name: '', hosting_date: '', end_date: '',
    location: '', hosted_by_branch: '', chief_host_name: '', chief_host_position: '',
    chief_host_phone: '', chief_host_email: '', remarks: '', is_attendance_mandatory: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadBranches(); }, []);
  useEffect(() => { loadEvents(); }, [filters, page]);

  const loadBranches = async () => {
    const res = await branchesAPI.getAll({ limit: 100 }).catch(() => null);
    if (res?.data) setBranches(res.data);
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      if (!params.status) delete params.status;
      if (!params.event_type) delete params.event_type;
      const res = await eventsAPI.getAll(params);
      if (res?.data) { setEvents(res.data); setTotal(res.total || 0); }
    } finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await eventsAPI.create(form);
      toast.success('Event created!');
      setShowModal(false);
      loadEvents();
    } finally { setSubmitting(false); }
  };

  const handleAdvance = async (event_id) => {
    try {
      const res = await eventsAPI.advanceStatus(event_id, {});
      toast.success(res.message || 'Status updated');
      loadEvents();
    } catch {}
  };

  const STATUS_NEXT = {
    draft: 'Submit', submitted: 'Approve', approved: 'Publish',
    published: 'Complete', completed: 'Archive',
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Events & Activities"
        subtitle={`${total} total events`}
        actions={
          <div className="flex gap-2">
            {can('events', 'write') && (
              <button onClick={() => setShowModal(true)} className="btn-primary btn">
                <PlusCircle size={16} /> New Event
              </button>
            )}
            <button onClick={loadEvents} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      <div className="card-sm flex flex-wrap gap-3">
        <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="form-input w-auto">
          <option value="">All Statuses</option>
          {['draft','submitted','approved','published','completed','archived'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
          ))}
        </select>
        <select value={filters.event_type} onChange={e => setFilters({...filters, event_type: e.target.value})} className="form-input w-auto">
          <option value="">All Types</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      {loading ? <LoadingState rows={5} /> : events.length === 0 ? (
        <EmptyState icon="📅" title="No events found" />
      ) : (
        <div className="space-y-3">
          {events.map(evt => (
            <div key={evt.event_id} className="card hover:border-white/10 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={18} className="text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start flex-wrap gap-2 mb-1">
                    <h3 className="font-display font-bold text-white">{evt.event_name}</h3>
                    <StatusBadge status={evt.status} />
                    <span className="badge bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">
                      {evt.event_type?.replace(/_/g,' ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><CalendarDays size={11} /> {evt.hosting_date}</span>
                    {evt.location && <span className="flex items-center gap-1"><MapPin size={11} /> {evt.location}</span>}
                    <span className="font-mono text-slate-600">{evt.event_id}</span>
                  </div>
                  {evt.chief_host_name && (
                    <div className="text-xs text-slate-500 mt-1">Host: {evt.chief_host_name} · {evt.chief_host_position}</div>
                  )}
                </div>
                {can('events', 'write') && STATUS_NEXT[evt.status] && (
                  <button onClick={() => handleAdvance(evt.event_id)} className="btn-secondary btn btn-sm flex-shrink-0">
                    {STATUS_NEXT[evt.status]}
                  </button>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Event" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Event Name *</label>
              <input className="form-input" value={form.event_name}
                onChange={e => setForm({...form, event_name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-input" value={form.event_type}
                onChange={e => setForm({...form, event_type: e.target.value})}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hosting Branch</label>
              <select className="form-input" value={form.hosted_by_branch}
                onChange={e => setForm({...form, hosted_by_branch: e.target.value})}>
                <option value="">Central / All</option>
                {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" value={form.hosting_date}
                onChange={e => setForm({...form, hosting_date: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={form.end_date}
                onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location}
                onChange={e => setForm({...form, location: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Chief Host Name</label>
              <input className="form-input" value={form.chief_host_name}
                onChange={e => setForm({...form, chief_host_name: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Chief Host Position</label>
              <input className="form-input" value={form.chief_host_position}
                onChange={e => setForm({...form, chief_host_position: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Chief Host Phone</label>
              <input className="form-input" type="tel" value={form.chief_host_phone}
                onChange={e => setForm({...form, chief_host_phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Chief Host Email</label>
              <input className="form-input" type="email" value={form.chief_host_email}
                onChange={e => setForm({...form, chief_host_email: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Remarks</label>
              <textarea className="form-input resize-none" rows={2} value={form.remarks}
                onChange={e => setForm({...form, remarks: e.target.value})} />
            </div>
            <div className="form-group col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_attendance_mandatory}
                  onChange={e => setForm({...form, is_attendance_mandatory: e.target.checked})}
                  className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-slate-300">Mandatory Attendance</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn">
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
