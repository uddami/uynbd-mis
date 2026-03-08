/**
 * UYNBD MIS - Events Controller
 * 
 * Event Lifecycle: Draft → Submitted → Approved → Published → Completed → Archived
 * 
 * Event Types: central_meeting, branch_meeting, project, joint_event, campaign
 * 
 * Attendance Statuses:
 * - present
 * - absent_excused
 * - absent_unexcused
 * - on_leave
 * - optional_attendee
 */

const { readSheet, findOne, findMany, insertRow, updateRow, generateId } = require('../services/sheets.service');
const { auditLog } = require('../services/audit.service');
const { format } = require('date-fns');

const EVENT_LIFECYCLE = ['draft', 'submitted', 'approved', 'published', 'completed', 'archived'];

// ─── Get Events ────────────────────────────────────────────────────────────────
const getEvents = async (req, res) => {
  try {
    const { status, event_type, branch_id, search, from_date, to_date, page = 1, limit = 20 } = req.query;

    let events = await readSheet('Events');

    // Event chiefs only see their assigned events
    if (req.user.role === 'event_chief') {
      const attendees = await readSheet('EventAttendees');
      const assignedEventIds = attendees
        .filter(a => a.member_id === req.user.member_id)
        .map(a => a.event_id);
      events = events.filter(e => assignedEventIds.includes(e.event_id));
    }

    // Branch chiefs see events involving their branch
    if (req.user.role === 'branch_chief') {
      events = events.filter(e =>
        e.hosted_by_branch === req.user.branch_id ||
        e.expected_branches?.includes(req.user.branch_id)
      );
    }

    if (status) events = events.filter(e => e.status === status);
    if (event_type) events = events.filter(e => e.event_type === event_type);
    if (branch_id) events = events.filter(e =>
      e.hosted_by_branch === branch_id || e.expected_branches?.includes(branch_id)
    );
    if (search) {
      const q = search.toLowerCase();
      events = events.filter(e =>
        e.event_name?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
      );
    }
    if (from_date) events = events.filter(e => e.hosting_date >= from_date);
    if (to_date) events = events.filter(e => e.hosting_date <= to_date);

    // Exclude deleted
    events = events.filter(e => e.status !== 'deleted');
    events.sort((a, b) => b.hosting_date?.localeCompare(a.hosting_date));

    const total = events.length;
    const paginated = events.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: paginated, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

// ─── Get Single Event ──────────────────────────────────────────────────────────
const getEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Fetch attendees
    const attendees = await findMany('EventAttendees', { event_id });

    // Enrich attendees with member names
    const members = await readSheet('Members');
    const memberMap = {};
    members.forEach(m => { memberMap[m.uddami_id] = m; });

    const enrichedAttendees = attendees.map(a => ({
      ...a,
      member_name: memberMap[a.member_id]?.full_name || 'Unknown',
      branch_name: a.branch_id,
    }));

    const stats = {
      total_expected: attendees.length,
      present: attendees.filter(a => a.attendance_status === 'present').length,
      absent_excused: attendees.filter(a => a.attendance_status === 'absent_excused').length,
      absent_unexcused: attendees.filter(a => a.attendance_status === 'absent_unexcused').length,
      on_leave: attendees.filter(a => a.attendance_status === 'on_leave').length,
      attendance_rate: attendees.length > 0
        ? Math.round((attendees.filter(a => a.attendance_status === 'present').length / attendees.length) * 100)
        : 0,
    };

    res.json({ success: true, data: { ...event, attendees: enrichedAttendees, stats } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch event' });
  }
};

// ─── Create Event ──────────────────────────────────────────────────────────────
const createEvent = async (req, res) => {
  try {
    const {
      event_type, event_name, hosting_date, end_date, location,
      hosted_by_branch, chief_host_name, chief_host_position,
      chief_host_phone, chief_host_email, expected_branches,
      photos_folder_url, report_url, remarks, is_attendance_mandatory
    } = req.body;

    if (!event_type || !event_name || !hosting_date) {
      return res.status(400).json({ success: false, message: 'Required: event_type, event_name, hosting_date' });
    }

    const year = new Date().getFullYear();
    const events = await readSheet('Events');
    const yearEvents = events.filter(e => e.event_id?.startsWith(`EVT-${year}`));
    const seq = String(yearEvents.length + 1).padStart(4, '0');
    const event_id = `EVT-${year}-${seq}`;

    const newEvent = {
      event_id,
      event_type,
      event_name: event_name.trim(),
      hosting_date,
      end_date: end_date || hosting_date,
      location: location || '',
      hosted_by_branch: hosted_by_branch || '',
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
      created_by: req.user.user_id,
      approved_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await insertRow('Events', newEvent);
    await auditLog(req, 'CREATE', 'Events', event_id, null, newEvent);

    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create event: ' + error.message });
  }
};

// ─── Update Event ──────────────────────────────────────────────────────────────
const updateEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const existing = await findOne('Events', 'event_id', event_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

    if (['completed', 'archived'].includes(existing.status)) {
      return res.status(400).json({ success: false, message: 'Completed/archived events cannot be edited' });
    }

    const updates = { ...req.body };
    delete updates.event_id;
    if (updates.expected_branches && Array.isArray(updates.expected_branches)) {
      updates.expected_branches = updates.expected_branches.join(',');
    }

    const updated = await updateRow('Events', 'event_id', event_id, updates);
    await auditLog(req, 'UPDATE', 'Events', event_id, existing, updates);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

// ─── Advance Event Status ──────────────────────────────────────────────────────
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

    // Approval requires administrator role
    if (nextStatus === 'approved' && !['super_admin', 'administrator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only administrators can approve events' });
    }

    const updateData = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (nextStatus === 'approved') updateData.approved_by = req.user.user_id;

    await updateRow('Events', 'event_id', event_id, updateData);
    await auditLog(req, 'STATUS_CHANGE', 'Events', event_id,
      { status: event.status }, { status: nextStatus }, notes || '');

    res.json({ success: true, message: `Event status updated to: ${nextStatus}`, new_status: nextStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update event status' });
  }
};

// ─── Record Attendance ─────────────────────────────────────────────────────────
const recordAttendance = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { attendees } = req.body; // Array of { member_id, attendance_status, notes }

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ success: false, message: 'attendees array required' });
    }

    const event = await findOne('Events', 'event_id', event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const existing = await findMany('EventAttendees', { event_id });
    const existingMemberIds = new Set(existing.map(a => a.member_id));

    const results = [];
    for (const att of attendees) {
      // Auto-fetch member's branch
      const member = await findOne('Members', 'uddami_id', att.member_id);
      if (!member) continue;

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

      if (existingMemberIds.has(att.member_id)) {
        // Update existing attendance record
        const existingRecord = existing.find(a => a.member_id === att.member_id);
        await updateRow('EventAttendees', 'id', existingRecord.id, {
          attendance_status: att.attendance_status,
          notes: att.notes || '',
          recorded_by: req.user.user_id,
        });
      } else {
        await insertRow('EventAttendees', record);
        // Also insert into MemberAttendance for the member profile
        await insertRow('MemberAttendance', {
          id: generateId('MA'),
          member_id: att.member_id,
          event_id,
          status: att.attendance_status || 'present',
          notes: att.notes || '',
          recorded_by: req.user.user_id,
          created_at: new Date().toISOString(),
        });
      }
      results.push(record);
    }

    await auditLog(req, 'CREATE', 'EventAttendees', event_id, null, { count: results.length });

    res.json({ success: true, message: `Recorded attendance for ${results.length} members` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record attendance: ' + error.message });
  }
};

// ─── Events Dashboard Stats ────────────────────────────────────────────────────
const getEventStats = async (req, res) => {
  try {
    const events = await readSheet('Events');
    const active = events.filter(e => e.status !== 'deleted');

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
      const count = active.filter(e => e.hosting_date?.startsWith(monthStr)).length;
      monthlyActivity.push({ month: format(d, 'MMM yyyy'), count });
    }

    res.json({
      success: true,
      data: {
        total_events: active.length,
        by_type: byType,
        by_status: byStatus,
        monthly_activity: monthlyActivity,
        upcoming: active.filter(e =>
          ['approved', 'published'].includes(e.status) && e.hosting_date >= format(new Date(), 'yyyy-MM-dd')
        ).length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch event stats' });
  }
};

module.exports = {
  getEvents, getEvent, createEvent, updateEvent,
  advanceEventStatus, recordAttendance, getEventStats,
};
