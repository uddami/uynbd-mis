/**
 * UYNBD MIS - Events Controller (Updated)
 *
 * REPLACES: backend/controllers/events.controller.js
 *
 * Event Lifecycle: Draft → Submitted → Approved → Published → Completed → Archived
 *
 * NEW FEATURES ADDED:
 * - External organization collaboration toggle
 * - Mandatory PDF report before completion
 * - Auto-calculated total_participants (from EventAttendees)
 * - Auto-calculated total_news_coverage (from EventNews sheet)
 * - Media/news coverage tracking
 * - Total spendings (role-restricted entry)
 * - Activity lock on completion
 * - Expanded role permissions (branch_chief, event_chief, project_chief can create)
 *
 * Attendance Statuses: present, absent_excused, absent_unexcused, on_leave, optional_attendee
 */

const {
  readSheet, findOne, findMany,
  insertRow, updateRow, generateId,
} = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { format } = require('date-fns');

const EVENT_LIFECYCLE = ['draft', 'submitted', 'approved', 'published', 'completed', 'archived'];

// ── Who can CREATE events ─────────────────────────────────────────────────────
const EVENT_CREATE_ROLES = [
  'super_admin', 'administrator',
  'branch_chief',   // for their own branch
  'event_chief',    // for events
  'project_chief',  // for projects
];

// ── Who can enter SPENDING data ───────────────────────────────────────────────
const SPENDING_ROLES = [
  'super_admin', 'administrator',
  'branch_chief', 'finance_director',
];

// ── Who can APPROVE events ────────────────────────────────────────────────────
const APPROVE_ROLES = ['super_admin', 'administrator'];

// ── Who can UNLOCK completed events ──────────────────────────────────────────
const UNLOCK_ROLES = ['super_admin'];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: recalculate auto-computed fields and save back to Events sheet
// Called after every attendance or news coverage change
// ─────────────────────────────────────────────────────────────────────────────
const recalculateEventStats = async (event_id) => {
  const attendees = await findMany('EventAttendees', { event_id });
  const participantCount = attendees.filter(
    (a) => a.attendance_status === 'present'
  ).length;

  const newsRecords = await findMany('EventNews', { event_id });
  const newsCount = newsRecords.length;

  await updateRow('Events', 'event_id', event_id, {
    total_participants: String(participantCount),
    total_news_coverage: String(newsCount),
  });

  return { total_participants: participantCount, total_news_coverage: newsCount };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/events
// ─────────────────────────────────────────────────────────────────────────────
const getEvents = async (req, res) => {
  try {
    const {
      status, event_type, branch_id,
      search, from_date, to_date,
      page = 1, limit = 20,
    } = req.query;

    let events = await readSheet('Events');

    // ── Role scoping ────────────────────────────────────────────────────────
    if (req.user.role === 'event_chief') {
      const attendees = await readSheet('EventAttendees');
      const assignedEventIds = attendees
        .filter((a) => a.member_id === req.user.member_id)
        .map((a) => a.event_id);
      events = events.filter((e) => assignedEventIds.includes(e.event_id));
    }

    if (req.user.role === 'branch_chief') {
      events = events.filter((e) =>
        e.hosted_by_branch === req.user.branch_id ||
        e.expected_branches?.includes(req.user.branch_id)
      );
    }

    // ── Filters ─────────────────────────────────────────────────────────────
    if (status) events = events.filter((e) => e.status === status);
    if (event_type) events = events.filter((e) => e.event_type === event_type);
    if (branch_id) events = events.filter((e) =>
      e.hosted_by_branch === branch_id || e.expected_branches?.includes(branch_id)
    );
    if (search) {
      const q = search.toLowerCase();
      events = events.filter((e) =>
        e.event_name?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
      );
    }
    if (from_date) events = events.filter((e) => e.hosting_date >= from_date);
    if (to_date) events = events.filter((e) => e.hosting_date <= to_date);

    events = events.filter((e) => e.status !== 'deleted');
    events.sort((a, b) => b.hosting_date?.localeCompare(a.hosting_date));

    const total = events.length;
    const paginated = events.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: paginated, total });
  } catch (error) {
    console.error('[Events] getEvents error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/events/:event_id
// ─────────────────────────────────────────────────────────────────────────────
const getEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Fetch attendees and enrich with member names
    const attendees = await findMany('EventAttendees', { event_id });
    const members = await readSheet('Members');
    const memberMap = {};
    members.forEach((m) => { memberMap[m.uddami_id] = m; });

    const enrichedAttendees = attendees.map((a) => ({
      ...a,
      member_name: memberMap[a.member_id]?.full_name || 'Unknown',
    }));

    // Fetch news coverage records
    const newsRecords = await findMany('EventNews', { event_id });

    // Attendance stats
    const stats = {
      total_expected: attendees.length,
      present: attendees.filter((a) => a.attendance_status === 'present').length,
      absent_excused: attendees.filter((a) => a.attendance_status === 'absent_excused').length,
      absent_unexcused: attendees.filter((a) => a.attendance_status === 'absent_unexcused').length,
      on_leave: attendees.filter((a) => a.attendance_status === 'on_leave').length,
      attendance_rate: attendees.length > 0
        ? Math.round(
            (attendees.filter((a) => a.attendance_status === 'present').length / attendees.length) * 100
          )
        : 0,
      total_news_coverage: newsRecords.length,
    };

    res.json({
      success: true,
      data: { ...event, attendees: enrichedAttendees, news_coverage: newsRecords, stats },
    });
  } catch (error) {
    console.error('[Events] getEvent error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch event' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events
// ─────────────────────────────────────────────────────────────────────────────
const createEvent = async (req, res) => {
  try {
    // ── Permission check ──────────────────────────────────────────────────
    if (!EVENT_CREATE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create events.',
      });
    }

    const {
      event_type, event_name, hosting_date, end_date, location,
      hosted_by_branch, chief_host_name, chief_host_position,
      chief_host_phone, chief_host_email, expected_branches,
      photos_folder_url, report_url, remarks, is_attendance_mandatory,
      // NEW FIELDS:
      external_organization,
      external_organization_name,
      total_spendings,
    } = req.body;

    if (!event_type || !event_name || !hosting_date) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: event_type, event_name, hosting_date',
      });
    }

    // External org validation: name required if flag is true
    if (external_organization === true || external_organization === 'true') {
      if (!external_organization_name?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'External organization name is required when hosting with another organization.',
        });
      }
    }

    // Branch chief can only create for their own branch
    if (req.user.role === 'branch_chief') {
      const branchToUse = hosted_by_branch || req.user.branch_id;
      if (branchToUse !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          message: 'Branch chiefs can only create events for their own branch.',
        });
      }
    }

    // ── Generate event ID ─────────────────────────────────────────────────
    const year = new Date().getFullYear();
    const events = await readSheet('Events');
    const yearEvents = events.filter((e) => e.event_id?.startsWith(`EVT-${year}`));
    const seq = String(yearEvents.length + 1).padStart(4, '0');
    const event_id = `EVT-${year}-${seq}`;

    // Spending: only allowed if role permits, otherwise ignore
    const spendingValue = SPENDING_ROLES.includes(req.user.role) && total_spendings
      ? String(total_spendings)
      : '';

    const newEvent = {
      event_id,
      event_type,
      event_name: event_name.trim(),
      hosting_date,
      end_date: end_date || hosting_date,
      location: location || '',
      hosted_by_branch: hosted_by_branch || (req.user.role === 'branch_chief' ? req.user.branch_id : ''),
      chief_host_name: chief_host_name || '',
      chief_host_position: chief_host_position || '',
      chief_host_phone: chief_host_phone || '',
      chief_host_email: chief_host_email || '',
      expected_branches: Array.isArray(expected_branches)
        ? expected_branches.join(',')
        : (expected_branches || ''),
      photos_folder_url: photos_folder_url || '',
      report_url: report_url || '',
      remarks: remarks || '',
      status: 'draft',
      is_attendance_mandatory: String(is_attendance_mandatory || false),
      // ── NEW FIELDS ──────────────────────────────────────────────────────
      external_organization: String(external_organization === true || external_organization === 'true'),
      external_organization_name: (external_organization === true || external_organization === 'true')
        ? (external_organization_name?.trim() || '')
        : '',
      total_spendings: spendingValue,
      total_participants: '0',   // always system-calculated
      total_news_coverage: '0', // always system-calculated
      pdf_report_url: '',
      locked: 'false',
      // ────────────────────────────────────────────────────────────────────
      created_by: req.user.user_id,
      approved_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await insertRow('Events', newEvent);
    await auditLog(req, 'CREATE', 'Events', event_id, null, newEvent);

    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    console.error('[Events] createEvent error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create event: ' + error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/events/:event_id
// ─────────────────────────────────────────────────────────────────────────────
const updateEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const existing = await findOne('Events', 'event_id', event_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

    // Block edits on locked events (completed)
    if (existing.locked === 'true' && !UNLOCK_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'This event is completed and locked. Only Super Admin can unlock it.',
      });
    }

    if (['completed', 'archived'].includes(existing.status) && !UNLOCK_ROLES.includes(req.user.role)) {
      return res.status(400).json({
        success: false,
        message: 'Completed/archived events cannot be edited.',
      });
    }

    const updates = { ...req.body };
    delete updates.event_id;

    // Never allow manual override of system-calculated fields
    delete updates.total_participants;
    delete updates.total_news_coverage;

    // Spending: only allowed roles
    if ('total_spendings' in req.body && !SPENDING_ROLES.includes(req.user.role)) {
      delete updates.total_spendings;
    }

    // External org validation
    if (updates.external_organization === true || updates.external_organization === 'true') {
      if (!updates.external_organization_name?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'External organization name is required.',
        });
      }
    }

    if (updates.expected_branches && Array.isArray(updates.expected_branches)) {
      updates.expected_branches = updates.expected_branches.join(',');
    }

    const updated = await updateRow('Events', 'event_id', event_id, updates);
    await auditLog(req, 'UPDATE', 'Events', event_id, existing, updates);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Events] updateEvent error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/:event_id/advance-status
// ─────────────────────────────────────────────────────────────────────────────
const advanceEventStatus = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { notes } = req.body;

    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const currentIdx = EVENT_LIFECYCLE.indexOf(event.status);
    if (currentIdx === -1 || currentIdx >= EVENT_LIFECYCLE.length - 1) {
      return res.status(400).json({ success: false, message: 'Cannot advance status further' });
    }

    const nextStatus = EVENT_LIFECYCLE[currentIdx + 1];

    // Only administrators can approve
    if (nextStatus === 'approved' && !APPROVE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can approve events.',
      });
    }

    // MANDATORY REPORT RULE: cannot mark completed without PDF report
    if (nextStatus === 'completed') {
      if (!event.pdf_report_url?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A PDF report must be uploaded before marking this event as Completed.',
        });
      }
    }

    const updateData = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'approved') updateData.approved_by = req.user.user_id;

    // Lock the event on completion
    if (nextStatus === 'completed') updateData.locked = 'true';

    await updateRow('Events', 'event_id', event_id, updateData);
    await auditLog(
      req, 'STATUS_CHANGE', 'Events', event_id,
      { status: event.status }, { status: nextStatus }, notes || ''
    );

    res.json({
      success: true,
      message: `Event status updated to: ${nextStatus}`,
      new_status: nextStatus,
    });
  } catch (error) {
    console.error('[Events] advanceEventStatus error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update event status' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/:event_id/attendance
// Auto-recalculates total_participants after every write
// ─────────────────────────────────────────────────────────────────────────────
const recordAttendance = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { attendees } = req.body; // [{ member_id, attendance_status, notes }]

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ success: false, message: 'attendees array required' });
    }

    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Block attendance edits on locked events
    if (event.locked === 'true' && !UNLOCK_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Event is locked. Attendance cannot be modified.',
      });
    }

    const VALID_STATUSES = ['present', 'absent_excused', 'absent_unexcused', 'on_leave', 'optional_attendee'];
    const existing = await findMany('EventAttendees', { event_id });
    const existingMemberIds = new Set(existing.map((a) => a.member_id));
    const results = [];

    for (const att of attendees) {
      if (!VALID_STATUSES.includes(att.attendance_status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid attendance status: '${att.attendance_status}'. Use: ${VALID_STATUSES.join(', ')}`,
        });
      }

      const member = await findOne('Members', 'uddami_id', att.member_id);
      if (!member) continue;

      if (existingMemberIds.has(att.member_id)) {
        const existingRecord = existing.find((a) => a.member_id === att.member_id);
        await updateRow('EventAttendees', 'id', existingRecord.id, {
          attendance_status: att.attendance_status,
          notes: att.notes || '',
          recorded_by: req.user.user_id,
        });
      } else {
        const record = {
          id: generateId('ATT'),
          event_id,
          member_id: att.member_id,
          branch_id: member.branch_id,
          attendance_status: att.attendance_status || 'present',
          notes: att.notes || '',
          recorded_by: req.user.user_id,
          created_at: new Date().toISOString(),
        };
        await insertRow('EventAttendees', record);
        await insertRow('MemberAttendance', {
          id: generateId('MA'),
          member_id: att.member_id,
          event_id,
          status: att.attendance_status || 'present',
          notes: att.notes || '',
          recorded_by: req.user.user_id,
          created_at: new Date().toISOString(),
        });
        results.push(record);
      }
    }

    // AUTO-RECALCULATE total_participants
    const stats = await recalculateEventStats(event_id);

    await auditLog(req, 'CREATE', 'EventAttendees', event_id, null, {
      count: attendees.length,
      new_participant_count: stats.total_participants,
    });

    res.json({
      success: true,
      message: `Recorded attendance for ${attendees.length} members`,
      total_participants: stats.total_participants,
    });
  } catch (error) {
    console.error('[Events] recordAttendance error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to record attendance: ' + error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/:event_id/report
// Upload PDF report URL (Google Drive link)
// ─────────────────────────────────────────────────────────────────────────────
const uploadReport = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { pdf_report_url } = req.body;

    if (!pdf_report_url?.trim()) {
      return res.status(400).json({ success: false, message: 'pdf_report_url is required.' });
    }

    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.locked === 'true' && !UNLOCK_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Event is locked.' });
    }

    await updateRow('Events', 'event_id', event_id, {
      pdf_report_url: pdf_report_url.trim(),
    });
    await auditLog(req, 'UPLOAD_REPORT', 'Events', event_id, null, { pdf_report_url });

    res.json({ success: true, message: 'Report URL saved successfully.' });
  } catch (error) {
    console.error('[Events] uploadReport error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save report URL' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/:event_id/news
// Add a media coverage entry – auto-increments total_news_coverage
// ─────────────────────────────────────────────────────────────────────────────
const addNewsCoverage = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { media_name, coverage_link, coverage_date } = req.body;

    if (!media_name?.trim() || !coverage_link?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'media_name and coverage_link are required.',
      });
    }

    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.locked === 'true') {
      return res.status(403).json({
        success: false,
        message: 'Cannot add news coverage to a completed/locked event.',
      });
    }

    const newsRecord = {
      id: generateId('NEWS'),
      event_id,
      media_name: media_name.trim(),
      coverage_link: coverage_link.trim(),
      coverage_date: coverage_date || new Date().toISOString().split('T')[0],
      verified: 'false',
      created_by: req.user.user_id,
      created_at: new Date().toISOString(),
    };

    await insertRow('EventNews', newsRecord);

    // AUTO-RECALCULATE total_news_coverage
    const stats = await recalculateEventStats(event_id);

    res.status(201).json({
      success: true,
      data: newsRecord,
      total_news_coverage: stats.total_news_coverage,
    });
  } catch (error) {
    console.error('[Events] addNewsCoverage error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to add news coverage' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/events/:event_id/news
// List all media coverage for an event
// ─────────────────────────────────────────────────────────────────────────────
const getNewsCoverage = async (req, res) => {
  try {
    const { event_id } = req.params;
    const news = await findMany('EventNews', { event_id });
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('[Events] getNewsCoverage error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch news coverage' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/:event_id/spending
// Update total spendings – restricted to allowed roles
// ─────────────────────────────────────────────────────────────────────────────
const updateSpending = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { total_spendings } = req.body;

    if (!SPENDING_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update spending data.',
      });
    }

    const amount = parseFloat(total_spendings);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'total_spendings must be a non-negative number.',
      });
    }

    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.locked === 'true' && !UNLOCK_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Event is locked.' });
    }

    await updateRow('Events', 'event_id', event_id, {
      total_spendings: String(amount),
    });
    await auditLog(req, 'UPDATE', 'Events', event_id,
      { total_spendings: event.total_spendings },
      { total_spendings: String(amount) }
    );

    res.json({ success: true, message: 'Spending updated.', total_spendings: amount });
  } catch (error) {
    console.error('[Events] updateSpending error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update spending' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/:event_id/unlock  (Super Admin only)
// ─────────────────────────────────────────────────────────────────────────────
const unlockEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { reason } = req.body;

    if (!UNLOCK_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can unlock completed events.',
      });
    }

    await updateRow('Events', 'event_id', event_id, { locked: 'false' });
    await auditLog(req, 'UNLOCK', 'Events', event_id, null, {
      reason: reason || 'Super Admin unlock',
    });

    res.json({ success: true, message: 'Event unlocked successfully.' });
  } catch (error) {
    console.error('[Events] unlockEvent error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to unlock event' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/events/stats
// ─────────────────────────────────────────────────────────────────────────────
const getEventStats = async (req, res) => {
  try {
    const events = await readSheet('Events');
    const active = events.filter((e) => e.status !== 'deleted');

    const byType = active.reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {});

    const byStatus = active.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {});

    // Monthly events (last 12 months)
    const now = new Date();
    const monthlyActivity = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(d, 'yyyy-MM');
      const count = active.filter((e) => e.hosting_date?.startsWith(monthStr)).length;
      monthlyActivity.push({ month: format(d, 'MMM yyyy'), count });
    }

    // Aggregate totals across all events
    const totalParticipants = active.reduce(
      (sum, e) => sum + parseInt(e.total_participants || 0, 10), 0
    );
    const totalSpendings = active.reduce(
      (sum, e) => sum + parseFloat(e.total_spendings || 0), 0
    );
    const totalNewsCoverage = active.reduce(
      (sum, e) => sum + parseInt(e.total_news_coverage || 0, 10), 0
    );

    res.json({
      success: true,
      data: {
        total_events: active.length,
        by_type: byType,
        by_status: byStatus,
        monthly_activity: monthlyActivity,
        total_participants: totalParticipants,
        total_spendings: totalSpendings,
        total_news_coverage: totalNewsCoverage,
        upcoming: active.filter((e) =>
          ['approved', 'published'].includes(e.status) &&
          e.hosting_date >= format(new Date(), 'yyyy-MM-dd')
        ).length,
      },
    });
  } catch (error) {
    console.error('[Events] getEventStats error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch event stats' });
  }
};

module.exports = {
  // ── Original exports (unchanged names – server.js stays the same) ─────────
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  advanceEventStatus,
  recordAttendance,
  getEventStats,
  // ── New exports ───────────────────────────────────────────────────────────
  uploadReport,
  addNewsCoverage,
  getNewsCoverage,
  updateSpending,
  unlockEvent,
};
