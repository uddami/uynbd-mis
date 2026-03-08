/**
 * UYNBD MIS - Analytics Controller (UOA)
 * 
 * Branch Performance Score Formula:
 * Score = Member Growth (30%) + Event Activity (25%) + Attendance Rate (20%)
 *         + Finance Compliance (15%) + Project Impact (10%)
 * 
 * Each component is normalized to 0-100, then weighted.
 */

const { readSheet, findMany } = require('../services/sheets.service');
const { format, subMonths, parseISO, differenceInMonths } = require('date-fns');

// ─── Calculate Branch Performance Score ───────────────────────────────────────
const calculateBranchScore = async (branchId, allMembers, allEvents, allAttendance, allFinance, allProjects) => {
  const branchMembers = allMembers.filter(m => m.branch_id === branchId && m.status !== 'deleted');
  const activeMembers = branchMembers.filter(m => m.status === 'active');

  // 1. Member Growth (30%) — new members in last 6 months vs previous 6 months
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6);
  const twelveMonthsAgo = subMonths(now, 12);

  const recentGrowth = branchMembers.filter(m =>
    m.joining_date && parseISO(m.joining_date) >= sixMonthsAgo
  ).length;
  const prevGrowth = branchMembers.filter(m =>
    m.joining_date && parseISO(m.joining_date) >= twelveMonthsAgo && parseISO(m.joining_date) < sixMonthsAgo
  ).length;

  const growthRate = prevGrowth === 0
    ? (recentGrowth > 0 ? 100 : 50)
    : Math.min(100, ((recentGrowth - prevGrowth) / prevGrowth + 1) * 50);

  // 2. Event Activity (25%) — events hosted by or involving this branch (last 6 months)
  const branchEvents = allEvents.filter(e => {
    const isHosted = e.hosted_by_branch === branchId;
    const isInvited = e.expected_branches?.includes(branchId);
    const isRecent = e.hosting_date && parseISO(e.hosting_date) >= sixMonthsAgo;
    return (isHosted || isInvited) && isRecent && e.status !== 'deleted';
  });
  const eventActivityScore = Math.min(100, branchEvents.length * 10); // 10 events = 100%

  // 3. Attendance Rate (20%)
  const branchAttendance = allAttendance.filter(a => a.branch_id === branchId);
  const totalAtt = branchAttendance.length;
  const presentAtt = branchAttendance.filter(a => a.attendance_status === 'present').length;
  const attendanceRate = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 50;

  // 4. Finance Compliance (15%)
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const branchFinance = allFinance.filter(f =>
    f.branch_id === branchId &&
    Number(f.month) === currentMonth &&
    Number(f.year) === currentYear
  );
  const financeCompliance = activeMembers.length > 0
    ? Math.min(100, (branchFinance.filter(f => f.status === 'paid').length / activeMembers.length) * 100)
    : 50;

  // 5. Project Impact (10%)
  const branchProjects = allProjects.filter(p =>
    p.branch_id === branchId && ['completed', 'ongoing'].includes(p.status)
  );
  const projectScore = Math.min(100, branchProjects.length * 20); // 5 projects = 100%

  // Weighted total
  const totalScore =
    (growthRate * 0.30) +
    (eventActivityScore * 0.25) +
    (attendanceRate * 0.20) +
    (financeCompliance * 0.15) +
    (projectScore * 0.10);

  return {
    branch_id: branchId,
    total_score: Math.round(totalScore),
    components: {
      member_growth: { score: Math.round(growthRate), weight: 30, raw_recent: recentGrowth, raw_prev: prevGrowth },
      event_activity: { score: Math.round(eventActivityScore), weight: 25, events_count: branchEvents.length },
      attendance_rate: { score: Math.round(attendanceRate), weight: 20, present: presentAtt, total: totalAtt },
      finance_compliance: { score: Math.round(financeCompliance), weight: 15, paid: branchFinance.filter(f => f.status === 'paid').length, total: activeMembers.length },
      project_impact: { score: Math.round(projectScore), weight: 10, projects_count: branchProjects.length },
    },
    member_counts: {
      active: activeMembers.length,
      total: branchMembers.length,
    },
  };
};

// ─── Main Analytics Dashboard ──────────────────────────────────────────────────
const getAnalyticsDashboard = async (req, res) => {
  try {
    const [members, branches, events, attendance, finance, projects] = await Promise.all([
      readSheet('Members'),
      readSheet('Branches'),
      readSheet('Events'),
      readSheet('EventAttendees'),
      readSheet('FinanceContributions'),
      readSheet('Projects'),
    ]);

    const activeBranches = branches.filter(b => b.status === 'active');

    // Branch scores
    const branchScores = await Promise.all(
      activeBranches.map(b =>
        calculateBranchScore(b.branch_id, members, events, attendance, finance, projects)
      )
    );

    // Overall participation rate
    const totalAttendance = attendance.length;
    const totalPresent = attendance.filter(a => a.attendance_status === 'present').length;
    const overallParticipationRate = totalAttendance > 0
      ? Math.round((totalPresent / totalAttendance) * 100) : 0;

    // Member growth trend (12 months)
    const now = new Date();
    const growthTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(d, 'yyyy-MM');
      const newMembers = members.filter(m => m.joining_date?.startsWith(monthStr)).length;
      const cumulativeActive = members.filter(m =>
        m.joining_date && m.joining_date <= `${monthStr}-31` && m.status !== 'deleted'
      ).length;
      growthTrend.push({
        month: format(d, 'MMM yyyy'),
        new_members: newMembers,
        cumulative: cumulativeActive,
      });
    }

    // Active vs Inactive breakdown
    const memberStatusBreakdown = members
      .filter(m => m.status !== 'deleted')
      .reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {});

    // Event activity over time
    const eventTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(d, 'yyyy-MM');
      const monthEvents = events.filter(e =>
        e.hosting_date?.startsWith(monthStr) && e.status !== 'deleted'
      );
      eventTrend.push({
        month: format(d, 'MMM yyyy'),
        total: monthEvents.length,
        completed: monthEvents.filter(e => e.status === 'completed').length,
      });
    }

    res.json({
      success: true,
      data: {
        overview: {
          total_members: members.filter(m => ['active', 'probation'].includes(m.status)).length,
          active_members: memberStatusBreakdown.active || 0,
          total_branches: activeBranches.length,
          total_events: events.filter(e => e.status !== 'deleted').length,
          total_projects: projects.filter(p => p.status !== 'deleted').length,
          overall_participation_rate: overallParticipationRate,
        },
        branch_scores: branchScores.sort((a, b) => b.total_score - a.total_score),
        member_growth_trend: growthTrend,
        member_status_breakdown: memberStatusBreakdown,
        event_trend: eventTrend,
      },
    });
  } catch (error) {
    console.error('[Analytics] Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load analytics: ' + error.message });
  }
};

// ─── Get Branch Analytics ──────────────────────────────────────────────────────
const getBranchAnalytics = async (req, res) => {
  try {
    const { branch_id } = req.params;
    const [members, events, attendance, finance, projects] = await Promise.all([
      readSheet('Members'),
      readSheet('Events'),
      readSheet('EventAttendees'),
      readSheet('FinanceContributions'),
      readSheet('Projects'),
    ]);

    const score = await calculateBranchScore(branch_id, members, events, attendance, finance, projects);
    res.json({ success: true, data: score });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get branch analytics' });
  }
};

// ─── Get Audit Logs ────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const { user_id, module, action, from_date, to_date, page = 1, limit = 50 } = req.query;

    let logs = await readSheet('AuditLogs');

    if (user_id) logs = logs.filter(l => l.user_id === user_id);
    if (module) logs = logs.filter(l => l.module === module);
    if (action) logs = logs.filter(l => l.action === action);
    if (from_date) logs = logs.filter(l => l.timestamp >= from_date);
    if (to_date) logs = logs.filter(l => l.timestamp <= to_date);

    logs.sort((a, b) => b.timestamp?.localeCompare(a.timestamp));

    const total = logs.length;
    const paginated = logs.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: paginated, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

module.exports = { getAnalyticsDashboard, getBranchAnalytics, getAuditLogs, calculateBranchScore };
