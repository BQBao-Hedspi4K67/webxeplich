import pool from '../config/database.js';
import { OFFICER_ROLES, USER_STATUS } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';

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
      `SELECT u.id as userId, u.fullName, u.email, u.role, u.status
       FROM users u
       LEFT JOIN officers o ON o.userId = u.id
       WHERE u.role IN ('admin', 'manager', 'officer')
         AND o.id IS NULL`
    )
    : await connection.execute(
      `SELECT u.id as userId, u.fullName, u.email, u.role, u.status
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
    if (hasUserIdColumn) {
      await connection.execute(
        `INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, phone, email, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          officerId,
          u.userId,
          u.fullName,
          splitTitleAndName(u.fullName).officerTitle,
          splitTitleAndName(u.fullName).officerName,
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
          splitTitleAndName(u.fullName).officerTitle,
          splitTitleAndName(u.fullName).officerName,
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
      await syncUsersToOfficers(connection);
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);

      // Build WHERE clause
      let whereConditions = [];
      let params = [];

      const isSystemScope = String(accessScope).toLowerCase() === 'system';

      if (!isSystemScope && req.user?.role === 'manager') {
        if (!requesterOfficer?.department) {
          return res.json({
            success: true,
            data: [],
            pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), pages: 0 },
          });
        }
        if (hasDepartmentIdColumn && requesterOfficer.departmentId) {
          whereConditions.push('departmentId = ?');
          params.push(requesterOfficer.departmentId);
        } else {
          whereConditions.push('department = ?');
          params.push(requesterOfficer.department);
        }
      }

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
        `SELECT * FROM officers ${whereClause}
         ORDER BY
           CASE role
             WHEN 'leader' THEN 1
             WHEN 'manager' THEN 2
             WHEN 'officer' THEN 3
             ELSE 4
           END,
           id ASC
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
      const [rows] = await connection.execute(
        'SELECT * FROM officers WHERE id = ?',
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

    const connection = await pool.getConnection();

    try {
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
          return res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' });
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
           (id, fullName, officerTitle, officerName, position, departmentId, department, departmentGroup, phone, email, role, status, studyUntil)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            status,
            status === 'studying' ? studyUntil : null,
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO officers
           (id, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            status,
            status === 'studying' ? studyUntil : null,
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
          status,
          officerTitle: resolvedTitle,
          officerName: resolvedName,
          studyUntil: status === 'studying' ? studyUntil : null,
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
    const { fullName, officerTitle, officerName, position, departmentId, department, phone, email, role, status, studyUntil } = req.body;

    if (!fullName && !officerTitle && !officerName && !position && !department && !role && !status && !phone && !email && studyUntil === undefined) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        code: 'VALIDATION_ERROR',
      });
    }

    const connection = await pool.getConnection();

    try {
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
          ? 'SELECT id, departmentId, department, role, status FROM officers WHERE id = ?'
          : 'SELECT id, NULL AS departmentId, department, role, status FROM officers WHERE id = ?',
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
      if (status !== undefined) {
        updateFields.push('status = ?');
        params.push(status);
      }
      if (studyUntil !== undefined) {
        updateFields.push('studyUntil = ?');
        params.push(studyUntil || null);
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
