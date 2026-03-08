/**
 * UYNBD MIS - Finance Controller
 * 
 * Monthly contribution tracking with automatic status calculation:
 * - Paid: up to date
 * - Late: 2 months behind
 * - Inactive: 3 months behind (also updates member status)
 * - Suspension Review: 4+ months behind
 * 
 * Finance Director can record payments but cannot delete records.
 */

const { readSheet, findOne, findMany, insertRow, updateRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { format, parseISO, differenceInMonths, subMonths } = require('date-fns');

// ─── Calculate Payment Status for a Member ────────────────────────────────────
/**
 * Determines the finance status of a member based on unpaid months.
 * @param {string} memberId
 * @returns {Object} { status, months_behind, last_paid_month }
 */
const calculateFinanceStatus = async (memberId) => {
  const contributions = await findMany('FinanceContributions', { member_id: memberId });
  const member = await findOne('Members', 'uddami_id', memberId);
  if (!member) return null;

  const joinDate = member.joining_date ? parseISO(member.joining_date) : new Date();
  const today = new Date();
  const totalMonthsExpected = differenceInMonths(today, joinDate) + 1;

  // Get paid months
  const paidMonths = new Set(
    contributions
      .filter(c => c.status === 'paid')
      .map(c => `${c.year}-${String(c.month).padStart(2, '0')}`)
  );

  // Count consecutive unpaid months from latest
  let monthsBehind = 0;
  let checkDate = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let i = 0; i < 12; i++) {
    const key = format(checkDate, 'yyyy-MM');
    const joinMonthKey = format(joinDate, 'yyyy-MM');
    if (key < joinMonthKey) break; // Don't count before joining
    if (!paidMonths.has(key)) {
      monthsBehind++;
      checkDate = subMonths(checkDate, 1);
    } else {
      break;
    }
  }

  // Determine status
  let status = 'paid';
  if (monthsBehind >= 4) status = 'suspension_review';
  else if (monthsBehind === 3) status = 'inactive';
  else if (monthsBehind === 2) status = 'late';
  else if (monthsBehind === 1) status = 'late'; // 1 month still late

  const lastPaid = contributions
    .filter(c => c.status === 'paid')
    .sort((a, b) => {
      const aKey = `${a.year}-${String(a.month).padStart(2, '0')}`;
      const bKey = `${b.year}-${String(b.month).padStart(2, '0')}`;
      return bKey.localeCompare(aKey);
    })[0];

  return {
    status,
    months_behind: monthsBehind,
    last_paid_month: lastPaid ? `${lastPaid.year}-${lastPaid.month}` : null,
    total_paid: contributions.filter(c => c.status === 'paid').length,
    total_amount: contributions.reduce((s, c) => s + Number(c.amount || 0), 0),
  };
};

// ─── Get All Finance Records ───────────────────────────────────────────────────
const getFinanceRecords = async (req, res) => {
  try {
    const { member_id, branch_id, month, year, status, page = 1, limit = 100 } = req.query;

    let records = await readSheet('FinanceContributions');

    if (member_id) records = records.filter(r => r.member_id === member_id);
    if (branch_id) records = records.filter(r => r.branch_id === branch_id);
    if (month) records = records.filter(r => String(r.month) === String(month));
    if (year) records = records.filter(r => String(r.year) === String(year));
    if (status) records = records.filter(r => r.status === status);

    const total = records.length;
    const paginated = records.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: paginated, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch finance records' });
  }
};

// ─── Record a Payment ──────────────────────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const { member_id, month, year, amount, payment_date, payment_method, receipt_url, notes } = req.body;

    if (!member_id || !month || !year || !amount) {
      return res.status(400).json({ success: false, message: 'Required: member_id, month, year, amount' });
    }

    const member = await findOne('Members', 'uddami_id', member_id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    // Check for duplicate payment (same member, month, year)
    const existing = await readSheet('FinanceContributions');
    const duplicate = existing.find(r =>
      r.member_id === member_id &&
      String(r.month) === String(month) &&
      String(r.year) === String(year)
    );

    if (duplicate && duplicate.status === 'paid') {
      return res.status(400).json({ success: false, message: `Payment already recorded for ${month}/${year}` });
    }

    const record = {
      id: generateId('FIN'),
      member_id,
      branch_id: member.branch_id,
      month: String(month),
      year: String(year),
      amount: String(amount),
      payment_date: payment_date || format(new Date(), 'yyyy-MM-dd'),
      payment_method: payment_method || 'cash',
      receipt_url: receipt_url || '',
      status: 'paid',
      notes: notes || '',
      recorded_by: req.user.user_id,
      created_at: new Date().toISOString(),
    };

    await insertRow('FinanceContributions', record);

    // Auto-update member status if they were inactive/suspended
    const financeStatus = await calculateFinanceStatus(member_id);
    if (financeStatus && member.status === 'inactive' && financeStatus.months_behind < 3) {
      await updateRow('Members', 'uddami_id', member_id, { status: 'active' });
    }

    await auditLog(req, 'CREATE', 'FinanceContributions', record.id, null, record);

    res.status(201).json({ success: true, data: record, finance_status: financeStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record payment: ' + error.message });
  }
};

// ─── Get Member Finance Status ─────────────────────────────────────────────────
const getMemberFinanceStatus = async (req, res) => {
  try {
    const { uddami_id } = req.params;
    const status = await calculateFinanceStatus(uddami_id);
    if (!status) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to calculate finance status' });
  }
};

// ─── Run Finance Status Auto-Update (cron-style) ──────────────────────────────
const runFinanceStatusUpdate = async (req, res) => {
  try {
    const members = await readSheet('Members');
    const activeMembers = members.filter(m => ['active', 'inactive', 'probation'].includes(m.status));
    const updates = [];

    for (const member of activeMembers) {
      const finStatus = await calculateFinanceStatus(member.uddami_id);
      if (!finStatus) continue;

      let newMemberStatus = member.status;
      if (finStatus.status === 'inactive' && member.status === 'active') {
        newMemberStatus = 'inactive';
      } else if (finStatus.status === 'suspension_review') {
        newMemberStatus = 'suspended';
      } else if (finStatus.status === 'paid' && member.status === 'inactive') {
        newMemberStatus = 'active';
      }

      if (newMemberStatus !== member.status) {
        await updateRow('Members', 'uddami_id', member.uddami_id, { status: newMemberStatus });
        updates.push({ member_id: member.uddami_id, old_status: member.status, new_status: newMemberStatus });
      }
    }

    res.json({ success: true, updated_count: updates.length, updates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Finance update run failed: ' + error.message });
  }
};

// ─── Finance Dashboard Summary ─────────────────────────────────────────────────
const getFinanceDashboard = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), branch_id } = req.query;

    let contributions = await readSheet('FinanceContributions');
    if (branch_id) contributions = contributions.filter(c => c.branch_id === branch_id);

    const yearContribs = contributions.filter(c => String(c.year) === String(year));

    // Monthly totals
    const monthlyTotals = {};
    for (let m = 1; m <= 12; m++) {
      const monthRecords = yearContribs.filter(c => String(c.month) === String(m));
      monthlyTotals[m] = {
        month: m,
        count: monthRecords.length,
        total: monthRecords.reduce((s, c) => s + Number(c.amount || 0), 0),
      };
    }

    // Status breakdown
    const members = await readSheet('Members');
    const activeMembers = members.filter(m => m.status === 'active' && (branch_id ? m.branch_id === branch_id : true));

    let paidCount = 0, lateCount = 0, inactiveCount = 0, suspensionCount = 0;
    for (const member of activeMembers.slice(0, 100)) { // Sample for performance
      const fs = await calculateFinanceStatus(member.uddami_id);
      if (!fs) continue;
      if (fs.status === 'paid') paidCount++;
      else if (fs.status === 'late') lateCount++;
      else if (fs.status === 'inactive') inactiveCount++;
      else if (fs.status === 'suspension_review') suspensionCount++;
    }

    res.json({
      success: true,
      data: {
        year: Number(year),
        total_collected: yearContribs.reduce((s, c) => s + Number(c.amount || 0), 0),
        monthly_totals: Object.values(monthlyTotals),
        status_breakdown: { paid: paidCount, late: lateCount, inactive: inactiveCount, suspension_review: suspensionCount },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load finance dashboard' });
  }
};

module.exports = {
  getFinanceRecords, recordPayment, getMemberFinanceStatus,
  runFinanceStatusUpdate, getFinanceDashboard, calculateFinanceStatus,
};
