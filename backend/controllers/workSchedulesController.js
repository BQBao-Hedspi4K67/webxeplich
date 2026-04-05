import pool from '../config/database.js';
import { WORK_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureNotificationTargetingSchema,
  createUserNotification,
  createRoleNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';

let workScheduleApprovalSchemaEnsured = false;

const ensureWorkScheduleApprovalSchema = async (connection) => {
  if (workScheduleApprovalSchemaEnsured) return;

  const [columns] = await connection.execute('SHOW COLUMNS FROM work_schedules');
  const colNames = new Set(columns.map((col) => col.Field));

  if (!colNames.has('approvalStatus')) {
    await connection.execute(
      "ALTER TABLE work_schedules ADD COLUMN approvalStatus ENUM('pending', 'approved', 'rejected') DEFAULT 'approved' AFTER participants"
    );
  }

  if (!colNames.has('approvedByUserId')) {
    await connection.execute('ALTER TABLE work_schedules ADD COLUMN approvedByUserId INT NULL AFTER approvalStatus');
  }

  if (!colNames.has('approvedAt')) {
    await connection.execute('ALTER TABLE work_schedules ADD COLUMN approvedAt TIMESTAMP NULL AFTER approvedByUserId');
  }

  workScheduleApprovalSchemaEnsured = true;
};

const buildQuery = (filters = {}, options = {}) => {
  const {
    search = '',
    type = '',
    department = '',
    weekNo = '',
    startDate = '',
    endDate = '',
  } = filters;
  const { role = 'officer' } = options;

  const where = [];
  const params = [];

  if (role !== 'admin' && role !== 'manager') {
    where.push("ws.approvalStatus = 'approved'");
  }

  if (search) {
    const q = `%${search}%`;
    where.push('(ws.title LIKE ? OR ws.department LIKE ? OR ro.fullName LIKE ? OR o1.fullName LIKE ? OR o2.fullName LIKE ? OR cmd.fullName LIKE ?)');
    params.push(q, q, q, q, q, q);
  }

  if (type) {
    where.push('ws.type = ?');
    params.push(type);
  }

  if (department) {
    where.push('ws.department LIKE ?');
    params.push(`%${department}%`);
  }

  if (weekNo) {
    where.push('ws.weekNo = ?');
    params.push(parseInt(weekNo, 10));
  }

  if (startDate) {
    where.push('ws.date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    where.push('ws.date <= ?');
    params.push(endDate);
  }

  return {
    whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
};

const scheduleSelect = `
  SELECT
    ws.*,
    approver.fullName AS approvedByName,
    ro.fullName AS responsibleOfficerName,
    o1.fullName AS officer1Name,
    o2.fullName AS officer2Name,
    cmd.fullName AS commanderOfficerName
  FROM work_schedules ws
  LEFT JOIN users approver ON approver.id = ws.approvedByUserId
  LEFT JOIN officers ro ON ro.id = ws.responsibleOfficerId
  LEFT JOIN officers o1 ON o1.id = ws.officer1Id
  LEFT JOIN officers o2 ON o2.id = ws.officer2Id
  LEFT JOIN officers cmd ON cmd.id = ws.commanderOfficerId
`;

export const getWorkSchedules = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      type = '',
      department = '',
      weekNo = '',
      startDate = '',
      endDate = '',
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const connection = await pool.getConnection();

    try {
      await ensureWorkScheduleApprovalSchema(connection);

      const { whereClause, params } = buildQuery({
        search,
        type,
        department,
        weekNo,
        startDate,
        endDate,
      }, {
        role: req.user?.role,
      });

      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total
         FROM work_schedules ws
         LEFT JOIN officers ro ON ro.id = ws.responsibleOfficerId
         LEFT JOIN officers o1 ON o1.id = ws.officer1Id
         LEFT JOIN officers o2 ON o2.id = ws.officer2Id
         LEFT JOIN officers cmd ON cmd.id = ws.commanderOfficerId
         ${whereClause}`,
        params
      );

      const [rows] = await connection.execute(
        `${scheduleSelect}
         ${whereClause}
         ORDER BY ws.date ASC
         LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
        params
      );

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: countRows[0].total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(countRows[0].total / parseInt(limit, 10)),
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const getWorkScheduleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await ensureWorkScheduleApprovalSchema(connection);

      const [rows] = await connection.execute(
        `${scheduleSelect} WHERE ws.id = ?${req.user?.role !== 'admin' && req.user?.role !== 'manager' ? " AND ws.approvalStatus = 'approved'" : ''}`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      res.json({ success: true, data: rows[0] });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const createWorkSchedule = async (req, res, next) => {
  try {
    const {
      title,
      date,
      startTime,
      endTime,
      location,
      department,
      type,
      weekNo,
      notes = '',
      officer1Id = null,
      officer2Id = null,
      commanderOfficerId = null,
      participants = null,
    } = req.body;

    if (!title || !date || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, date, type',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!WORK_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${WORK_TYPES.join(', ')}`,
        code: 'INVALID_TYPE',
      });
    }

    if (!officer1Id || !officer2Id || !commanderOfficerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required officers: officer1Id, officer2Id, commanderOfficerId',
        code: 'VALIDATION_ERROR',
      });
    }

    const participantsJson = participants ? JSON.stringify(participants) : null;

    const connection = await pool.getConnection();

    try {
      await ensureWorkScheduleApprovalSchema(connection);

      const [maxIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as maxNum FROM work_schedules WHERE id LIKE 'LCT%'"
      );
      const nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const newId = `LCT${String(nextNum).padStart(3, '0')}`;
      const approvalStatus = req.user?.role === 'admin' ? 'approved' : 'pending';
      const approvedByUserId = approvalStatus === 'approved' ? req.user?.id || null : null;
      const approvedAt = approvalStatus === 'approved' ? new Date() : null;

      await connection.execute(
        `INSERT INTO work_schedules (
          id, title, date, startTime, endTime, location, department, type, weekNo, notes,
          responsibleOfficerId, officer1Id, officer2Id, commanderOfficerId,
          participants, approvalStatus, approvedByUserId, approvedAt, createdByUserId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
        [
          newId,
          title,
          date,
          startTime || null,
          endTime || null,
          location || '',
          department || '',
          type,
          weekNo || null,
          notes,
          commanderOfficerId || null,
          officer1Id || null,
          officer2Id || null,
          commanderOfficerId || null,
          participantsJson,
          approvalStatus,
          approvedByUserId,
          approvedAt,
          req.user?.id || null,
        ]
      );

      await ensureNotificationTargetingSchema(connection);

      if (approvalStatus === 'pending') {
        await createRoleNotification(connection, {
          title: 'Co lich cong tac cho duyet',
          content: `${title} (${date})`,
          type: 'warning',
          module: 'lichcongtac',
          entityType: 'work_schedule',
          entityId: newId,
          targetRole: 'admin',
        });
      } else {
        const targetOfficerIds = [officer1Id, officer2Id, commanderOfficerId].filter(Boolean);

        for (const officerId of targetOfficerIds) {
          const targetUserId = await resolveUserIdByOfficerId(connection, officerId);
          await createUserNotification(connection, {
            title: 'Ban duoc phan cong lich cong tac moi',
            content: `${title} (${date})`,
            type: 'info',
            module: 'lichcongtac',
            entityType: 'work_schedule',
            entityId: newId,
            targetUserId,
          });
        }
      }

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichcongtac',
        action: 'create',
        entityType: 'work_schedule',
        entityId: newId,
        summary: `Them moi lich cong tac ${newId} - ${title}`,
      });

      res.status(201).json({
        success: true,
        data: { id: newId, approvalStatus },
        message: 'Work schedule created successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const approveWorkSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = 'approved' } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid approval status. Must be approved or rejected.',
        code: 'INVALID_APPROVAL_STATUS',
      });
    }

    const connection = await pool.getConnection();
    try {
      await ensureWorkScheduleApprovalSchema(connection);

      const [rows] = await connection.execute(
        `${scheduleSelect} WHERE ws.id = ?`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      const schedule = rows[0];
      const approvalStatus = status;
      const approvedByUserId = status === 'approved' ? req.user?.id || null : null;
      const approvedAt = status === 'approved' ? new Date() : null;

      await connection.execute(
        `UPDATE work_schedules
         SET approvalStatus = ?, approvedByUserId = ?, approvedAt = ?
         WHERE id = ?`,
        [approvalStatus, approvedByUserId, approvedAt, id]
      );

      await ensureNotificationTargetingSchema(connection);

      const notifiedUserIds = new Set();
      const createdByUserId = schedule.createdByUserId || null;
      if (createdByUserId) notifiedUserIds.add(createdByUserId);

      const assignedOfficerIds = [
        schedule.responsibleOfficerId,
        schedule.officer1Id,
        schedule.officer2Id,
        schedule.commanderOfficerId,
      ].filter(Boolean);

      for (const officerId of assignedOfficerIds) {
        const targetUserId = await resolveUserIdByOfficerId(connection, officerId);
        if (targetUserId) notifiedUserIds.add(targetUserId);
      }

      for (const targetUserId of notifiedUserIds) {
        await createUserNotification(connection, {
          title: approvalStatus === 'approved' ? 'Lich cong tac da duoc duyet' : 'Lich cong tac bi tu choi',
          content: `${schedule.title} (${schedule.date})`,
          type: approvalStatus === 'approved' ? 'success' : 'warning',
          module: 'lichcongtac',
          entityType: 'work_schedule',
          entityId: id,
          targetUserId,
        });
      }

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichcongtac',
        action: approvalStatus === 'approved' ? 'approve' : 'reject',
        entityType: 'work_schedule',
        entityId: id,
        summary: `${approvalStatus === 'approved' ? 'Duyet' : 'Tu choi'} lich cong tac ${id}`,
      });

      res.json({
        success: true,
        message: approvalStatus === 'approved' ? 'Work schedule approved successfully' : 'Work schedule rejected successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const updateWorkSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      date,
      startTime,
      endTime,
      location,
      department,
      type,
      weekNo,
      notes,
      officer1Id,
      officer2Id,
      commanderOfficerId,
      participants,
    } = req.body;

    const connection = await pool.getConnection();

    try {
      await ensureWorkScheduleApprovalSchema(connection);

      const [checkRows] = await connection.execute(
        'SELECT id FROM work_schedules WHERE id = ? LIMIT 1',
        [id]
      );

      if (!checkRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      const fields = [];
      const params = [];
      const [currentRows] = await connection.execute(
        'SELECT approvalStatus FROM work_schedules WHERE id = ? LIMIT 1',
        [id]
      );
      const currentStatus = currentRows[0]?.approvalStatus || 'approved';

      const addField = (field, value) => {
        fields.push(`${field} = ?`);
        params.push(value);
      };

      if (title !== undefined) addField('title', title);
      if (date !== undefined) addField('date', date);
      if (startTime !== undefined) addField('startTime', startTime || null);
      if (endTime !== undefined) addField('endTime', endTime || null);
      if (location !== undefined) addField('location', location || '');
      if (department !== undefined) addField('department', department || '');
      if (type !== undefined) addField('type', type);
      if (weekNo !== undefined) addField('weekNo', weekNo || null);
      if (notes !== undefined) addField('notes', notes || '');
      if (officer1Id !== undefined) addField('officer1Id', officer1Id || null);
      if (officer2Id !== undefined) addField('officer2Id', officer2Id || null);
      if (commanderOfficerId !== undefined) addField('commanderOfficerId', commanderOfficerId || null);
      if (participants !== undefined) addField('participants', participants ? JSON.stringify(participants) : null);
      if (commanderOfficerId !== undefined) addField('responsibleOfficerId', commanderOfficerId || null);

      if (req.user?.role !== 'admin' && currentStatus === 'approved') {
        addField('approvalStatus', 'pending');
        addField('approvedByUserId', null);
        addField('approvedAt', null);
      }

      if (!fields.length) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update',
          code: 'VALIDATION_ERROR',
        });
      }

      params.push(id);
      await connection.execute(
        `UPDATE work_schedules SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichcongtac',
        action: 'update',
        entityType: 'work_schedule',
        entityId: id,
        summary: `Cap nhat lich cong tac ${id}`,
      });

      res.json({ success: true, message: 'Work schedule updated successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const deleteWorkSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id FROM work_schedules WHERE id = ? LIMIT 1',
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM work_schedules WHERE id = ?', [id]);

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichcongtac',
        action: 'delete',
        entityType: 'work_schedule',
        entityId: id,
        summary: `Xoa lich cong tac ${id}`,
      });

      res.json({ success: true, message: 'Work schedule deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
