import pool from '../config/database.js';
import { WORK_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureNotificationTargetingSchema,
  createUserNotification,
  createRoleNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';
import {
  ensureWorkScheduleAccessSchema,
  getWorkScheduleAccessState,
} from '../utils/workScheduleAccess.js';

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

  if (!colNames.has('departmentId')) {
    await connection.execute('ALTER TABLE work_schedules ADD COLUMN departmentId INT NULL AFTER department');
    await connection.execute('CREATE INDEX idx_department_id ON work_schedules (departmentId)');
  }

  if (!colNames.has('createdByOfficerId')) {
    await connection.execute('ALTER TABLE work_schedules ADD COLUMN createdByOfficerId VARCHAR(10) NULL AFTER createdByUserId');
    await connection.execute('CREATE INDEX idx_created_by_officer ON work_schedules (createdByOfficerId)');
  }

  await connection.execute(
    `UPDATE work_schedules ws
     LEFT JOIN officers o ON o.userId = ws.createdByUserId
     SET ws.createdByOfficerId = o.id
     WHERE ws.createdByOfficerId IS NULL
       AND ws.createdByUserId IS NOT NULL`
  );

  workScheduleApprovalSchemaEnsured = true;
};

const resolveDepartmentRef = async (connection, { departmentId, department }) => {
  if (departmentId) {
    const [rows] = await connection.execute(
      'SELECT id, name FROM departments WHERE id = ? LIMIT 1',
      [departmentId]
    );
    return rows[0] || null;
  }

  if (!department) return null;

  const [rows] = await connection.execute(
    'SELECT id, name FROM departments WHERE name = ? LIMIT 1',
    [department]
  );
  return rows[0] || null;
};

const resolveRequesterOfficer = async (connection, reqUser = {}) => {
  const [rowsByUser] = await connection.execute(
    `SELECT id, departmentId, department
     FROM officers
     WHERE userId = ?
     LIMIT 1`,
    [reqUser.id]
  );
  if (rowsByUser[0]) return rowsByUser[0];

  const [rowsByProfile] = await connection.execute(
    `SELECT id, departmentId, department
     FROM officers
     WHERE (email = ? AND ? <> '') OR fullName = ?
     LIMIT 1`,
    [reqUser.email || '', reqUser.email || '', reqUser.fullName || '']
  );
  return rowsByProfile[0] || null;
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

  void role;

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
    d.name AS departmentName,
    CONCAT_WS(' ', NULLIF(approverOfficer.officerTitle, ''), approver.fullName) AS approvedByName,
    creatorUser.fullName AS createdByUserName,
    creatorOfficer.id AS createdByOfficerId,
    CONCAT_WS(' ', NULLIF(creatorOfficer.officerTitle, ''), creatorOfficer.fullName) AS createdByOfficerName,
    creatorOfficer.departmentId AS createdByDepartmentId,
    creatorOfficer.department AS createdByDepartmentName,
    CONCAT_WS(' ', NULLIF(ro.officerTitle, ''), ro.fullName) AS responsibleOfficerName,
    CONCAT_WS(' ', NULLIF(o1.officerTitle, ''), o1.fullName) AS officer1Name,
    CONCAT_WS(' ', NULLIF(o2.officerTitle, ''), o2.fullName) AS officer2Name,
    CONCAT_WS(' ', NULLIF(cmd.officerTitle, ''), cmd.fullName) AS commanderOfficerName
  FROM work_schedules ws
  LEFT JOIN departments d ON d.id = ws.departmentId
  LEFT JOIN users approver ON approver.id = ws.approvedByUserId
  LEFT JOIN officers approverOfficer ON approverOfficer.userId = ws.approvedByUserId
  LEFT JOIN users creatorUser ON creatorUser.id = ws.createdByUserId
  LEFT JOIN officers creatorOfficer ON creatorOfficer.id = ws.createdByOfficerId
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
      await ensureWorkScheduleAccessSchema(connection);
      const accessState = await getWorkScheduleAccessState(connection, req.user || {});
      const canViewPending = Boolean(accessState.canCreateWorkSchedules || accessState.canApproveWorkSchedules);

      const [rows] = await connection.execute(
        `${scheduleSelect} WHERE ws.id = ?${canViewPending ? '' : " AND ws.approvalStatus = 'approved'"}`,
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
      departmentId = null,
      department,
      type,
      weekNo,
      notes = '',
      responsibleOfficerId = null,
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

    const resolvedResponsibleOfficerId = responsibleOfficerId || commanderOfficerId || null;

    if (!resolvedResponsibleOfficerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: responsibleOfficerId',
        code: 'VALIDATION_ERROR',
      });
    }

    const participantsJson = participants ? JSON.stringify(participants) : null;

    const connection = await pool.getConnection();

    try {
      await ensureWorkScheduleApprovalSchema(connection);
      await ensureWorkScheduleAccessSchema(connection);
      const accessState = await getWorkScheduleAccessState(connection, req.user || {});
      if (!accessState.canCreateWorkSchedules) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền tạo lịch công tác.',
          code: 'FORBIDDEN',
        });
      }

      const [maxIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as maxNum FROM work_schedules WHERE id LIKE 'LCT%'"
      );
      const nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const newId = `LCT${String(nextNum).padStart(3, '0')}`;
      const approvalStatus = 'pending';
      const approvedByUserId = null;
      const approvedAt = null;
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const departmentRef = departmentId
        ? await resolveDepartmentRef(connection, { departmentId, department })
        : null;

      await connection.execute(
        `INSERT INTO work_schedules (
          id, title, date, startTime, endTime, location, department, departmentId, type, weekNo, notes,
          responsibleOfficerId, officer1Id, officer2Id, commanderOfficerId,
          participants, approvalStatus, approvedByUserId, approvedAt, createdByUserId, createdByOfficerId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
        [
          newId,
          title,
          date,
          startTime || null,
          endTime || null,
          location || '',
          departmentRef?.name || department || '',
          departmentRef?.id || null,
          type,
          weekNo || null,
          notes,
          resolvedResponsibleOfficerId,
          null,
          null,
          null,
          participantsJson,
          approvalStatus,
          approvedByUserId,
          approvedAt,
          req.user?.id || null,
          requesterOfficer?.id || null,
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

        const [approverRows] = await connection.execute(
          `SELECT DISTINCT o.userId
           FROM work_schedule_permissions wsp
           INNER JOIN officers o ON o.id = wsp.officerId
           INNER JOIN users u ON u.id = o.userId
           WHERE wsp.canApproveWorkSchedules = 1
             AND o.userId IS NOT NULL
             AND u.status = 'active'`
        );

        for (const row of approverRows) {
          if (!row.userId) continue;
          await createUserNotification(connection, {
            title: 'Co lich cong tac cho duyet',
            content: `${title} (${date})`,
            type: 'warning',
            module: 'lichcongtac',
            entityType: 'work_schedule',
            entityId: newId,
            targetUserId: row.userId,
          });
        }
      } else {
        const targetUserId = await resolveUserIdByOfficerId(connection, resolvedResponsibleOfficerId);
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
      await ensureWorkScheduleAccessSchema(connection);
      const accessState = await getWorkScheduleAccessState(connection, req.user || {});
      if (!accessState.canApproveWorkSchedules) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền duyệt lịch công tác.',
          code: 'FORBIDDEN',
        });
      }

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

      if (approvalStatus === 'approved') {
        const approvedByUserId = req.user?.id || null;
        const approvedAt = new Date();
        await connection.execute(
          `UPDATE work_schedules
           SET approvalStatus = ?, approvedByUserId = ?, approvedAt = ?
           WHERE id = ?`,
          [approvalStatus, approvedByUserId, approvedAt, id]
        );
      } else {
        await connection.execute('DELETE FROM work_schedules WHERE id = ?', [id]);
      }

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
          title: approvalStatus === 'approved' ? 'Lich cong tac da duoc duyet' : 'Lich cong tac khong duoc duyet va da bi xoa',
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
        message: approvalStatus === 'approved' ? 'Work schedule approved successfully' : 'Work schedule rejected and deleted successfully',
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
      departmentId,
      department,
      type,
      weekNo,
      notes,
      responsibleOfficerId,
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
      if (department !== undefined || departmentId !== undefined) {
        const departmentRef = departmentId
          ? await resolveDepartmentRef(connection, { departmentId, department })
          : null;
        if (departmentRef) {
          addField('department', departmentRef.name);
          addField('departmentId', departmentRef.id);
        } else {
          addField('department', department || '');
          addField('departmentId', null);
        }
      }
      if (type !== undefined) addField('type', type);
      if (weekNo !== undefined) addField('weekNo', weekNo || null);
      if (notes !== undefined) addField('notes', notes || '');
      if (responsibleOfficerId !== undefined) addField('responsibleOfficerId', responsibleOfficerId || null);
      if (commanderOfficerId !== undefined && responsibleOfficerId === undefined) addField('responsibleOfficerId', commanderOfficerId || null);
      if (participants !== undefined) addField('participants', participants ? JSON.stringify(participants) : null);
      if (responsibleOfficerId !== undefined || commanderOfficerId !== undefined) {
        addField('officer1Id', null);
        addField('officer2Id', null);
        addField('commanderOfficerId', null);
      }

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
