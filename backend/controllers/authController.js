import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';
import {
  ensureDutyScheduleAccessSchema,
  getDutyScheduleAccessState,
} from '../utils/dutyScheduleAccess.js';
import { getWorkScheduleAccessState } from '../utils/workScheduleAccess.js';

const ALLOWED_DEPARTMENTS = [
  'Ban Giám đốc',
  'Phòng hành chính tổng hợp',
  'Phòng chính trị',
  'Phòng quản lý đào tạo và BDNC',
  'Phòng ĐBCL đào tạo',
  'Phòng quản lý nghiên cứu khoa học',
  'Phòng quản lý học viên',
  'Phòng hậu cần',
  'Khoa Lý luận chính trị và KHXHNV',
  'Khoa Luật',
  'Khoa nghiệp vụ cơ bản',
  'Khoa khoa học cơ bản và ngoại ngữ',
  'Khoa quân sự, võ thuật, TDTT',
  'Khoa mật mã',
  'Khoa Công nghệ và ATTT',
  'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ',
  'Khoa Hồ sơ - Lưu trữ',
  'Khoa Hậu cần',
  'Khoa Y Dược',
];

const hasOfficersUserIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'userId'");
  return rows.length > 0;
};

const hasOfficersDepartmentIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'departmentId'");
  return rows.length > 0;
};

const hasDepartmentsTable = async (connection) => {
  const [rows] = await connection.execute("SHOW TABLES LIKE 'departments'");
  return rows.length > 0;
};

const hasUsersMilitaryRankColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM users LIKE 'militaryRank'");
  return rows.length > 0;
};

const ensureUsersMilitaryRankColumn = async (connection) => {
  const hasColumn = await hasUsersMilitaryRankColumn(connection);
  if (!hasColumn) {
    await connection.execute("ALTER TABLE users ADD COLUMN militaryRank VARCHAR(100) NULL AFTER fullName");
  }
};

const validateDepartment = async (connection, { departmentId, department }) => {
  const hasTable = await hasDepartmentsTable(connection);
  if (!hasTable) {
    if (!department) return null;
    return ALLOWED_DEPARTMENTS.includes(department) ? { id: null, name: department, departmentType: 'phong' } : null;
  }

  if (departmentId) {
    const [rows] = await connection.execute(
      'SELECT id, name, departmentType FROM departments WHERE id = ? AND isActive = 1 LIMIT 1',
      [departmentId]
    );
    return rows[0] || null;
  }

  if (!department) return null;

  const [rows] = await connection.execute(
    'SELECT id, name, departmentType FROM departments WHERE name = ? AND isActive = 1 LIMIT 1',
    [department]
  );
  return rows[0] || null;
};

const normalizeUsernameToken = (value = '') => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
};

const buildUsernameBase = (fullName = '') => {
  const tokens = normalizeUsernameToken(fullName).split(/\s+/).filter(Boolean);
  if (!tokens.length) return 'user';
  if (tokens.length === 1) return tokens[0].slice(0, 40);

  const lastName = tokens[tokens.length - 1];
  const initials = tokens.slice(0, -1).map((token) => token[0]).join('');
  const base = `${initials}${lastName}`;
  return base.slice(0, 40) || 'user';
};

const buildDisplayName = (militaryRank = '', fullName = '') => {
  const rank = String(militaryRank || '').trim();
  const name = String(fullName || '').trim();
  if (!rank) return name;
  if (!name) return rank;
  if (name.toLowerCase().startsWith(rank.toLowerCase())) return name;
  return `${rank} ${name}`;
};

const generateUniqueUsername = async (connection, fullName) => {
  const base = buildUsernameBase(fullName);
  const [rows] = await connection.execute(
    'SELECT username FROM users WHERE username LIKE ?',
    [`${base}%`]
  );

  const existing = new Set(rows.map((row) => String(row.username || '').toLowerCase()));
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}${suffix}`)) {
    suffix += 1;
  }
  return `${base}${suffix}`;
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

// Login
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    // Get connection
    const connection = await pool.getConnection();

    try {
      await ensureUsersMilitaryRankColumn(connection);

      // Find user
      const [rows] = await connection.execute(
        'SELECT id, username, passwordHash, fullName, militaryRank, email, role, avatar FROM users WHERE username = ? AND status = ?',
        [username, 'active']
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const user = rows[0];
      const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);

      let officerProfile = null;
      const [officerRows] = hasUserIdColumn
        ? await connection.execute(
          hasDepartmentIdColumn
            ? 'SELECT id, position, department, departmentId, phone, email, officerTitle FROM officers WHERE userId = ? LIMIT 1'
            : 'SELECT id, position, department, NULL AS departmentId, phone, email, officerTitle FROM officers WHERE userId = ? LIMIT 1',
          [user.id]
        )
        : [[], null];

      if (officerRows.length) {
        officerProfile = officerRows[0];
      } else {
        const [fallbackOfficerRows] = await connection.execute(
          `SELECT id, position, department, ${hasDepartmentIdColumn ? 'departmentId' : 'NULL AS departmentId'}, phone, email, officerTitle FROM officers
           WHERE (email = ? AND ? IS NOT NULL AND ? <> '') OR fullName = ?
           LIMIT 1`,
          [user.email || null, user.email || null, user.email || null, user.fullName]
        );
        if (fallbackOfficerRows.length) {
          officerProfile = fallbackOfficerRows[0];
          if (hasUserIdColumn) {
            await connection.execute(
              'UPDATE officers SET userId = ? WHERE id = ? AND userId IS NULL',
              [user.id, officerProfile.id]
            );
          }
        }
      }

      const resolvedMilitaryRank = officerProfile?.officerTitle || user.militaryRank || '';
      const displayName = buildDisplayName(resolvedMilitaryRank, user.fullName);

      // Compare password
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Generate token
      const token = generateToken(user);
      const accessState = await getDutyScheduleAccessState(connection, {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });
      const workAccessState = await getWorkScheduleAccessState(connection, {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            fullName: displayName,
            militaryRank: resolvedMilitaryRank,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            officerId: officerProfile?.id || null,
            position: officerProfile?.position || '',
            department: officerProfile?.department || '',
            departmentId: officerProfile?.departmentId || null,
            phone: officerProfile?.phone || '',
            canManageDutySchedules: accessState.canManageDutySchedules,
            canManageDutySchedulesByDepartment: accessState.canManageDutySchedulesByDepartment,
            canManageDutySchedulesByPermission: accessState.canManageDutySchedulesByPermission,
            canGrantDutySchedulePermissions: accessState.canGrantDutySchedulePermissions,
            canCreateWorkSchedules: workAccessState.canCreateWorkSchedules,
            canApproveWorkSchedules: workAccessState.canApproveWorkSchedules,
            canCreateWorkSchedulesByRole: workAccessState.canCreateWorkSchedulesByRole,
            canApproveWorkSchedulesByRole: workAccessState.canApproveWorkSchedulesByRole,
            canCreateWorkSchedulesByPermission: workAccessState.canCreateWorkSchedulesByPermission,
            canApproveWorkSchedulesByPermission: workAccessState.canApproveWorkSchedulesByPermission,
            canGrantWorkSchedulePermissions: workAccessState.canGrantWorkSchedulePermissions,
          },
        },
        message: 'Login successful',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Get current user profile
export const getProfile = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      await ensureUsersMilitaryRankColumn(connection);
      await ensureDutyScheduleAccessSchema(connection);
      const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
      const [rows] = hasUserIdColumn
        ? await connection.execute(
          `SELECT
             u.id,
             u.username,
             u.fullName,
             u.militaryRank,
             u.email,
             u.role,
             u.avatar,
             u.status,
             o.id AS officerId,
             o.officerTitle,
             o.position,
             o.department,
             o.phone,
             ${hasDepartmentIdColumn ? 'o.departmentId' : 'NULL AS departmentId'}
           FROM users u
           LEFT JOIN officers o ON o.userId = u.id
           WHERE u.id = ?
           LIMIT 1`,
          [req.user.id]
        )
        : await connection.execute(
          `SELECT
             u.id,
             u.username,
             u.fullName,
             u.militaryRank,
             u.email,
             u.role,
             u.avatar,
             u.status,
             NULL AS officerId,
             NULL AS officerTitle,
             NULL AS position,
             NULL AS department,
             NULL AS phone,
             NULL AS departmentId
           FROM users u
           WHERE u.id = ?
           LIMIT 1`,
          [req.user.id]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      let profile = rows[0];

      if (!profile.officerId) {
        const [fallbackOfficerRows] = await connection.execute(
          `SELECT id, position, department, ${hasDepartmentIdColumn ? 'departmentId' : 'NULL AS departmentId'}, phone, officerTitle FROM officers
           WHERE (email = ? AND ? IS NOT NULL AND ? <> '') OR fullName = ?
           LIMIT 1`,
          [profile.email || null, profile.email || null, profile.email || null, profile.fullName]
        );

        if (fallbackOfficerRows.length) {
          const fallbackOfficer = fallbackOfficerRows[0];
          if (hasUserIdColumn) {
            await connection.execute(
              'UPDATE officers SET userId = ? WHERE id = ? AND userId IS NULL',
              [profile.id, fallbackOfficer.id]
            );
          }

          profile = {
            ...profile,
            officerId: fallbackOfficer.id,
            officerTitle: fallbackOfficer.officerTitle || '',
            position: fallbackOfficer.position,
            department: fallbackOfficer.department,
            departmentId: fallbackOfficer.departmentId || null,
            phone: fallbackOfficer.phone || '',
          };
        }
      }

      const resolvedMilitaryRank = profile.officerTitle || profile.militaryRank || '';
      const displayName = buildDisplayName(resolvedMilitaryRank, profile.fullName);

      const accessState = await getDutyScheduleAccessState(connection, profile);
      const workAccessState = await getWorkScheduleAccessState(connection, profile);

      res.json({
        success: true,
        data: {
          ...profile,
          fullName: displayName,
          militaryRank: resolvedMilitaryRank,
          canManageDutySchedules: accessState.canManageDutySchedules,
          canManageDutySchedulesByDepartment: accessState.canManageDutySchedulesByDepartment,
          canManageDutySchedulesByPermission: accessState.canManageDutySchedulesByPermission,
          canGrantDutySchedulePermissions: accessState.canGrantDutySchedulePermissions,
          canCreateWorkSchedules: workAccessState.canCreateWorkSchedules,
          canApproveWorkSchedules: workAccessState.canApproveWorkSchedules,
          canCreateWorkSchedulesByRole: workAccessState.canCreateWorkSchedulesByRole,
          canApproveWorkSchedulesByRole: workAccessState.canApproveWorkSchedulesByRole,
          canCreateWorkSchedulesByPermission: workAccessState.canCreateWorkSchedulesByPermission,
          canApproveWorkSchedulesByPermission: workAccessState.canApproveWorkSchedulesByPermission,
          canGrantWorkSchedulePermissions: workAccessState.canGrantWorkSchedulePermissions,
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Logout (client-side only, but endpoint for completeness)
export const logout = (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful',
  });
};

// Create user account (internal provisioning only)
export const createUserAccount = async (req, res, next) => {
  try {
    let {
      fullName,
      militaryRank = '',
      email = null,
      phone = null,
      position = '',
      departmentId = null,
      department = '',
      role = 'officer',
      avatar = null,
      status = 'active',
    } = req.body;

    const splitTitleAndName = (name = '') => {
      const parts = String(name).trim().split(/\s+/).filter(Boolean);
      if (parts.length <= 1) return { officerTitle: '', officerName: String(name || '').trim() };
      return {
        officerTitle: parts.slice(0, parts.length - 2).join(' '),
        officerName: parts.slice(-2).join(' '),
      };
    };

    if (!fullName || (!department && !departmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fullName, department/departmentId',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be active or inactive.',
        code: 'INVALID_STATUS',
      });
    }

    const connection = await pool.getConnection();
    try {
      await ensureUsersMilitaryRankColumn(connection);
      await connection.beginTransaction();
      const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
      const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
      const requesterOfficer = await resolveRequesterOfficer(connection, req.user || {});

      if (req.user?.role === 'manager') {
        if (!requesterOfficer?.department && !requesterOfficer?.departmentId) {
          return res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' });
        }
        role = 'officer';
        department = requesterOfficer.department;
      }

      const departmentRef = await validateDepartment(connection, {
        departmentId: req.user?.role === 'manager' ? requesterOfficer?.departmentId : departmentId,
        department: req.user?.role === 'manager' ? requesterOfficer?.department : department,
      });
      if (!departmentRef) {
        return res.status(400).json({
          success: false,
          error: 'Invalid department selection',
          code: 'INVALID_DEPARTMENT',
        });
      }

      const allowedRoles = req.user?.role === 'manager' ? ['officer'] : ['manager', 'officer'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role for current user',
          code: 'INVALID_ROLE',
        });
      }

      const username = await generateUniqueUsername(connection, fullName);

      if (email) {
        const [existingEmail] = await connection.execute(
          'SELECT id FROM users WHERE email = ? LIMIT 1',
          [email]
        );

        if (existingEmail.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Email already exists',
            code: 'EMAIL_EXISTS',
          });
        }
      }

      const passwordHash = await bcrypt.hash('123456', 10);

      const [result] = await connection.execute(
        `INSERT INTO users (username, passwordHash, fullName, militaryRank, email, role, avatar, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, passwordHash, fullName, militaryRank || null, email, role, avatar, status]
      );

      const [maxOfficerIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) as maxNum FROM officers WHERE id LIKE 'CB%'"
      );
      const nextOfficerNum = (maxOfficerIdRows[0].maxNum || 0) + 1;
      const newOfficerId = `CB${String(nextOfficerNum).padStart(3, '0')}`;

      const officerPosition = position || (role === 'manager' ? 'Quản lý' : 'Cán bộ');
      const officerDepartment = departmentRef.name;
      const split = splitTitleAndName(fullName);
      const resolvedOfficerTitle = String(militaryRank || '').trim() || split.officerTitle;

      if (hasUserIdColumn) {
        if (hasDepartmentIdColumn) {
          await connection.execute(
            `INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, departmentId, department, departmentGroup, phone, email, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newOfficerId,
              result.insertId,
              fullName,
              resolvedOfficerTitle,
              split.officerName,
              officerPosition,
              departmentRef.id,
              officerDepartment,
              departmentRef.departmentType || 'phong',
              phone,
              email,
              role,
              status,
            ]
          );
        } else {
          await connection.execute(
            `INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newOfficerId, result.insertId, fullName, resolvedOfficerTitle, split.officerName, officerPosition, officerDepartment, departmentRef.departmentType || 'phong', phone, email, role, status]
          );
        }
      } else {
        await connection.execute(
          `INSERT INTO officers (id, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newOfficerId, fullName, resolvedOfficerTitle, split.officerName, officerPosition, officerDepartment, departmentRef.departmentType || 'phong', phone, email, role, status]
        );
      }

      const [createdRows] = await connection.execute(
        'SELECT id, username, fullName, militaryRank, email, role, avatar, status, createdAt FROM users WHERE id = ?',
        [result.insertId]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        data: {
          ...createdRows[0],
          officerId: newOfficerId,
          officerPosition,
          officerDepartmentId: departmentRef.id || null,
          officerDepartment,
        },
        message: 'User account created successfully',
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

// Update contact info for current user
export const updateMyContact = async (req, res, next) => {
  try {
    const { phone = null, email = null } = req.body || {};
    const normalizedPhone = phone === null ? null : String(phone).trim();
    const normalizedEmail = email === null ? null : String(email).trim().toLowerCase();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (normalizedEmail) {
        const [emailRows] = await connection.execute(
          'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
          [normalizedEmail, req.user.id]
        );
        if (emailRows.length) {
          return res.status(409).json({
            success: false,
            error: 'Email already exists',
            code: 'EMAIL_EXISTS',
          });
        }
      }

      await connection.execute(
        'UPDATE users SET email = ? WHERE id = ?',
        [normalizedEmail || null, req.user.id]
      );

      const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
      if (hasUserIdColumn) {
        await connection.execute(
          'UPDATE officers SET phone = ?, email = ? WHERE userId = ?',
          [normalizedPhone || null, normalizedEmail || null, req.user.id]
        );
      } else {
        await connection.execute(
          `UPDATE officers
           SET phone = ?, email = ?
           WHERE (email = ? AND ? <> '') OR fullName = ?`,
          [normalizedPhone || null, normalizedEmail || null, req.user.email || '', req.user.email || '', req.user.fullName || '']
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        data: {
          username: req.user.username,
          phone: normalizedPhone || null,
          email: normalizedEmail || null,
        },
        message: 'Cập nhật thông tin liên hệ thành công.',
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

export const changeMyPassword = async (req, res, next) => {
  try {
    const { currentPassword = '', newPassword = '' } = req.body || {};

    const normalizedCurrentPassword = String(currentPassword || '').trim();
    const normalizedNewPassword = String(newPassword || '').trim();

    if (!normalizedCurrentPassword || !normalizedNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORD_FIELDS',
      });
    }

    if (normalizedNewPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Mật khẩu mới phải có ít nhất 6 ký tự',
        code: 'PASSWORD_TOO_SHORT',
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        'SELECT id, passwordHash FROM users WHERE id = ? LIMIT 1',
        [req.user.id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(normalizedCurrentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: 'Mật khẩu hiện tại không đúng',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      const isSameAsOld = await bcrypt.compare(normalizedNewPassword, user.passwordHash);
      if (isSameAsOld) {
        return res.status(400).json({
          success: false,
          error: 'Mật khẩu mới phải khác mật khẩu hiện tại',
          code: 'PASSWORD_NOT_CHANGED',
        });
      }

      const newPasswordHash = await bcrypt.hash(normalizedNewPassword, 10);
      await connection.execute(
        'UPDATE users SET passwordHash = ? WHERE id = ?',
        [newPasswordHash, req.user.id]
      );

      await connection.commit();
      return res.json({
        success: true,
        message: 'Đổi mật khẩu thành công.',
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
