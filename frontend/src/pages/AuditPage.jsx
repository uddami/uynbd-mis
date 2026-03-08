import { useState, useEffect } from 'react';
import { auditAPI } from '../utils/api';
import { LoadingState, EmptyState, SectionHeader, Pagination } from '../components/common/UI';
import { RefreshCw, ClipboardList } from 'lucide-react';

const ACTION_COLORS = { CREATE: 'text-emerald-400', UPDATE: 'text-brand-400', DELETE: 'text-red-400', STATUS_CHANGE: 'text-amber-400', LOGIN: 'text-violet-400', LOGOUT: 'text-slate-400' };

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', module: '' });

  useEffect(() => { loadLogs(); }, [filters, page]);

  const loadLogs = async () => {
    setLoading(true);
    const params = { page, limit: 50, ...filters };
    if (!params.action) delete params.action;
    if (!params.module) delete params.module;
    const res = await auditAPI.getLogs(params).catch(() => null);
    if (res?.data) { setLogs(res.data); setTotal(res.total || 0); }
    setLoading(false);
  };

  const MODULES = ['Members','Branches','Events','Projects','FinanceContributions','Documents','Sponsors','Assets','Users'];
  const ACTIONS = ['CREATE','UPDATE','DELETE','STATUS_CHANGE','LOGIN','LOGOUT'];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Audit Logs"
        subtitle="Immutable record of all system actions"
        actions={<button onClick={loadLogs} className="btn-secondary btn"><RefreshCw size={15} /></button>}
      />

      <div className="alert-info text-xs">
        <ClipboardList size={14} /> Audit logs are read-only and cannot be modified or deleted.
      </div>

      <div className="card-sm flex flex-wrap gap-3">
        <select value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} className="form-input w-auto">
          <option value="">All Actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.module} onChange={e => setFilters({...filters, module: e.target.value})} className="form-input w-auto">
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? <LoadingState rows={8} /> : logs.length === 0 ? (
        <EmptyState icon="📋" title="No audit logs found" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Record ID</th><th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.log_id}>
                  <td className="text-xs text-slate-500 whitespace-nowrap">{log.timestamp?.replace('T',' ').slice(0,19)}</td>
                  <td className="text-xs text-slate-400">{log.user_email}</td>
                  <td><span className={`text-xs font-mono font-bold ${ACTION_COLORS[log.action] || 'text-slate-400'}`}>{log.action}</span></td>
                  <td className="text-xs text-slate-400">{log.module}</td>
                  <td className="font-mono text-xs text-brand-400">{log.record_id}</td>
                  <td className="text-xs text-slate-600">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
