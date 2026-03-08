/**
 * UYNBD MIS - Members Controller (UMLT)
 * 
 * Member lifecycle: Application → Probation (3 months) → Active → Alumni
 * 
 * STATUS RULES:
 * - applicant: just applied
 * - probation: accepted, within 3-month probation period
 * - active: full member
 * - inactive: missed contributions (auto-set by finance service)
 * - suspended: administrative suspension
 * - alumni: left the organization (can rejoin)
 * - deleted: soft-deleted
 * 
 * FINANCE STATUS:
 * - paid: up to date
 * - late: 2 months behind
 * - inactive: 3 months behind
 * - suspension_review: 4+ months behind
 */

const {
  readSheet, findOne, findMany, insertRow, updateRow,
  softDeleteRow, hardDeleteRow, generateUddamiId, generateId
} = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { differenceInMonths, differenceInYears, parseISO, addMonths, format } = require('date-fns');

// ─── Get All Members (with filters) ───────────────────────────────────────────
const getMembers = async (req, res) => {
  try {
    const { status, branch_id, search, page = 1, limit = 50 } = req.query;

    let members = await readSheet('Members');

    // Branch chiefs only see their branch
    if (req.user.role === 'branch_chief') {
      members = members.filter(m => m.branch_id === req.user.branch_id);
    }

    // Apply filters
    if (status) members = members.filter(m => m.status === status);
    if (branch_id) members = members.filter(m => m.branch_id === branch_id);
    if (search) {
      const q = search.toLowerCase();
      members = members.filter(m =>
        m.full_name?.toLowerCase().includes(q) ||
        m.uddami_id?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.email?.toLowerCase().includes(q)
      );
    }

    // Exclude deleted
    members = members.filter(m => m.status !== 'deleted');

    // Pagination
    const total = members.length;
    const startIdx = (page - 1) * limit;
    const paginated = members.slice(startIdx, startIdx + Number(limit));

    // Enrich with roles
    const roles = await readSheet('MemberRoles');
    const enriched = paginated.map(m => ({
      ...m,
      current_roles: roles.filter(r => r.member_id === m.uddami_id && r.is_active === 'true'),
    }));

    res.json({ success: true, data: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('[Members] getMembers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch members' });
  }
};

// ─── Get Single Member Profile ─────────────────────────────────────────────────
const getMember = async (req, res) => {
  try {
    const { uddami_id } = req.params;
    const member = await findOne('Members', 'uddami_id', uddami_id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    // Fetch related data
    const [roles, attendance, finance, transfers] = await Promise.all([
      findMany('MemberRoles', { member_id: uddami_id }),
      findMany('MemberAttendance', { member_id: uddami_id }),
      findMany('FinanceContributions', { member_id: uddami_id }),
      findMany('MemberTransfers', { member_id: uddami_id }),
    ]);

    // Calculate service period
    const joinDate = member.joining_date ? parseISO(member.joining_date) : new Date();
    const servicePeriodMonths = differenceInMonths(new Date(), joinDate);
    const servicePeriodYears = differenceInYears(new Date(), joinDate);

    // Calculate attendance stats
    const totalEvents = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const participationRate = totalEvents > 0 ? Math.round((presentCount / totalEvents) * 100) : 0;

    // Age check
    const dob = member.date_of_birth ? parseISO(member.date_of_birth) : null;
    const age = dob ? differenceInYears(new Date(), dob) : null;

    res.json({
      success: true,
      data: {
        ...member,
        age,
        service_period_months: servicePeriodMonths,
        service_period_years: servicePeriodYears,
        roles,
        attendance_records: attendance.slice(-20), // last 20
        finance_contributions: finance,
        transfer_history: transfers,
        stats: {
          total_events: totalEvents,
          present_count: presentCount,
          participation_rate: participationRate,
          total_contributions: finance.reduce((sum, f) => sum + Number(f.amount || 0), 0),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch member' });
  }
};

// ─── Create New Member ─────────────────────────────────────────────────────────
const createMember = async (req, res) => {
  try {
    const {
      full_name, phone, email, date_of_birth, gender, address,
      emergency_contact, photo_url, branch_id, unit_id,
      national_id, occupation, education, skills, notes,
      initial_role
    } = req.body;

    // Validation
    if (!full_name || !phone || !date_of_birth || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'Required: full_name, phone, date_of_birth, branch_id'
      });
    }

    // Age check (minimum 13)
    const dob = parseISO(date_of_birth);
    const age = differenceInYears(new Date(), dob);
    if (age < 13) {
      return res.status(400).json({ success: false, message: 'Minimum age to join is 13 years' });
    }

    // Verify branch has capacity (or is being formed)
    const branchMembers = await findMany('Members', { branch_id, status: 'active' });

    const year = new Date().getFullYear();
    const uddami_id = await generateUddamiId(year);
    const joining_date = format(new Date(), 'yyyy-MM-dd');
    const probation_end_date = format(addMonths(new Date(), 3), 'yyyy-MM-dd');

    const newMember = {
      uddami_id,
      full_name: full_name.trim(),
      phone: phone.trim(),
      email: (email || '').trim().toLowerCase(),
      date_of_birth,
      gender: gender || '',
      address: address || '',
      emergency_contact: emergency_contact || '',
      photo_url: photo_url || '',
      branch_id,
      unit_id: unit_id || '',
      status: 'probation',
      joining_date,
      probation_end_date,
      alumni_date: '',
      national_id: national_id || '',
      occupation: occupation || '',
      education: education || '',
      skills: skills || '',
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: req.user.user_id,
    };

    await insertRow('Members', newMember);

    // Add initial role if provided
    if (initial_role) {
      await insertRow('MemberRoles', {
        id: generateId('ROL'),
        member_id: uddami_id,
        role_title: initial_role,
        role_type: 'branch',
        branch_id,
        start_date: joining_date,
        end_date: '',
        is_active: 'true',
        assigned_by: req.user.user_id,
        created_at: new Date().toISOString(),
      });
    }

    await auditLog(req, 'CREATE', 'Members', uddami_id, null, newMember);

    res.status(201).json({ success: true, data: newMember, message: `Member created with ID: ${uddami_id}` });
  } catch (error) {
    console.error('[Members] createMember error:', error);
    res.status(500).json({ success: false, message: 'Failed to create member: ' + error.message });
  }
};

// ─── Update Member ─────────────────────────────────────────────────────────────
const updateMember = async (req, res) => {
  try {
    const { uddami_id } = req.params;

    // PROTECTED FIELDS - cannot be edited
    const protectedFields = ['uddami_id', 'joining_date'];
    const updates = { ...req.body };
    protectedFields.forEach(f => delete updates[f]);

    const existing = await findOne('Members', 'uddami_id', uddami_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' });

    const updated = await updateRow('Members', 'uddami_id', uddami_id, updates);
    await auditLog(req, 'UPDATE', 'Members', uddami_id, existing, updates);

    res.json({ success: true, data: updated, message: 'Member updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update member' });
  }
};

// ─── Promote Member (Probation → Active) ──────────────────────────────────────
const promoteMember = async (req, res) => {
  try {
    const { uddami_id } = req.params;
    const member = await findOne('Members', 'uddami_id', uddami_id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    if (member.status !== 'probation') {
      return res.status(400).json({ success: false, message: 'Only probation members can be promoted' });
    }

    const updated = await updateRow('Members', 'uddami_id', uddami_id, {
      status: 'active',
      updated_at: new Date().toISOString(),
    });

    await auditLog(req, 'STATUS_CHANGE', 'Members', uddami_id, { status: 'probation' }, { status: 'active' }, 'Probation completed, promoted to active');

    res.json({ success: true, data: updated, message: 'Member promoted to Active' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to promote member' });
  }
};

// ─── Transfer Member to Another Branch ────────────────────────────────────────
const transferMember = async (req, res) => {
  try {
    const { uddami_id } = req.params;
    const { to_branch_id, reason } = req.body;

    const member = await findOne('Members', 'uddami_id', uddami_id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    // Record transfer history
    const transfer = {
      id: generateId('TRF'),
      member_id: uddami_id,
      from_branch: member.branch_id,
      to_branch: to_branch_id,
      transfer_date: format(new Date(), 'yyyy-MM-dd'),
      reason: reason || '',
      approved_by: req.user.user_id,
      created_at: new Date().toISOString(),
    };

    await insertRow('MemberTransfers', transfer);
    await updateRow('Members', 'uddami_id', uddami_id, { branch_id: to_branch_id });
    await auditLog(req, 'UPDATE', 'MemberTransfers', uddami_id, { branch_id: member.branch_id }, { branch_id: to_branch_id }, reason);

    res.json({ success: true, message: 'Member transferred successfully', data: transfer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to transfer member' });
  }
};

// ─── Assign Role to Member ─────────────────────────────────────────────────────
const assignRole = async (req, res) => {
  try {
    const { uddami_id } = req.params;
    const { role_title, role_type, branch_id } = req.body;

    // Check max 2 active roles
    const activeRoles = await findMany('MemberRoles', { member_id: uddami_id, is_active: 'true' });
    if (activeRoles.length >= 2) {
      return res.status(400).json({ success: false, message: 'Member can have maximum 2 active roles' });
    }

    const role = {
      id: generateId('ROL'),
      member_id: uddami_id,
      role_title,
      role_type: role_type || 'branch',
      branch_id: branch_id || '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      is_active: 'true',
      assigned_by: req.user.user_id,
      created_at: new Date().toISOString(),
    };

    await insertRow('MemberRoles', role);
    await auditLog(req, 'CREATE', 'MemberRoles', uddami_id, null, role);

    res.status(201).json({ success: true, data: role, message: 'Role assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to assign role' });
  }
};

// ─── Get Member Dashboard Stats ────────────────────────────────────────────────
const getMemberStats = async (req, res) => {
  try {
    const members = await readSheet('Members');
    const activeMembersData = members.filter(m => m.status !== 'deleted');

    // Group by status
    const statusCounts = activeMembersData.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {});

    // Branch-wise counts
    const branchCounts = activeMembersData
      .filter(m => m.status === 'active')
      .reduce((acc, m) => {
        acc[m.branch_id] = (acc[m.branch_id] || 0) + 1;
        return acc;
      }, {});

    // Growth by month (last 12 months)
    const now = new Date();
    const monthlyGrowth = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(d, 'yyyy-MM');
      const count = members.filter(m => m.joining_date?.startsWith(monthStr)).length;
      monthlyGrowth.push({ month: format(d, 'MMM yyyy'), count });
    }

    // Participation rate (overall)
    const attendance = await readSheet('MemberAttendance');
    const totalRecords = attendance.length;
    const presentRecords = attendance.filter(a => a.status === 'present').length;
    const participationRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    res.json({
      success: true,
      data: {
        total_members: activeMembersData.filter(m => ['active', 'probation'].includes(m.status)).length,
        active_members: statusCounts.active || 0,
        probation_members: statusCounts.probation || 0,
        alumni_members: statusCounts.alumni || 0,
        inactive_members: statusCounts.inactive || 0,
        suspended_members: statusCounts.suspended || 0,
        branch_counts: branchCounts,
        monthly_growth: monthlyGrowth,
        participation_rate: participationRate,
        status_breakdown: statusCounts,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// ─── Auto-promote probation members ────────────────────────────────────────────
// Called by a scheduled job or manually by admin
const runProbationCheck = async (req, res) => {
  try {
    const members = await readSheet('Members');
    const today = new Date();
    const promoted = [];

    for (const member of members) {
      if (member.status === 'probation' && member.probation_end_date) {
        const endDate = parseISO(member.probation_end_date);
        if (today >= endDate) {
          await updateRow('Members', 'uddami_id', member.uddami_id, { status: 'active' });
          promoted.push(member.uddami_id);
          await auditLog(
            { user: { user_id: 'system', email: 'system@auto' }, ip: '127.0.0.1' },
            'STATUS_CHANGE', 'Members', member.uddami_id,
            { status: 'probation' }, { status: 'active' },
            'Auto-promoted after 3-month probation'
          );
        }
      }
    }

    res.json({ success: true, promoted_count: promoted.length, promoted_ids: promoted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Probation check failed' });
  }
};

// ─── Delete Member (Super Admin only, requires confirmation) ───────────────────
const deleteMember = async (req, res) => {
  try {
    const { uddami_id } = req.params;
    const { hard_delete } = req.query;

    const existing = await findOne('Members', 'uddami_id', uddami_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' });

    if (hard_delete === 'true' && req.user.role === 'super_admin') {
      await hardDeleteRow('Members', 'uddami_id', uddami_id);
      await auditLog(req, 'DELETE', 'Members', uddami_id, existing, null, 'Hard deleted by super admin');
    } else {
      await softDeleteRow('Members', 'uddami_id', uddami_id);
      await auditLog(req, 'DELETE', 'Members', uddami_id, existing, { status: 'deleted' });
    }

    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete member' });
  }
};

module.exports = {
  getMembers, getMember, createMember, updateMember,
  promoteMember, transferMember, assignRole,
  getMemberStats, runProbationCheck, deleteMember,
};
