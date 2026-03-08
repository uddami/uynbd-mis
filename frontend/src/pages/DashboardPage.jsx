import { useState, useEffect } from 'react';
import { membersAPI, eventsAPI, financeAPI, analyticsAPI } from '../utils/api';
import { StatWidget, LoadingState, Alert } from '../components/common/UI';
import { useAuth } from '../context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Users, GitBranch, CalendarDays, FolderKanban, TrendingUp, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 } } },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
    },
  },
  scales: {
    x: { ticks: { color: '#475569' }, grid: { color: 'rgba(255,255,255,0.03)' } },
    y: { ticks: { color: '#475569' }, grid: { color: 'rgba(255,255,255,0.03)' } },
  },
};

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [eventStats, setEventStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [memberStats, eventData, analyticsData] = await Promise.all([
        membersAPI.getStats().catch(() => null),
        eventsAPI.getStats().catch(() => null),
        can('analytics') ? analyticsAPI.getDashboard().catch(() => null) : null,
      ]);

      if (memberStats?.data) setStats(memberStats.data);
      if (eventData?.data) setEventStats(eventData.data);
      if (analyticsData?.data) setAnalytics(analyticsData.data);

      // Build system alerts
      const systemAlerts = [];
      if (memberStats?.data?.inactive_members > 0) {
        systemAlerts.push({
          type: 'warning',
          message: `${memberStats.data.inactive_members} members have inactive finance status`,
        });
      }
      if (memberStats?.data?.probation_members > 0) {
        systemAlerts.push({
          type: 'info',
          message: `${memberStats.data.probation_members} members in probation period`,
        });
      }
      setAlerts(systemAlerts);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <LoadingState rows={3} />
    </div>
  );

  // ── Growth Chart Data ──
  const growthChartData = stats?.monthly_growth ? {
    labels: stats.monthly_growth.map(d => d.month),
    datasets: [{
      label: 'New Members',
      data: stats.monthly_growth.map(d => d.count),
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14, 165, 233, 0.08)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#0ea5e9',
      pointRadius: 4,
    }],
  } : null;

  // ── Event Activity Chart ──
  const eventChartData = eventStats?.monthly_activity ? {
    labels: eventStats.monthly_activity.map(d => d.month),
    datasets: [{
      label: 'Events',
      data: eventStats.monthly_activity.map(d => d.count),
      backgroundColor: 'rgba(14, 165, 233, 0.6)',
      borderColor: '#0ea5e9',
      borderRadius: 6,
    }],
  } : null;

  // ── Member Status Donut ──
  const statusChartData = stats?.status_breakdown ? {
    labels: ['Active', 'Probation', 'Inactive', 'Alumni', 'Suspended'],
    datasets: [{
      data: [
        stats.status_breakdown.active || 0,
        stats.status_breakdown.probation || 0,
        stats.status_breakdown.inactive || 0,
        stats.status_breakdown.alumni || 0,
        stats.status_breakdown.suspended || 0,
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#f97316'],
      borderColor: '#0f172a',
      borderWidth: 3,
    }],
  } : null;

  // ── Branch Performance Chart ──
  const branchScoreData = analytics?.branch_scores?.slice(0, 8) ? {
    labels: analytics.branch_scores.slice(0, 8).map(b => b.branch_id),
    datasets: [{
      label: 'Performance Score',
      data: analytics.branch_scores.slice(0, 8).map(b => b.total_score),
      backgroundColor: analytics.branch_scores.slice(0, 8).map(b =>
        b.total_score >= 75 ? 'rgba(16, 185, 129, 0.6)' :
        b.total_score >= 50 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)'
      ),
      borderRadius: 6,
    }],
  } : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">
          Welcome back, {user?.member_name?.split(' ')[0] || 'Admin'} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')} · Uddami Youth Network Bangladesh
        </p>
      </div>

      {/* System Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Alert key={i} type={alert.type} message={alert.message} />
          ))}
        </div>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatWidget
          title="Total Members" value={stats?.total_members || 0}
          subtitle={`${stats?.probation_members || 0} in probation`}
          icon={Users} color="brand"
        />
        <StatWidget
          title="Active Members" value={stats?.active_members || 0}
          subtitle={`${stats?.participation_rate || 0}% participation rate`}
          icon={TrendingUp} color="emerald"
        />
        <StatWidget
          title="Total Events" value={eventStats?.total_events || 0}
          subtitle={`${eventStats?.upcoming || 0} upcoming`}
          icon={CalendarDays} color="violet"
        />
        <StatWidget
          title="Total Branches" value={analytics?.overview?.total_branches || 0}
          subtitle={`${analytics?.overview?.total_projects || 0} active projects`}
          icon={GitBranch} color="blue"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Member Growth Chart */}
        <div className="lg:col-span-2 card">
          <h3 className="font-display font-bold text-white mb-4">Member Growth (12 Months)</h3>
          <div style={{ height: '220px' }}>
            {growthChartData ? (
              <Line data={growthChartData} options={CHART_DEFAULTS} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Member Status Donut */}
        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Member Status</h3>
          <div style={{ height: '220px' }} className="flex items-center justify-center">
            {statusChartData ? (
              <Doughnut
                data={statusChartData}
                options={{ ...CHART_DEFAULTS, cutout: '70%', scales: undefined }}
              />
            ) : (
              <div className="text-slate-600 text-sm">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Event Activity */}
        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Event Activity (12 Months)</h3>
          <div style={{ height: '200px' }}>
            {eventChartData ? (
              <Bar data={eventChartData} options={CHART_DEFAULTS} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Branch Performance */}
        <div className="card">
          <h3 className="font-display font-bold text-white mb-4">Top Branch Performance Scores</h3>
          <div style={{ height: '200px' }}>
            {branchScoreData ? (
              <Bar
                data={branchScoreData}
                options={{
                  ...CHART_DEFAULTS,
                  scales: {
                    ...CHART_DEFAULTS.scales,
                    y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100 },
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                {can('analytics') ? 'No branch data' : 'Analytics access required'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-sm text-center">
          <div className="text-2xl font-display font-bold text-amber-400">{stats?.inactive_members || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Inactive Members</div>
        </div>
        <div className="card-sm text-center">
          <div className="text-2xl font-display font-bold text-blue-400">{stats?.alumni_members || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Alumni</div>
        </div>
        <div className="card-sm text-center">
          <div className="text-2xl font-display font-bold text-emerald-400">{stats?.participation_rate || 0}%</div>
          <div className="text-xs text-slate-500 mt-1">Participation Rate</div>
        </div>
        <div className="card-sm text-center">
          <div className="text-2xl font-display font-bold text-orange-400">{stats?.suspended_members || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Suspended</div>
        </div>
      </div>
    </div>
  );
}
