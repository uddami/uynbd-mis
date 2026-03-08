import { useState, useEffect } from 'react';
import { analyticsAPI } from '../utils/api';
import { ScoreRing, LoadingState, SectionHeader } from '../components/common/UI';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { BarChart3, RefreshCw, Trophy, TrendingUp, Users, Activity } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 11 } } },
    tooltip: { backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleColor: '#e2e8f0', bodyColor: '#94a3b8' },
  },
  scales: {
    x: { ticks: { color: '#475569', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
    y: { ticks: { color: '#475569', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
  },
};

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    const res = await analyticsAPI.getDashboard().catch(() => null);
    if (res?.data) setData(res.data);
    setLoading(false);
  };

  if (loading) return <LoadingState rows={8} />;

  const growthData = data?.member_growth_trend ? {
    labels: data.member_growth_trend.map(d => d.month),
    datasets: [
      {
        label: 'New Members',
        data: data.member_growth_trend.map(d => d.new_members),
        borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.08)',
        fill: true, tension: 0.4, yAxisID: 'y',
      },
      {
        label: 'Cumulative',
        data: data.member_growth_trend.map(d => d.cumulative),
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.05)',
        fill: false, tension: 0.4, yAxisID: 'y1',
        borderDash: [5, 5],
      },
    ],
  } : null;

  const eventTrendData = data?.event_trend ? {
    labels: data.event_trend.map(d => d.month),
    datasets: [
      {
        label: 'Total Events',
        data: data.event_trend.map(d => d.total),
        backgroundColor: 'rgba(139,92,246,0.6)', borderRadius: 6,
      },
      {
        label: 'Completed',
        data: data.event_trend.map(d => d.completed),
        backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 6,
      },
    ],
  } : null;

  const branchScoreData = data?.branch_scores?.slice(0, 10) ? {
    labels: data.branch_scores.slice(0, 10).map(b => b.branch_id),
    datasets: [{
      label: 'Score',
      data: data.branch_scores.slice(0, 10).map(b => b.total_score),
      backgroundColor: data.branch_scores.slice(0, 10).map(b =>
        b.total_score >= 75 ? 'rgba(16,185,129,0.7)' :
        b.total_score >= 50 ? 'rgba(245,158,11,0.7)' : 'rgba(239,68,68,0.7)'
      ),
      borderRadius: 8,
    }],
  } : null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Analytics (UOA)"
        subtitle="Organizational overview and branch performance scores"
        actions={
          <button onClick={loadAnalytics} className="btn-secondary btn">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Members', value: data?.overview?.total_members, icon: Users, color: 'text-brand-400' },
          { label: 'Active Members', value: data?.overview?.active_members, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Branches', value: data?.overview?.total_branches, icon: Activity, color: 'text-violet-400' },
          { label: 'Total Events', value: data?.overview?.total_events, icon: BarChart3, color: 'text-amber-400' },
          { label: 'Participation Rate', value: `${data?.overview?.overall_participation_rate}%`, icon: Trophy, color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-sm text-center">
            <Icon size={18} className={`${color} mx-auto mb-2`} />
            <div className={`text-2xl font-display font-bold ${color}`}>{value ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Branch Performance Score Formula */}
      <div className="card">
        <h3 className="font-display font-bold text-white mb-1">Branch Performance Score Formula</h3>
        <p className="text-slate-500 text-xs mb-4">Score = Member Growth (30%) + Event Activity (25%) + Attendance Rate (20%) + Finance Compliance (15%) + Project Impact (10%)</p>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: 'Member Growth', weight: 30, color: 'bg-brand-500' },
            { label: 'Event Activity', weight: 25, color: 'bg-violet-500' },
            { label: 'Attendance', weight: 20, color: 'bg-emerald-500' },
            { label: 'Finance', weight: 15, color: 'bg-amber-500' },
            { label: 'Projects', weight: 10, color: 'bg-pink-500' },
          ].map(({ label, weight, color }) => (
            <div key={label} className="space-y-1">
              <div className={`h-1.5 rounded-full ${color}`} style={{ opacity: weight / 30 }} />
              <div className="text-xs text-slate-400">{label}</div>
              <div className={`text-sm font-bold text-white`}>{weight}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Branch Scores List */}
      {data?.branch_scores?.length > 0 && (
        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Branch Rankings</h3>
          <div className="space-y-3">
            {data.branch_scores.map((branch, i) => (
              <div
                key={branch.branch_id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/3 cursor-pointer transition-colors"
                onClick={() => setSelectedBranch(selectedBranch === branch.branch_id ? null : branch.branch_id)}
              >
                <div className="text-lg font-display font-black text-slate-600 w-7 text-right">#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm">{branch.branch_id}</div>
                  <div className="text-xs text-slate-500">{branch.member_counts?.active} active members</div>
                </div>
                <ScoreRing score={branch.total_score} size={56} strokeWidth={6} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Branch Breakdown */}
      {selectedBranch && (() => {
        const b = data?.branch_scores?.find(x => x.branch_id === selectedBranch);
        if (!b) return null;
        return (
          <div className="card animate-slide-up">
            <h3 className="font-display font-bold text-white mb-4">Score Breakdown: {selectedBranch}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(b.components).map(([key, comp]) => (
                <div key={key} className="card-sm text-center">
                  <div className="text-xs text-slate-500 mb-2 capitalize">{key.replace(/_/g, ' ')}</div>
                  <div className="text-2xl font-display font-bold text-white mb-1">{comp.score}</div>
                  <div className="text-xs text-slate-600">Weight: {comp.weight}%</div>
                  <div className="mt-2 h-1 rounded-full bg-slate-700">
                    <div
                      className="h-1 rounded-full bg-brand-500 transition-all duration-700"
                      style={{ width: `${comp.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Member Growth Trend</h3>
          <div style={{ height: '220px' }}>
            {growthData ? (
              <Line data={growthData} options={{
                ...CHART_OPTS,
                scales: {
                  ...CHART_OPTS.scales,
                  y: { ...CHART_OPTS.scales.y, position: 'left' },
                  y1: { ...CHART_OPTS.scales.y, position: 'right', grid: { drawOnChartArea: false } },
                },
              }} />
            ) : <div className="flex items-center justify-center h-full text-slate-600 text-sm">No data</div>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Event Activity Trend</h3>
          <div style={{ height: '220px' }}>
            {eventTrendData ? (
              <Bar data={eventTrendData} options={CHART_OPTS} />
            ) : <div className="flex items-center justify-center h-full text-slate-600 text-sm">No data</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-display font-bold text-white mb-4">Branch Performance Comparison</h3>
        <div style={{ height: '260px' }}>
          {branchScoreData ? (
            <Bar data={branchScoreData} options={{ ...CHART_OPTS, scales: { ...CHART_OPTS.scales, y: { ...CHART_OPTS.scales.y, min: 0, max: 100 } } }} />
          ) : <div className="flex items-center justify-center h-full text-slate-600 text-sm">No branch data</div>}
        </div>
      </div>
    </div>
  );
}
