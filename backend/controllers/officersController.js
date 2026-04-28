import pool from '../config/database.js';
import { OFFICER_ROLES, USER_STATUS } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureDutyScheduleAccessSchema,
  canGrantDutySchedulePermissions,
} from '../utils/dutyScheduleAccess.js';
import {
  ensureWorkScheduleAccessSchema,
  canGrantWorkSchedulePermissions,
} from '../utils/workScheduleAccess.js';
import {
  createUserNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';
import {
  ensureAdminDelegationSchema,
  listDelegatedOfficerIdsByAdmin,
} from '../utils/adminDelegation.js';

const USER_ROLE_TO_OFFICER_ROLE = {
  admin: 'leader',
  manager: 'manager',
  officer: 'officer',
};

const buildDefaultPosition = (role) => {
  if (role === 'leader') return 'Lãnh đạo';
  if (role === 'manager') return 'Quản lý';
  return 'Cán bộ';
};

const splitTitleAndName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { officerTitle: '', officerName: String(fullName || '').trim() };
  }
  return {
    officerTitle: parts.slice(0, parts.length - 2).join(' '),
    officerName: parts.slice(-2).join(' '),
  };
};

const buildDefaultDepartment = (role) => {
  if (role === 'leader') return 'Ban Giám đốc';
  return 'Chưa phân công';
};

const hasOfficersUserIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'userId'");
  return rows.length > 0;
};

const hasOfficersDepartmentIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'departmentId'");
  return rows.length > 0;
};

const hasOfficersBusinessTripStartDateColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'businessTripStartDate'");
  return rows.length > 0;
};

const hasOfficersBusinessTripEndDateColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'businessTripEndDate'");
  return rows.length > 0;
};

const normalizeOfficerStatus = (status = '') => {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'on_business_trip') return 'on_business_trip';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'studying') return 'studying';
  return 'active';
};

const ensureOfficersStatusSchema = async (connection) => {
  await connection.execute(
    "ALTER TABLE officers MODIFY COLUMN status ENUM('active', 'on_business_trip', 'inactive', 'studying') DEFAULT 'active'"
  );

  const hasBusinessTripStartDateColumn = await hasOfficersBusinessTripStartDateColumn(connection);
  if (!hasBusinessTripStartDateColumn) {
    await connection.execute("ALTER TABLE officers ADD COLUMN businessTripStartDate DATE NULL AFTER studyUntil");
  }

  const hasBusinessTripEndDateColumn = await hasOfficersBusinessTripEndDateColumn(connection);
  if (!hasBusinessTripEndDateColumn) {
    await connection.execute("ALTER TABLE officers ADD COLUMN businessTripEndDate DATE NULL AFTER businessTripStartDate");
  }
};

const resolveDepartmentRef = async (connection, { departmentId, department }) => {
  if (departmentId) {
    const [rows] = await connection.execute(
      'SELECT id, name, departmentType FROM departments WHERE id = ? AND isActive = 1 LIMIT 1',
      [departmentId]
    );
    if (!rows.length) return null;
    return rows[0];
  }

  if (!department) return null;

  const [rows] = await connection.execute(
    'SELECT id, name, departmentType FROM departments WHERE name = ? AND isActive = 1 LIMIT 1',
    [department]
  );
  if (!rows.length) return null;
  return rows[0];
};

const resolveRequesterOfficer = async (connection, reqUser = {}) => {
  const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
  const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
  const selectDepartment = hasDepartmentIdColumn ? 'departmentId, department,' : 'NULL AS departmentId, department,';

  if (hasUserIdColumn) {
    const [rows] = await connection.execute(
      `SELECT id, ${selectDepartment} role FROM officers WHERE userId = ? LIMIT 1`,
      [reqUser.id]
    );
    if (rows[0]) return rows[0];
  }

  const [rows] = await connection.execute(
    `SELECT id, ${selectDepartment} role
     FROM officers
     WHERE (email = ? AND ? <> '') OR fullName = ?
     LIMIT 1`,
    [reqUser.email || '', reqUser.email || '', reqUser.fullName || '']
  );
  return rows[0] || null;
};

const syncUsersToOfficers = async (connection) => {
  const hasUserIdColumn = await hasOfficersUserIdColumn(connection);

  // Backfill old user accounts that exist in users but not in officers.
  const [missingUsers] = hasUserIdColumn
    ? await connection.execute(
      `SELECT u.id as userId, u.fullName, u.militaryRank, u.email, u.role, u.status
       FROM users u
       LEFT JOIN officers o ON o.userId = u.id
       WHERE u.role IN ('admin', 'manager', 'officer')
         AND o.id IS NULL`
    )
    : await connection.execute(
      `SELECT u.id as userId, u.fullName, u.militaryRank, u.email, u.role, u.status
       FROM users u
       LEFT JOIN officers o ON ((u.email IS NOT NULL AND u.email <> '' AND o.email = u.email) OR o.fullName = u.fullName)
       WHERE u.role IN ('admin', 'manager', 'officer')
         AND o.id IS NULL`
    );

  if (!missingUsers.length) return;

  const [maxIdRows] = await connection.execute(
    "SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) as maxNum FROM officers WHERE id LIKE 'CB%'"
  );
  let nextNum = (maxIdRows[0].maxNum || 0) + 1;

  for (const u of missingUsers) {
    const officerId = `CB${String(nextNum).padStart(3, '0')}`;
    const officerRole = USER_ROLE_TO_OFFICER_ROLE[u.role] || 'officer';
    const split = splitTitleAndName(u.fullName);
    const resolvedOfficerTitle = String(u.militaryRank || '').trim() || '';
    if (hasUserIdColumn) {
      await connection.execute(
        `INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, phone, email, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          officerId,
          u.userId,
          u.fullName,
          resolvedOfficerTitle,
          split.officerName,
          buildDefaultPosition(officerRole),
          buildDefaultDepartment(officerRole),
          null,
          u.email,
          officerRole,
          u.status || 'active',
        ]
      );
    } else {
      await connection.execute(
        `INSERT INTO officers (id, fullName, officerTitle, officerName, position, department, phone, email, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          officerId,
          u.fullName,
          resolvedOfficerTitle,
          split.officerName,
          buildDefaultPosition(officerRole),
          buildDefaultDepartment(officerRole),
          null,
          u.email,
          officerRole,
          u.status || 'active',
        ]
      );
    }
    nextNum += 1;
  }
};

// Get all officers with pagination and filters
export const getOfficers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', status = '', accessScope = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const connection = await pool.getConnection();

    try {
      await ensureOfficersStatusSchema(connection);
      await syncUsersToOfficers(connection);
      await ensureDutyScheduleAccessSchema(connection);
      await ensureWorkScheduleAccessSchema(connection);
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);

      // Build WHERE clause
      let whereConditions = [];
      let params = [];

      const isSystemScope = String(accessScope).toLowerCase() === 'system';

      if (!isSystemScope && req.user?.role === 'officer') {
        if (!requesterOfficer?.id) {
          return res.json({
            success: true,
            data: [],
            pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), pages: 0 },
          });
        }
        whereConditions.push('id = ?');
        params.push(requesterOfficer.id);
      } else if (!isSystemScope && req.user?.role === 'manager') {
        // Manager can only see officers in their department
        const managerDept = requesterOfficer?.department || req.user?.department;
        if (managerDept) {
          whereConditions.push('department = ?');
          params.push(managerDept);
        }
      }

      if (search) {
        whereConditions.push("(fullName LIKE ? OR id LIKE ? OR department LIKE ?)");
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (role) {
        whereConditions.push("role = ?");
        params.push(role);
      }

      if (status) {
        whereConditions.push("status = ?");
        params.push(status);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM officers ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // Get paginated data
      const [officers] = await connection.execute(
        `SELECT o.*,
                COALESCE(dsp.canManageDutySchedules, 0) AS canManageDutySchedulesByPermission,
                COALESCE(wsp.canCreateWorkSchedules, 0) AS canCreateWorkSchedulesByPermission,
                COALESCE(wsp.canApproveWorkSchedules, 0) AS canApproveWorkSchedulesByPermission,
                CASE
                  WHEN o.role = 'leader' OR o.role = 'manager' THEN 1
                  ELSE 0
                END AS canManageDutySchedulesByDepartment,
                CASE
                  WHEN o.role = 'leader' OR o.role = 'manager' THEN 1
                  ELSE 0
                END AS canCreateWorkSchedulesByRole,
                CASE
                  WHEN o.role = 'leader' OR (o.role = 'manager' AND o.department = 'Phòng hành chính tổng hợp') THEN 1
                  ELSE 0
                END AS canApproveWorkSchedulesByRole,
                CASE
                  WHEN (o.role = 'leader' OR o.role = 'manager')
                       OR COALESCE(dsp.canManageDutySchedules, 0) = 1
                  THEN 1 ELSE 0
                END AS canManageDutySchedules,
                CASE
                  WHEN o.role IN ('leader', 'manager') OR COALESCE(wsp.canCreateWorkSchedules, 0) = 1
                  THEN 1 ELSE 0
                END AS canCreateWorkSchedules,
                CASE
                  WHEN o.role = 'leader' OR (o.role = 'manager' AND o.department = 'Phòng hành chính tổng hợp') OR COALESCE(wsp.canApproveWorkSchedules, 0) = 1
                  THEN 1 ELSE 0
                END AS canApproveWorkSchedules,
                dsp.grantedAt AS dutySchedulePermissionGrantedAt,
                dsp.grantedByUserId AS dutySchedulePermissionGrantedByUserId,
                wsp.grantedAt AS workSchedulePermissionGrantedAt,
                wsp.grantedByUserId AS workSchedulePermissionGrantedByUserId
         FROM officers o
         LEFT JOIN duty_schedule_permissions dsp ON dsp.officerId = o.id
         LEFT JOIN work_schedule_permissions wsp ON wsp.officerId = o.id
         ${whereClause}
         ORDER BY
           CASE o.role
             WHEN 'leader' THEN 1
             WHEN 'manager' THEN 2
             WHEN 'officer' THEN 3
             ELSE 4
           END,
           o.id ASC
         LIMIT ${parseInt(limit)} OFFSET ${offset}`,
        params
      );

      res.json({
        success: true,
        data: officers,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Get single officer by ID
export const getOfficerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await ensureOfficersStatusSchema(connection);
      await ensureDutyScheduleAccessSchema(connection);
      await ensureWorkScheduleAccessSchema(connection);
      const [rows] = await connection.execute(
        `SELECT o.*,
                COALESCE(dsp.canManageDutySchedules, 0) AS canManageDutySchedulesByPermission,
                COALESCE(wsp.canCreateWorkSchedules, 0) AS canCreateWorkSchedulesByPermission,
                COALESCE(wsp.canApproveWorkSchedules, 0) AS canApproveWorkSchedulesByPermission,
                CASE
                  WHEN o.role = 'leader' OR o.role = 'manager' THEN 1
                  ELSE 0
                END AS canManageDutySchedulesByDepartment,
                CASE
                  WHEN o.role = 'leader' OR o.role = 'manager' THEN 1
                  ELSE 0
                END AS canCreateWorkSchedulesByRole,
                CASE
                  WHEN o.role = 'leader' OR (o.role = 'manager' AND o.department = 'Phòng hành chính tổng hợp') THEN 1
                  ELSE 0
                END AS canApproveWorkSchedulesByRole,
                CASE
                  WHEN (o.role = 'leader' OR o.role = 'manager')
                       OR COALESCE(dsp.canManageDutySchedules, 0) = 1
                  THEN 1 ELSE 0
                END AS canManageDutySchedules,
                CASE
                  WHEN o.role IN ('leader', 'manager') OR COALESCE(wsp.canCreateWorkSchedules, 0) = 1
                  THEN 1 ELSE 0
                END AS canCreateWorkSchedules,
                CASE
                  WHEN o.role = 'leader' OR (o.role = 'manager' AND o.department = 'Phòng hành chính tổng hợp') OR COALESCE(wsp.canApproveWorkSchedules, 0) = 1
                  THEN 1 ELSE 0
                END AS canApproveWorkSchedules,
                dsp.grantedAt AS dutySchedulePermissionGrantedAt,
                dsp.grantedByUserId AS dutySchedulePermissionGrantedByUserId,
                wsp.grantedAt AS workSchedulePermissionGrantedAt,
                wsp.grantedByUserId AS workSchedulePermissionGrantedByUserId
         FROM officers o
         LEFT JOIN duty_schedule_permissions dsp ON dsp.officerId = o.id
         LEFT JOIN work_schedule_permissions wsp ON wsp.officerId = o.id
         WHERE o.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Officer not found',
          code: 'OFFICER_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: rows[0],
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const updateDutySchedulePermission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const enabled = Boolean(req.body?.enabled);
    const connection = await pool.getConnection();

    try {
      await ensureDutyScheduleAccessSchema(connection);

      const allowed = await canGrantDutySchedulePermissions(connection, req.user || {});
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện', code: 'FORBIDDEN' });
      }

      const [officerRows] = await connection.execute(
        'SELECT id, fullName FROM officers WHERE id = ? LIMIT 1',
        [id]
      );
      if (!officerRows.length) {
        return res.status(404).json({ success: false, error: 'Officer not found', code: 'OFFICER_NOT_FOUND' });
      }

      const [currentPermissionRows] = await connection.execute(
        'SELECT canManageDutySchedules FROM duty_schedule_permissions WHERE officerId = ? LIMIT 1',
        [id]
      );
      const hadPermission = Boolean(currentPermissionRows[0]?.canManageDutySchedules);

      if (enabled) {
        await connection.execute(
          `INSERT INTO duty_schedule_permissions (officerId, canManageDutySchedules, grantedByUserId)
           VALUES (?, 1, ?)
           ON DUPLICATE KEY UPDATE
             canManageDutySchedules = VALUES(canManageDutySchedules),
             grantedByUserId = VALUES(grantedByUserId),
             grantedAt = CURRENT_TIMESTAMP,
             updatedAt = CURRENT_TIMESTAMP`,
          [id, req.user?.id || null]
        );

        if (!hadPermission) {
          const targetUserId = await resolveUserIdByOfficerId(connection, id);
          await createUserNotification(connection, {
            title: 'Bạn vừa được cấp quyền lịch trực ban',
            content: 'Bạn đã được cấp quyền lập/sửa lịch trực ban. Vui lòng đăng nhập lại nếu chưa thấy quyền mới.',
            type: 'success',
            module: 'lichtrucban',
            entityType: 'duty_schedule_permission',
            entityId: id,
            targetUserId,
          });
        }
      } else {
        await connection.execute(
          'DELETE FROM duty_schedule_permissions WHERE officerId = ?',
          [id]
        );
      }

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: enabled ? 'grant_permission' : 'revoke_permission',
        entityType: 'duty_schedule_permission',
        entityId: id,
        summary: `${enabled ? 'Cấp' : 'Thu hồi'} quyền lịch trực cho ${officerRows[0].fullName}`,
      });

      return res.json({
        success: true,
        data: {
          officerId: id,
          canManageDutySchedulesByPermission: enabled,
        },
        message: enabled ? 'Đã cấp quyền lập/sửa lịch trực.' : 'Đã thu hồi quyền lập/sửa lịch trực.',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const updateWorkSchedulePermission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const enabled = req.body?.enabled;
    const canCreateWorkSchedules = req.body?.canCreateWorkSchedules;
    const canApproveWorkSchedules = req.body?.canApproveWorkSchedules;

    const nextCanCreate = canCreateWorkSchedules === undefined
      ? Boolean(enabled)
      : Boolean(canCreateWorkSchedules);
    const nextCanApprove = canApproveWorkSchedules === undefined
      ? Boolean(enabled)
      : Boolean(canApproveWorkSchedules);

    const connection = await pool.getConnection();

    try {
      await ensureWorkScheduleAccessSchema(connection);

      const allowed = await canGrantWorkSchedulePermissions(connection, req.user || {});
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện', code: 'FORBIDDEN' });
      }

      const [officerRows] = await connection.execute(
        'SELECT id, fullName FROM officers WHERE id = ? LIMIT 1',
        [id]
      );
      if (!officerRows.length) {
        return res.status(404).json({ success: false, error: 'Officer not found', code: 'OFFICER_NOT_FOUND' });
      }

      const [currentPermissionRows] = await connection.execute(
        `SELECT
           COALESCE(canCreateWorkSchedules, 0) AS canCreateWorkSchedules,
           COALESCE(canApproveWorkSchedules, 0) AS canApproveWorkSchedules
         FROM work_schedule_permissions
         WHERE officerId = ?
         LIMIT 1`,
        [id]
      );
      const hadCreatePermission = Boolean(currentPermissionRows[0]?.canCreateWorkSchedules);
      const hadApprovePermission = Boolean(currentPermissionRows[0]?.canApproveWorkSchedules);
      const hadAnyPermission = hadCreatePermission || hadApprovePermission;

      if (nextCanCreate || nextCanApprove) {
        await connection.execute(
          `INSERT INTO work_schedule_permissions (officerId, canCreateWorkSchedules, canApproveWorkSchedules, grantedByUserId)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             canCreateWorkSchedules = VALUES(canCreateWorkSchedules),
             canApproveWorkSchedules = VALUES(canApproveWorkSchedules),
             grantedByUserId = VALUES(grantedByUserId),
             grantedAt = CURRENT_TIMESTAMP,
             updatedAt = CURRENT_TIMESTAMP`,
          [id, nextCanCreate ? 1 : 0, nextCanApprove ? 1 : 0, req.user?.id || null]
        );

        if (!hadAnyPermission) {
          const targetUserId = await resolveUserIdByOfficerId(connection, id);
          const grantedLabels = [];
          if (nextCanCreate) grantedLabels.push('tạo Lịch sự kiện');
          if (nextCanApprove) grantedLabels.push('duyệt Lịch sự kiện');

          await createUserNotification(connection, {
            title: 'Bạn vừa được cấp quyền Lịch sự kiện',
            content: `Bạn đã được cấp quyền ${grantedLabels.join(' và ')}. Vui lòng đăng nhập lại nếu chưa thấy quyền mới.`,
            type: 'success',
            module: 'lichcongtac',
            entityType: 'work_schedule_permission',
            entityId: id,
            targetUserId,
          });
        }
      } else {
        await connection.execute(
          'DELETE FROM work_schedule_permissions WHERE officerId = ?',
          [id]
        );
      }

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichcongtac',
        action: nextCanCreate || nextCanApprove ? 'grant_permission' : 'revoke_permission',
        entityType: 'work_schedule_permission',
        entityId: id,
        summary: `${nextCanCreate || nextCanApprove ? 'Cấp' : 'Thu hồi'} quyền Lịch sự kiện cho ${officerRows[0].fullName}`,
      });

      return res.json({
        success: true,
        data: {
          officerId: id,
          canCreateWorkSchedulesByPermission: nextCanCreate,
          canApproveWorkSchedulesByPermission: nextCanApprove,
        },
        message: nextCanCreate || nextCanApprove
          ? 'Đã cập nhật quyền lịch sự kiện.'
          : 'Đã thu hồi quyền lịch sự kiện.',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const getAdminDelegations = async (req, res, next) => {
  try {
    const effectiveRole = req.user?.effectiveRole || req.user?.role;
    if (!['admin', 'manager'].includes(effectiveRole)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện', code: 'FORBIDDEN' });
    }

    const connection = await pool.getConnection();
    try {
      await ensureAdminDelegationSchema(connection);
      const delegatedOfficerIds = await listDelegatedOfficerIdsByAdmin(connection, req.user.id);
      return res.json({ success: true, data: { delegatedOfficerIds } });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const updateAdminDelegation = async (req, res, next) => {
  try {
    const effectiveRole = req.user?.effectiveRole || req.user?.role;
    if (!['admin', 'manager'].includes(effectiveRole)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện', code: 'FORBIDDEN' });
    }

    const { id } = req.params;
    const enabled = Boolean(req.body?.enabled);
    const connection = await pool.getConnection();

    try {
      await ensureAdminDelegationSchema(connection);
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});

      const [officerRows] = await connection.execute(
        `SELECT o.id,
                o.userId,
                o.fullName,
                ${hasDepartmentIdColumn ? 'o.departmentId,' : 'NULL AS departmentId,'}
                o.department,
                u.role AS userRole
         FROM officers o
         LEFT JOIN users u ON u.id = o.userId
         WHERE o.id = ?
         LIMIT 1`,
        [id]
      );

      if (!officerRows.length) {
        return res.status(404).json({ success: false, error: 'Officer not found', code: 'OFFICER_NOT_FOUND' });
      }

      const officer = officerRows[0];
      if (!officer.userId) {
        return res.status(400).json({
          success: false,
          error: 'Cán bộ chưa có tài khoản người dùng để ủy quyền.',
          code: 'INVALID_DELEGATION_TARGET',
        });
      }

      if (['admin', 'superadmin'].includes(String(officer.userRole || '').toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Không thể ủy quyền cho tài khoản admin/superadmin.',
          code: 'INVALID_DELEGATION_TARGET',
        });
      }

      if (Number(officer.userId) === Number(req.user.id)) {
        return res.status(400).json({
          success: false,
          error: 'Không thể tự ủy quyền cho chính mình.',
          code: 'INVALID_DELEGATION_TARGET',
        });
      }

      const requesterDepartmentMatches = hasDepartmentIdColumn && requesterOfficer?.departmentId
        ? Number(officer.departmentId || 0) === Number(requesterOfficer.departmentId || 0)
        : String(officer.department || '').trim() === String(requesterOfficer?.department || '').trim();

      if (effectiveRole === 'manager') {
        if (String(officer.userRole || '').toLowerCase() !== 'officer') {
          return res.status(400).json({
            success: false,
            error: 'Quản lý chỉ được ủy quyền cho cán bộ trong đơn vị của mình.',
            code: 'INVALID_DELEGATION_TARGET',
          });
        }

        if (!requesterDepartmentMatches) {
          return res.status(403).json({
            success: false,
            error: 'Quản lý chỉ được ủy quyền cho cán bộ cùng phòng/khoa.',
            code: 'FORBIDDEN',
          });
        }
      }

      if (effectiveRole === 'admin' && req.user?.role !== 'admin' && !requesterDepartmentMatches) {
        return res.status(403).json({
          success: false,
          error: 'Người được ủy quyền admin chỉ được ủy quyền cho thành viên cùng phòng/khoa.',
          code: 'FORBIDDEN',
        });
      }

      if (enabled) {
        await connection.execute(
          `INSERT INTO admin_delegations (delegatorUserId, delegateUserId, delegateOfficerId, isActive)
           VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
             delegateOfficerId = VALUES(delegateOfficerId),
             isActive = 1,
             updatedAt = CURRENT_TIMESTAMP`,
          [req.user.id, officer.userId, officer.id]
        );
      } else {
        await connection.execute(
          `UPDATE admin_delegations
           SET isActive = 0,
               updatedAt = CURRENT_TIMESTAMP
           WHERE delegatorUserId = ?
             AND delegateUserId = ?`,
          [req.user.id, officer.userId]
        );
      }

      await createUserNotification(connection, {
        title: enabled ? 'Bạn đã được ủy quyền quyền hạn' : 'Bạn đã bị thu hồi quyền hạn được ủy quyền',
        content: enabled ? 'Bạn vừa được cấp quyền hạn thay thế từ người quản lý trực tiếp.' : 'Quyền hạn được ủy quyền của bạn đã bị thu hồi.',
        type: enabled ? 'info' : 'warning',
        module: 'canbo',
        entityType: 'admin_delegation',
        entityId: officer.id,
        targetUserId: officer.userId,
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'canbo',
        action: enabled ? 'grant_permission' : 'revoke_permission',
        entityType: 'admin_delegation',
        entityId: officer.id,
        summary: `${enabled ? 'Ủy quyền' : 'Bỏ ủy quyền'} quyền cho ${officer.fullName}`,
      });

      return res.json({
        success: true,
        data: {
          officerId: officer.id,
          delegated: enabled,
        },
        message: enabled ? 'Đã ủy quyền thành công.' : 'Đã Bỏ ủy quyền.',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Create new officer (admin only)
export const createOfficer = async (req, res, next) => {
  try {
    const {
      fullName,
      officerTitle,
      officerName,
      position,
      departmentId = null,
      department,
      phone,
      email,
      role = 'officer',
      status = 'active',
      studyUntil = null,
      businessTripStartDate = null,
      businessTripEndDate = null,
    } = req.body;

    // Validation
    if (!fullName || !position || (!department && !departmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fullName, position, department/departmentId',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!Object.values(OFFICER_ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${Object.values(OFFICER_ROLES).join(', ')}`,
        code: 'INVALID_ROLE',
      });
    }

    const normalizedStatus = normalizeOfficerStatus(status);
    const allowedStatuses = Object.values(USER_STATUS);
    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    if (normalizedStatus === 'on_business_trip' && (!businessTripStartDate || !businessTripEndDate)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessTripStartDate, businessTripEndDate',
        code: 'VALIDATION_ERROR',
      });
    }

    const connection = await pool.getConnection();

    try {
      await ensureOfficersStatusSchema(connection);
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
      const departmentRef = await resolveDepartmentRef(connection, { departmentId, department });

      if (!departmentRef) {
        return res.status(400).json({
          success: false,
          error: 'Invalid department selection',
          code: 'INVALID_DEPARTMENT',
        });
      }

      if (req.user?.role === 'manager') {
        if (!requesterOfficer?.department && !requesterOfficer?.departmentId) {
          return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện', code: 'FORBIDDEN' });
        }

        if (role !== 'officer') {
          return res.status(403).json({
            success: false,
            error: 'Manager can only create officers in their own department',
            code: 'FORBIDDEN',
          });
        }

        const managerDeptMatched = hasDepartmentIdColumn && requesterOfficer.departmentId
          ? Number(departmentRef.id) === Number(requesterOfficer.departmentId)
          : departmentRef.name === requesterOfficer.department;

        if (!managerDeptMatched) {
          return res.status(403).json({
            success: false,
            error: 'Manager can only create officers in their own department',
            code: 'FORBIDDEN',
          });
        }
      }

      // Generate new ID (CB + sequential number)
      const [maxIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) as maxNum FROM officers WHERE id LIKE 'CB%'"
      );
      const nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const newId = `CB${String(nextNum).padStart(3, '0')}`;

      // Insert
      const split = splitTitleAndName(fullName);
      const resolvedTitle = officerTitle !== undefined ? officerTitle : split.officerTitle;
      const resolvedName = officerName !== undefined ? officerName : split.officerName;

      if (hasDepartmentIdColumn) {
        await connection.execute(
          `INSERT INTO officers
           (id, fullName, officerTitle, officerName, position, departmentId, department, departmentGroup, phone, email, role, status, studyUntil, businessTripStartDate, businessTripEndDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            fullName,
            resolvedTitle,
            resolvedName,
            position,
            departmentRef.id,
            departmentRef.name,
            departmentRef.departmentType,
            phone || null,
            email || null,
            role,
            normalizedStatus,
            normalizedStatus === 'studying' ? studyUntil : null,
            normalizedStatus === 'on_business_trip' ? businessTripStartDate : null,
            normalizedStatus === 'on_business_trip' ? businessTripEndDate : null,
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO officers
           (id, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil, businessTripStartDate, businessTripEndDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            fullName,
            resolvedTitle,
            resolvedName,
            position,
            departmentRef.name,
            departmentRef.departmentType,
            phone || null,
            email || null,
            role,
            normalizedStatus,
            normalizedStatus === 'studying' ? studyUntil : null,
            normalizedStatus === 'on_business_trip' ? businessTripStartDate : null,
            normalizedStatus === 'on_business_trip' ? businessTripEndDate : null,
          ]
        );
      }

      res.status(201).json({
        success: true,
        data: {
          id: newId,
          fullName,
          position,
          departmentId: departmentRef.id,
          department: departmentRef.name,
          phone: phone || null,
          email: email || null,
          role,
          status: normalizedStatus,
          officerTitle: resolvedTitle,
          officerName: resolvedName,
          studyUntil: normalizedStatus === 'studying' ? studyUntil : null,
          businessTripStartDate: normalizedStatus === 'on_business_trip' ? businessTripStartDate : null,
          businessTripEndDate: normalizedStatus === 'on_business_trip' ? businessTripEndDate : null,
        },
        message: 'Officer created successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'canbo',
        action: 'create',
        entityType: 'officer',
        entityId: newId,
        summary: `Them moi can bo ${newId} - ${fullName}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Update officer (admin only)
export const updateOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      officerTitle,
      officerName,
      position,
      departmentId,
      department,
      phone,
      email,
      role,
      status,
      studyUntil,
      businessTripStartDate,
      businessTripEndDate,
    } = req.body;

    if (
      !fullName
      && !officerTitle
      && !officerName
      && !position
      && !department
      && !role
      && !status
      && !phone
      && !email
      && studyUntil === undefined
      && businessTripStartDate === undefined
      && businessTripEndDate === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        code: 'VALIDATION_ERROR',
      });
    }

    const normalizedStatus = status !== undefined ? normalizeOfficerStatus(status) : undefined;
    if (normalizedStatus !== undefined && !Object.values(USER_STATUS).includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${Object.values(USER_STATUS).join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    const connection = await pool.getConnection();

    try {
      await ensureOfficersStatusSchema(connection);
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
      const departmentRef = (department !== undefined || departmentId !== undefined)
        ? await resolveDepartmentRef(connection, { departmentId, department })
        : null;

      if ((department !== undefined || departmentId !== undefined) && !departmentRef) {
        return res.status(400).json({
          success: false,
          error: 'Invalid department selection',
          code: 'INVALID_DEPARTMENT',
        });
      }

      // Check if exists
      const [check] = await connection.execute(
        hasDepartmentIdColumn
          ? 'SELECT id, departmentId, department, role, status, studyUntil, businessTripStartDate, businessTripEndDate FROM officers WHERE id = ?'
          : 'SELECT id, NULL AS departmentId, department, role, status, studyUntil, businessTripStartDate, businessTripEndDate FROM officers WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Officer not found',
          code: 'OFFICER_NOT_FOUND',
        });
      }

      const nextStatus = normalizedStatus || check[0].status;
      if (nextStatus === 'on_business_trip') {
        const nextBusinessTripStartDate = businessTripStartDate !== undefined ? businessTripStartDate : check[0].businessTripStartDate;
        const nextBusinessTripEndDate = businessTripEndDate !== undefined ? businessTripEndDate : check[0].businessTripEndDate;
        if (!nextBusinessTripStartDate || !nextBusinessTripEndDate) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: businessTripStartDate, businessTripEndDate',
            code: 'VALIDATION_ERROR',
          });
        }
      }

      if (req.user?.role === 'manager') {
        const target = check[0];
        const sameDepartment = hasDepartmentIdColumn && requesterOfficer?.departmentId
          ? Number(target.departmentId) === Number(requesterOfficer.departmentId)
          : target.department === requesterOfficer?.department;

        if ((!requesterOfficer?.department && !requesterOfficer?.departmentId) || !sameDepartment || target.role === 'leader' || target.role === 'manager') {
          return res.status(403).json({
            success: false,
            error: 'Manager can only update officers in their own department',
            code: 'FORBIDDEN',
          });
        }

        const movingDepartment = departmentRef
          ? (hasDepartmentIdColumn && requesterOfficer?.departmentId
            ? Number(departmentRef.id) !== Number(requesterOfficer.departmentId)
            : departmentRef.name !== requesterOfficer.department)
          : false;

        if (movingDepartment || (role !== undefined && role !== 'officer')) {
          return res.status(403).json({
            success: false,
            error: 'Manager can only keep officers within their own department',
            code: 'FORBIDDEN',
          });
        }
      }

      // Build update query
      let updateFields = [];
      let params = [];

      if (fullName !== undefined) {
        updateFields.push('fullName = ?');
        params.push(fullName);
      }
      if (position !== undefined) {
        updateFields.push('position = ?');
        params.push(position);
      }
      if (departmentRef) {
        if (hasDepartmentIdColumn) {
          updateFields.push('departmentId = ?');
          params.push(departmentRef.id);
        }
        updateFields.push('department = ?');
        params.push(departmentRef.name);
        updateFields.push('departmentGroup = ?');
        params.push(departmentRef.departmentType);
      }
      if (phone !== undefined) {
        updateFields.push('phone = ?');
        params.push(phone);
      }
      if (email !== undefined) {
        updateFields.push('email = ?');
        params.push(email);
      }
      if (role !== undefined) {
        updateFields.push('role = ?');
        params.push(role);
      }
      if (normalizedStatus !== undefined) {
        updateFields.push('status = ?');
        params.push(normalizedStatus);
      }
      if (studyUntil !== undefined || normalizedStatus !== undefined) {
        updateFields.push('studyUntil = ?');
        params.push(nextStatus === 'studying' ? (studyUntil || null) : null);
      }
      if (businessTripStartDate !== undefined || normalizedStatus !== undefined) {
        updateFields.push('businessTripStartDate = ?');
        params.push(nextStatus === 'on_business_trip' ? (businessTripStartDate || null) : null);
      }
      if (businessTripEndDate !== undefined || normalizedStatus !== undefined) {
        updateFields.push('businessTripEndDate = ?');
        params.push(nextStatus === 'on_business_trip' ? (businessTripEndDate || null) : null);
      }

      if (officerTitle !== undefined) {
        updateFields.push('officerTitle = ?');
        params.push(officerTitle);
      }

      if (officerName !== undefined) {
        updateFields.push('officerName = ?');
        params.push(officerName);
      }

      if (fullName !== undefined && officerTitle === undefined && officerName === undefined) {
        const split = splitTitleAndName(fullName);
        updateFields.push('officerTitle = ?');
        params.push(split.officerTitle);
        updateFields.push('officerName = ?');
        params.push(split.officerName);
      }

      params.push(id);

      await connection.execute(
        `UPDATE officers SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      res.json({
        success: true,
        message: 'Officer updated successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'canbo',
        action: 'update',
        entityType: 'officer',
        entityId: id,
        summary: `Cap nhat thong tin can bo ${id}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Delete officer (admin only)
export const deleteOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);

      // Check if exists
      const [check] = await connection.execute(
        hasDepartmentIdColumn
          ? 'SELECT id, fullName, email, role, department, departmentId FROM officers WHERE id = ?'
          : 'SELECT id, fullName, email, role, department, NULL AS departmentId FROM officers WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Officer not found',
          code: 'OFFICER_NOT_FOUND',
        });
      }

      if (req.user?.role === 'manager') {
        const target = check[0];
        const sameDepartment = hasDepartmentIdColumn && requesterOfficer?.departmentId
          ? Number(target.departmentId) === Number(requesterOfficer.departmentId)
          : target.department === requesterOfficer?.department;

        if ((!requesterOfficer?.department && !requesterOfficer?.departmentId) || !sameDepartment || target.role !== 'officer') {
          return res.status(403).json({
            success: false,
            error: 'Manager can only delete officers in their own department',
            code: 'FORBIDDEN',
          });
        }
      }

      await connection.beginTransaction();

      // Delete from officers
      await connection.execute('DELETE FROM officers WHERE id = ?', [id]);

      // Also delete linked login account from users for DB consistency.
      const officer = check[0];
      if (officer.email) {
        await connection.execute('DELETE FROM users WHERE email = ?', [officer.email]);
      } else {
        const mappedUserRole = officer.role === 'leader' ? 'admin' : officer.role;
        await connection.execute(
          'DELETE FROM users WHERE fullName = ? AND role = ? LIMIT 1',
          [officer.fullName, mappedUserRole]
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Officer deleted successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'canbo',
        action: 'delete',
        entityType: 'officer',
        entityId: id,
        summary: `Xoa can bo ${id}`,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
