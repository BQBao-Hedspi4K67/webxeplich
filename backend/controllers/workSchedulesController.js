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
  if (!reqUser?.id && !reqUser?.email && !reqUser?.fullName) {
    return null;
  }

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

const normalizeParticipantPayload = (participants) => {
  if (!participants) return { units: [], boardMembers: [] };
  if (typeof participants === 'string') {
    try {
      const parsed = JSON.parse(participants);
      return {
        units: Array.isArray(parsed?.units) ? parsed.units : [],
        boardMembers: Array.isArray(parsed?.boardMembers) ? parsed.boardMembers : [],
      };
    } catch {
      return { units: [], boardMembers: [] };
    }
  }

  return {
    units: Array.isArray(participants?.units) ? participants.units : [],
    boardMembers: Array.isArray(participants?.boardMembers) ? participants.boardMembers : [],
  };
};

const buildDisplayName = (militaryRank = '', fullName = '') => {
  const rank = String(militaryRank || '').trim();
  const name = String(fullName || '').trim();
  if (!rank) return name;
  if (!name) return rank;
  const lowerRank = rank.toLowerCase();
  const lowerName = name.toLowerCase();
  if (lowerName === lowerRank || lowerName.startsWith(`${lowerRank} `)) {
    return name;
  }
  return `${rank} ${name}`;
};

const buildOfficerDisplaySql = (alias) => `
CASE
  WHEN ${alias}.officerTitle IS NULL OR TRIM(${alias}.officerTitle) = '' THEN TRIM(COALESCE(${alias}.fullName, ''))
  WHEN ${alias}.fullName IS NULL OR TRIM(${alias}.fullName) = '' THEN TRIM(${alias}.officerTitle)
  WHEN LOWER(TRIM(${alias}.fullName)) = LOWER(TRIM(${alias}.officerTitle))
       OR LOWER(TRIM(${alias}.fullName)) LIKE CONCAT(LOWER(TRIM(${alias}.officerTitle)), ' %')
    THEN TRIM(${alias}.fullName)
  ELSE CONCAT(TRIM(${alias}.officerTitle), ' ', TRIM(${alias}.fullName))
END`;

const formatOfficerDisplayName = (officer) => {
  const name = buildDisplayName(officer?.officerTitle, officer?.fullName);
  return name ? `đ/c ${name}` : '';
};

const enrichWorkScheduleParticipants = async (connection, rows = []) => {
  const normalizedRows = rows.map((row) => ({
    ...row,
    participants: normalizeParticipantPayload(row.participants),
  }));

  const boardMemberIds = Array.from(new Set(
    normalizedRows.flatMap((row) => row.participants.boardMembers || []).map((id) => String(id)).filter(Boolean)
  ));

  if (!boardMemberIds.length) {
    return normalizedRows.map((row) => ({
      ...row,
      participants: {
        ...row.participants,
        boardMemberLabels: [],
      },
    }));
  }

  const placeholders = boardMemberIds.map(() => '?').join(', ');
  const [officerRows] = await connection.execute(
    `SELECT id, officerTitle, fullName
     FROM officers
     WHERE id IN (${placeholders})`,
    boardMemberIds
  );

  const labelMap = new Map(
    officerRows.map((officer) => [String(officer.id), formatOfficerDisplayName(officer)])
  );

  return normalizedRows.map((row) => ({
    ...row,
    participants: {
      ...row.participants,
      boardMemberLabels: (row.participants.boardMembers || [])
        .map((id) => labelMap.get(String(id)))
        .filter(Boolean),
    },
  }));
};

const collectParticipantOfficerIds = async (connection, participants) => {
  const normalized = normalizeParticipantPayload(participants);
  const officerIds = new Set();

  for (const officerId of normalized.boardMembers) {
    if (officerId) officerIds.add(String(officerId));
  }

  const units = normalized.units
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x) => x !== 'Ban Giám đốc');

  if (!units.length) return Array.from(officerIds);

  const placeholders = units.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT id
     FROM officers
     WHERE status = 'active'
       AND department IN (${placeholders})`,
    units
  );

  for (const row of rows) {
    if (row?.id) officerIds.add(String(row.id));
  }

  return Array.from(officerIds);
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
    ${buildOfficerDisplaySql('creatorOfficer')} AS createdByOfficerName,
    creatorOfficer.departmentId AS createdByDepartmentId,
    creatorOfficer.department AS createdByDepartmentName,
    ${buildOfficerDisplaySql('ro')} AS responsibleOfficerName,
    ${buildOfficerDisplaySql('o1')} AS officer1Name,
    ${buildOfficerDisplaySql('o2')} AS officer2Name,
    ${buildOfficerDisplaySql('cmd')} AS commanderOfficerName
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
      await ensureWorkScheduleAccessSchema(connection);
      const accessState = await getWorkScheduleAccessState(connection, req.user || {});
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});

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

      let visibilityClause = '';
      const visibilityParams = [];
      if (!accessState.canApproveWorkSchedules) {
        visibilityClause = `${whereClause ? ' AND' : ' WHERE'} (ws.approvalStatus = 'approved' OR (ws.approvalStatus = 'pending' AND (ws.createdByUserId = ?${requesterOfficer?.id ? ' OR ws.createdByOfficerId = ?' : ''})))`;
        visibilityParams.push(req.user?.id || 0);
        if (requesterOfficer?.id) {
          visibilityParams.push(requesterOfficer.id);
        }
      }

      const queryParams = [...params, ...visibilityParams];

      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total
         FROM work_schedules ws
         LEFT JOIN officers ro ON ro.id = ws.responsibleOfficerId
         LEFT JOIN officers o1 ON o1.id = ws.officer1Id
         LEFT JOIN officers o2 ON o2.id = ws.officer2Id
         LEFT JOIN officers cmd ON cmd.id = ws.commanderOfficerId
         ${whereClause}${visibilityClause}`,
        queryParams
      );

      const [rows] = await connection.execute(
        `${scheduleSelect}
         ${whereClause}${visibilityClause}
         ORDER BY ws.date ASC
         LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
        queryParams
      );

      const enrichedRows = await enrichWorkScheduleParticipants(connection, rows);

      res.json({
        success: true,
        data: enrichedRows,
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
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const canViewPending = Boolean(accessState.canApproveWorkSchedules);
      const ownPendingClause = requesterOfficer?.id
        ? " OR (ws.approvalStatus = 'pending' AND (ws.createdByUserId = ? OR ws.createdByOfficerId = ?))"
        : " OR (ws.approvalStatus = 'pending' AND ws.createdByUserId = ?)";
      const ownPendingParams = requesterOfficer?.id
        ? [req.user?.id || 0, requesterOfficer.id]
        : [req.user?.id || 0];

      const [rows] = await connection.execute(
        `${scheduleSelect} WHERE ws.id = ?${canViewPending ? '' : ` AND (ws.approvalStatus = 'approved'${ownPendingClause})`}`,
        canViewPending ? [id] : [id, ...ownPendingParams]
      );

      const enrichedRows = await enrichWorkScheduleParticipants(connection, rows);

      if (!enrichedRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      res.json({ success: true, data: enrichedRows[0] });
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
          error: 'Bạn không có quyền tạo Lịch sự kiện.',
          code: 'FORBIDDEN',
        });
      }

      const [maxIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as maxNum FROM work_schedules WHERE id LIKE 'LCT%'"
      );
      const nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const newId = `LCT${String(nextNum).padStart(3, '0')}`;
      const approvalStatus = accessState.canApproveWorkSchedules ? 'approved' : 'pending';
      const approvedByUserId = accessState.canApproveWorkSchedules ? req.user?.id || null : null;
      const approvedAt = accessState.canApproveWorkSchedules ? new Date() : null;
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

      const recipientOfficerIds = new Set([resolvedResponsibleOfficerId]);
      const participantOfficerIds = await collectParticipantOfficerIds(connection, participants);
      for (const officerId of participantOfficerIds) {
        if (officerId) recipientOfficerIds.add(officerId);
      }

      for (const officerId of recipientOfficerIds) {
        const targetUserId = await resolveUserIdByOfficerId(connection, officerId);
        await createUserNotification(connection, {
          title: 'Bạn có Lịch sự kiện mới',
          content: `${title} (${date})`,
          type: 'info',
          module: 'lichcongtac',
          entityType: 'work_schedule',
          entityId: newId,
          targetUserId,
        });
      }

      if (approvalStatus === 'pending') {
        await createRoleNotification(connection, {
          title: 'Có Lịch sự kiện chờ duyệt',
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
            title: 'Có Lịch sự kiện chờ duyệt',
            content: `${title} (${date})`,
            type: 'warning',
            module: 'lichcongtac',
            entityType: 'work_schedule',
            entityId: newId,
            targetUserId: row.userId,
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
      await ensureWorkScheduleAccessSchema(connection);
      const accessState = await getWorkScheduleAccessState(connection, req.user || {});
      if (!accessState.canApproveWorkSchedules) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền duyệt Lịch sự kiện.',
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
          title: approvalStatus === 'approved' ? 'Lịch sự kiện đã được duyệt' : 'Lịch sự kiện không được duyệt và đã bị xóa',
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

      const accessState = await getWorkScheduleAccessState(connection, req.user || {});
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

      if (!accessState.canApproveWorkSchedules && currentStatus === 'approved') {
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

      // --- BAT DAU LOGIC GUI THONG BAO ---
      await ensureNotificationTargetingSchema(connection);

      // Lấy dữ liệu mới nhất để gửi thông báo chính xác
      const [updatedRows] = await connection.execute(
        'SELECT id, title, date, responsibleOfficerId, participants FROM work_schedules WHERE id = ?',
        [id]
      );
      const updatedSchedule = updatedRows[0];

      if (updatedSchedule) {
        const recipientOfficerIds = new Set();
        
        // Thêm người phụ trách vào danh sách nhận
        if (updatedSchedule.responsibleOfficerId) {
          recipientOfficerIds.add(String(updatedSchedule.responsibleOfficerId));
        }

        // Thêm tất cả cán bộ thuộc các phòng ban tham gia (sử dụng hàm helper có sẵn của bạn)
        const participantOfficerIds = await collectParticipantOfficerIds(connection, updatedSchedule.participants);
        for (const offId of participantOfficerIds) {
          if (offId) recipientOfficerIds.add(String(offId));
        }

        // Gửi thông báo đến từng user liên quan
        for (const offId of recipientOfficerIds) {
          const targetUserId = await resolveUserIdByOfficerId(connection, offId);
          if (targetUserId) {
            await createUserNotification(connection, {
              title: 'Lịch sự kiện có thay đổi',
              content: `Lịch: ${updatedSchedule.title} (${updatedSchedule.date}) đã được cập nhật nội dung mới.`,
              type: 'info',
              module: 'lichcongtac',
              entityType: 'work_schedule',
              entityId: id,
              targetUserId,
            });
          }
        }
      }
      // --- KET THUC LOGIC GUI THONG BAO ---

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
