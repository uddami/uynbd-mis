/**
 * UYNBD MIS - Events Page (Updated)
 *
 * REPLACES: frontend/src/pages/EventsPage.jsx
 *
 * NEW FEATURES:
 * - External organization badge on cards
 * - Stats widgets: participants, news coverage, spendings
 * - Media coverage section on detail view
 * - PDF report upload and download
 * - Spending update form (role-restricted)
 * - Status advance with completion guard
 * - Locked event indicator
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, branchesAPI } from '../utils/api';

// ── Roles that can CREATE events ─────────────────────────────────────────────
const CREATE_ROLES = ['super_admin', 'administrator', 'branch_chief', 'event_chief', 'project_chief'];
const SPENDING_ROLES = ['super_admin', 'administrator', 'branch_chief', 'finance_director'];
const UNLOCK_ROLES = ['super_admin'];
const APPROVE_ROLES = ['super_admin', 'administrator'];

const EVENT_LIFECYCLE = ['draft', 'submitted', 'approved', 'published', 'completed', 'archived'];

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  archived: 'bg-gray-200 text-gray-500',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function StatCard({ icon, label, value, color = 'green' }) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${colors[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs font-medium uppercase opacity-70">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Card (list view)
// ─────────────────────────────────────────────────────────────────────────────
function EventCard({ event, onClick }) {
  return (
    <div
      onClick={() => onClick(event)}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-400 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{event.event_name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {event.event_type?.replace('_', ' ')} · {event.hosting_date}
          </p>
          {event.external_organization === 'true' && (
            <p className="text-xs text-blue-600 mt-1">
              🤝 Co-hosted with {event.external_organization_name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={event.status} />
          {event.locked === 'true' && <span className="text-xs text-red-500">🔒 Locked</span>}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-3 text-xs text-gray-500">
        <span>👥 <strong className="text-gray-700">{event.total_participants || 0}</strong> participants</span>
        <span>📰 <strong className="text-gray-700">{event.total_news_coverage || 0}</strong> coverage</span>
        {event.total_spendings && (
          <span>💰 ৳<strong className="text-gray-700">{parseFloat(event.total_spendings).toLocaleString()}</strong></span>
        )}
        {event.pdf_report_url
          ? <span className="text-green-600">📄 Report</span>
          : <span className="text-amber-500">⚠ No report</span>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit Form Modal
// ─────────────────────────────────────────────────────────────────────────────
function EventFormModal({ userRole, branches, onClose, onSaved, editEvent = null }) {
  const isEdit = !!editEvent;
  const [form, setForm] = useState({
    event_type: editEvent?.event_type || '',
    event_name: editEvent?.event_name || '',
    hosting_date: editEvent?.hosting_date || '',
    end_date: editEvent?.end_date || '',
    location: editEvent?.location || '',
    hosted_by_branch: editEvent?.hosted_by_branch || '',
    chief_host_name: editEvent?.chief_host_name || '',
    chief_host_position: editEvent?.chief_host_position || '',
    chief_host_phone: editEvent?.chief_host_phone || '',
    chief_host_email: editEvent?.chief_host_email || '',
    expected_branches: editEvent?.expected_branches || '',
    remarks: editEvent?.remarks || '',
    is_attendance_mandatory: editEvent?.is_attendance_mandatory || 'false',
    external_organization: editEvent?.external_organization === 'true',
    external_organization_name: editEvent?.external_organization_name || '',
    total_spendings: editEvent?.total_spendings || '',
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const canSpend = SPENDING_ROLES.includes(userRole);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({
      ...p,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'external_organization' && !checked ? { external_organization_name: '' } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      const payload = {
        ...form,
        external_organization: String(form.external_organization),
      };
      if (isEdit) {
        await eventsAPI.update(editEvent.event_id, payload);
      } else {
        await eventsAPI.create(payload);
      }
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save event.';
      setErrors([msg]);
    } finally {
      setLoading(false);
    }
  };

  const EVENT_TYPES = ['central_meeting', 'branch_meeting', 'project', 'joint_event', 'campaign', 'workshop', 'training'];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{isEdit ? 'Edit Event' : 'Create New Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type <span className="text-red-500">*</span></label>
              <select name="event_type" value={form.event_type} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select type...</option>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Name <span className="text-red-500">*</span></label>
              <input name="event_name" value={form.event_name} onChange={handleChange} required
                placeholder="e.g. Annual Youth Summit 2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hosting Date <span className="text-red-500">*</span></label>
              <input type="date" name="hosting_date" value={form.hosting_date} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" name="end_date" value={form.end_date} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input name="location" value={form.location} onChange={handleChange} placeholder="Venue / Online"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Host Branch</label>
              <select name="hosted_by_branch" value={form.hosted_by_branch} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select branch...</option>
                {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
              </select>
            </div>
          </div>

          {/* External Organization */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="external_organization" checked={form.external_organization}
                onChange={handleChange} className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm font-medium text-blue-800">Hosted with another organization</span>
            </label>
            {form.external_organization && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  External Organization Name <span className="text-red-500">*</span>
                </label>
                <input name="external_organization_name" value={form.external_organization_name}
                  onChange={handleChange} required placeholder="e.g. Youth Federation Bangladesh"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-blue-600 mt-1">The host branch remains the internal organizer.</p>
              </div>
            )}
          </div>

          {/* Chief Host */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'chief_host_name', label: 'Chief Host Name' },
              { name: 'chief_host_position', label: 'Position' },
              { name: 'chief_host_phone', label: 'Phone' },
              { name: 'chief_host_email', label: 'Email' },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input name={name} value={form[name]} onChange={handleChange} placeholder={label}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
          </div>

          {/* Spending */}
          {canSpend && (
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Spendings (BDT)</label>
              <input type="number" name="total_spendings" value={form.total_spendings}
                onChange={handleChange} min="0" step="0.01" placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows={2}
              placeholder="Additional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Detail Panel
// ─────────────────────────────────────────────────────────────────────────────
function EventDetail({ event, userRole, onClose, onRefresh }) {
  const [newsRecords, setNewsRecords] = useState([]);
  const [newsForm, setNewsForm] = useState({ media_name: '', coverage_link: '', coverage_date: '' });
  const [reportUrl, setReportUrl] = useState('');
  const [spendingAmount, setSpendingAmount] = useState(event.total_spendings || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isLocked = event.locked === 'true';
  const canSpend = SPENDING_ROLES.includes(userRole);
  const canUnlock = UNLOCK_ROLES.includes(userRole);
  const canAdvance = CREATE_ROLES.includes(userRole);
  const nextStatus = EVENT_LIFECYCLE[EVENT_LIFECYCLE.indexOf(event.status) + 1];

  useEffect(() => {
    eventsAPI.getNews(event.event_id)
      .then((r) => setNewsRecords(r.data || []))
      .catch(() => {});
  }, [event.event_id]);

  const showMessage = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const handleAdvanceStatus = async () => {
    if (nextStatus === 'completed' && !event.pdf_report_url?.trim()) {
      showMessage('⚠ Upload a PDF report before marking as Completed.');
      return;
    }
    setLoading(true);
    try {
      await eventsAPI.advanceStatus(event.event_id, {});
      showMessage(`✓ Status updated to ${nextStatus}`);
      onRefresh();
    } catch (err) {
      showMessage('✗ ' + (err.response?.data?.message || 'Failed'));
    } finally { setLoading(false); }
  };

  const handleSaveReport = async () => {
    if (!reportUrl.trim()) return;
    setLoading(true);
    try {
      await eventsAPI.uploadReport(event.event_id, { pdf_report_url: reportUrl });
      showMessage('✓ Report URL saved.');
      onRefresh();
    } catch (err) {
      showMessage('✗ ' + (err.response?.data?.message || 'Failed'));
    } finally { setLoading(false); }
  };

  const handleAddNews = async () => {
    if (!newsForm.media_name || !newsForm.coverage_link) {
      showMessage('Media name and link are required.');
      return;
    }
    setLoading(true);
    try {
      await eventsAPI.addNews(event.event_id, newsForm);
      setNewsForm({ media_name: '', coverage_link: '', coverage_date: '' });
      const r = await eventsAPI.getNews(event.event_id);
      setNewsRecords(r.data || []);
      showMessage('✓ Coverage added.');
      onRefresh();
    } catch (err) {
      showMessage('✗ ' + (err.response?.data?.message || 'Failed'));
    } finally { setLoading(false); }
  };

  const handleUpdateSpending = async () => {
    setLoading(true);
    try {
      await eventsAPI.updateSpending(event.event_id, { total_spendings: spendingAmount });
      showMessage('✓ Spending updated.');
      onRefresh();
    } catch (err) {
      showMessage('✗ ' + (err.response?.data?.message || 'Failed'));
    } finally { setLoading(false); }
  };

  const handleUnlock = async () => {
    if (!window.confirm('Unlock this completed event? Attendance and spending will be editable again.')) return;
    setLoading(true);
    try {
      await eventsAPI.unlock(event.event_id, { reason: 'Admin unlock via UI' });
      showMessage('✓ Event unlocked.');
      onRefresh();
    } catch (err) {
      showMessage('✗ ' + (err.response?.data?.message || 'Failed'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{event.event_name}</h2>
            <p className="text-sm text-gray-400 mt-1 capitalize">
              {event.event_type?.replace(/_/g, ' ')} · {event.hosting_date}
            </p>
            {event.external_organization === 'true' && (
              <span className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full border border-blue-200">
                🤝 Co-hosted with {event.external_organization_name}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={event.status} />
            {isLocked && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">🔒 Locked</span>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div className={`rounded-lg px-4 py-2 text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon="👥" label="Participants" value={event.total_participants || 0} color="green" />
            <StatCard icon="📰" label="Coverage" value={event.total_news_coverage || newsRecords.length} color="blue" />
            <StatCard icon="💰" label="Spending"
              value={event.total_spendings ? `৳${parseFloat(event.total_spendings).toLocaleString()}` : '—'}
              color="amber" />
            <StatCard icon="📋" label="Status" value={event.status} color="purple" />
          </div>

          {/* PDF Report */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📄 Event Report (PDF)</h4>
            {event.pdf_report_url ? (
              <div className="flex items-center gap-3">
                <span className="text-green-600 text-sm">✓ Report uploaded</span>
                <a href={event.pdf_report_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline font-medium">Download →</a>
              </div>
            ) : (
              <p className="text-amber-600 text-sm mb-2">⚠ No report uploaded. Required before marking Completed.</p>
            )}
            {!isLocked && (
              <div className="mt-3 flex gap-2">
                <input type="url" value={reportUrl} onChange={(e) => setReportUrl(e.target.value)}
                  placeholder="Paste Google Drive PDF link..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={handleSaveReport} disabled={loading || !reportUrl.trim()}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 transition">
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Spending */}
          {canSpend && !isLocked && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">💰 Update Spending</h4>
              <div className="flex gap-2 max-w-sm">
                <input type="number" value={spendingAmount} onChange={(e) => setSpendingAmount(e.target.value)}
                  placeholder="Amount in BDT" min="0" step="0.01"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={handleUpdateSpending} disabled={loading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 transition">
                  Update
                </button>
              </div>
            </div>
          )}

          {/* News Coverage */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              📰 Media Coverage <span className="font-normal text-gray-400">({newsRecords.length})</span>
            </h4>
            {newsRecords.length > 0 ? (
              <div className="space-y-2 mb-4">
                {newsRecords.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                    <span className="font-medium text-gray-700 min-w-[120px]">{n.media_name}</span>
                    <a href={n.coverage_link} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate flex-1">{n.coverage_link}</a>
                    <span className="text-gray-400 text-xs shrink-0">{n.coverage_date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${n.verified === 'true' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {n.verified === 'true' ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm mb-4">No media coverage recorded yet.</p>
            )}
            {!isLocked && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Add Coverage</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input placeholder="Media Name" value={newsForm.media_name}
                    onChange={(e) => setNewsForm((p) => ({ ...p, media_name: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input placeholder="Coverage URL" value={newsForm.coverage_link}
                    onChange={(e) => setNewsForm((p) => ({ ...p, coverage_link: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="date" value={newsForm.coverage_date}
                    onChange={(e) => setNewsForm((p) => ({ ...p, coverage_date: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button onClick={handleAddNews} disabled={loading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 transition">
                  Add Coverage
                </button>
              </div>
            )}
          </div>

          {/* Advance Status */}
          {canAdvance && nextStatus && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Advance to <strong className="capitalize">{nextStatus}</strong></p>
                {nextStatus === 'completed' && !event.pdf_report_url && (
                  <p className="text-xs text-amber-600 mt-0.5">⚠ PDF report required before completing.</p>
                )}
                {nextStatus === 'approved' && !APPROVE_ROLES.includes(userRole) && (
                  <p className="text-xs text-red-500 mt-0.5">Only administrators can approve.</p>
                )}
              </div>
              <button
                onClick={handleAdvanceStatus}
                disabled={loading || (nextStatus === 'approved' && !APPROVE_ROLES.includes(userRole))}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 transition">
                {loading ? 'Processing...' : `Mark as ${nextStatus}`}
              </button>
            </div>
          )}

          {/* Unlock */}
          {isLocked && canUnlock && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">🔒 Event is Locked</p>
                <p className="text-xs text-red-500 mt-0.5">Unlock to allow editing attendance and spending.</p>
              </div>
              <button onClick={handleUnlock} disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 transition">
                Unlock
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Events Page
// ─────────────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canCreate = CREATE_ROLES.includes(user?.role);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.event_type = filterType;
      if (search) params.search = search;
      const res = await eventsAPI.getAll(params);
      setEvents(res.data || []);
    } catch (err) {
      console.error('Failed to fetch events', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    branchesAPI.getAll()
      .then((r) => setBranches(r.data || []))
      .catch(() => {});
  }, [filterStatus, filterType]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEvents();
  };

  // Summary stats
  const totalParticipants = events.reduce((s, e) => s + parseInt(e.total_participants || 0, 10), 0);
  const totalSpendings = events.reduce((s, e) => s + parseFloat(e.total_spendings || 0), 0);
  const totalCoverage = events.reduce((s, e) => s + parseInt(e.total_news_coverage || 0, 10), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events & Activities</h1>
          <p className="text-sm text-gray-400 mt-0.5">{events.length} total events</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition shadow-sm">
            + New Event
          </button>
        )}
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📋" label="Total Events" value={events.length} color="purple" />
        <StatCard icon="👥" label="Total Participants" value={totalParticipants.toLocaleString()} color="green" />
        <StatCard icon="💰" label="Total Spendings" value={`৳${totalSpendings.toLocaleString()}`} color="amber" />
        <StatCard icon="📰" label="Media Coverage" value={totalCoverage} color="blue" />
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search events..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 min-w-[200px]" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
          <option value="">All Statuses</option>
          {EVENT_LIFECYCLE.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
          <option value="">All Types</option>
          {['central_meeting', 'branch_meeting', 'project', 'joint_event', 'campaign', 'workshop', 'training']
            .map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <button type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 transition">
          Search
        </button>
      </form>

      {/* Event Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <EventCard key={e.event_id} event={e} onClick={setSelectedEvent} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p className="font-medium">No events found</p>
          <p className="text-sm">Try adjusting your filters or create a new event</p>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <EventFormModal
          userRole={user?.role}
          branches={branches}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchEvents(); }}
        />
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          userRole={user?.role}
          onClose={() => setSelectedEvent(null)}
          onRefresh={() => {
            fetchEvents();
            eventsAPI.getOne(selectedEvent.event_id)
              .then((r) => setSelectedEvent(r.data))
              .catch(() => setSelectedEvent(null));
          }}
        />
      )}
    </div>
  );
}
