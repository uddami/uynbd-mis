import { useState, useEffect } from 'react';
import { financeAPI, membersAPI, branchesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, StatusBadge, LoadingState, SectionHeader, EmptyState } from '../components/common/UI';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { PlusCircle, RefreshCw, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FinancePage() {
  const { can } = useAuth();
  const [records, setRecords] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [form, setForm] = useState({ member_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: '', payment_method: 'cash', notes: '' });
  const [filters, setFilters] = useState({ branch_id: '', month: '', year: new Date().getFullYear() });
  const [branches, setBranches] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBranches();
    loadData();
  }, []);

  useEffect(() => { loadData(); }, [filters]);

  const loadBranches = async () => {
    const res = await branchesAPI.getAll({ limit: 100 }).catch(() => null);
    if (res?.data) setBranches(res.data);
  };

  const loadData = async () => {
    setLoading(true);
    const [recs, dash] = await Promise.all([
      financeAPI.getAll({ ...filters, limit: 100 }).catch(() => null),
      financeAPI.getDashboard({ year: filters.year, branch_id: filters.branch_id }).catch(() => null),
    ]);
    if (recs?.data) setRecords(recs.data);
    if (dash?.data) setDashboard(dash.data);
    setLoading(false);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await financeAPI.recordPayment(form);
      toast.success('Payment recorded!');
      setShowPaymentModal(false);
      loadData();
    } finally { setSubmitting(false); }
  };

  const chartData = dashboard?.monthly_totals ? {
    labels: dashboard.monthly_totals.map(m => MONTHS[m.month - 1]),
    datasets: [{
      label: 'Amount Collected (৳)',
      data: dashboard.monthly_totals.map(m => m.total),
      backgroundColor: 'rgba(14,165,233,0.6)',
      borderRadius: 6,
    }],
  } : null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Finance Dashboard"
        subtitle="Monthly contributions and payment tracking"
        actions={
          <div className="flex gap-2">
            {can('finance', 'write') && (
              <button onClick={() => setShowPaymentModal(true)} className="btn-primary btn">
                <PlusCircle size={16} /> Record Payment
              </button>
            )}
            <button onClick={loadData} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected', value: `৳${(dashboard?.total_collected || 0).toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Paid Members', value: dashboard?.status_breakdown?.paid || 0, color: 'text-emerald-400' },
          { label: 'Late Members', value: dashboard?.status_breakdown?.late || 0, color: 'text-amber-400' },
          { label: 'Suspension Review', value: dashboard?.status_breakdown?.suspension_review || 0, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-sm text-center">
            <div className={`text-2xl font-display font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData && (
        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Monthly Collections — {filters.year}</h3>
          <div style={{ height: '200px' }}>
            <Bar data={chartData} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#94a3b8' } }, tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } },
              scales: { x: { ticks: { color: '#475569' }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#475569' }, grid: { color: 'rgba(255,255,255,0.03)' } } },
            }} />
          </div>
        </div>
      )}

      {/* Filters + Records */}
      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.branch_id} onChange={e => setFilters({...filters, branch_id: e.target.value})} className="form-input w-auto">
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
          <select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})} className="form-input w-auto">
            <option value="">All Months</option>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} className="form-input w-28" placeholder="Year" />
        </div>

        {loading ? <LoadingState rows={5} /> : records.length === 0 ? (
          <EmptyState icon="💰" title="No payment records" subtitle="Record contributions using the button above" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member ID</th><th>Branch</th><th>Month/Year</th>
                  <th>Amount</th><th>Method</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-brand-400 text-xs">{r.member_id}</td>
                    <td>{r.branch_id}</td>
                    <td>{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="text-emerald-400 font-medium">৳{Number(r.amount).toLocaleString()}</td>
                    <td className="capitalize text-slate-400">{r.payment_method}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-slate-500 text-xs">{r.payment_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" size="sm">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Member ID (Uddami ID)</label>
            <input className="form-input" value={form.member_id}
              onChange={e => setForm({...form, member_id: e.target.value})}
              placeholder="UYNBD-2024-0001" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Month</label>
              <select className="form-input" value={form.month} onChange={e => setForm({...form, month: e.target.value})}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" value={form.year}
                onChange={e => setForm({...form, year: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (৳)</label>
            <input className="form-input" type="number" value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-input" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
              {['cash','bank_transfer','mobile_banking','cheque'].map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Recording...' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
