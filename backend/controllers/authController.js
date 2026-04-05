import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

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

const hasDepartmentsTable = async (connection) => {
  const [rows] = await connection.execute("SHOW TABLES LIKE 'departments'");
  return rows.length > 0;
};

const validateDepartment = async (connection, department) => {
  const hasTable = await hasDepartmentsTable(connection);
  if (!hasTable) {
    return ALLOWED_DEPARTMENTS.includes(department);
  }

  const [rows] = await connection.execute(
    'SELECT id FROM departments WHERE name = ? LIMIT 1',
    [department]
  );
  return rows.length > 0;
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
      // Find user
      const [rows] = await connection.execute(
        'SELECT id, username, passwordHash, fullName, email, role, avatar FROM users WHERE username = ? AND status = ?',
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

      let officerProfile = null;
      const [officerRows] = hasUserIdColumn
        ? await connection.execute(
          'SELECT id, position, department FROM officers WHERE userId = ? LIMIT 1',
          [user.id]
        )
        : [[], null];

      if (officerRows.length) {
        officerProfile = officerRows[0];
      } else {
        const [fallbackOfficerRows] = await connection.execute(
          `SELECT id, position, department FROM officers
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

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            officerId: officerProfile?.id || null,
            position: officerProfile?.position || '',
            department: officerProfile?.department || '',
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
      const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
      const [rows] = hasUserIdColumn
        ? await connection.execute(
          `SELECT
             u.id,
             u.username,
             u.fullName,
             u.email,
             u.role,
             u.avatar,
             u.status,
             o.id AS officerId,
             o.position,
             o.department
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
             u.email,
             u.role,
             u.avatar,
             u.status,
             NULL AS officerId,
             NULL AS position,
             NULL AS department
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
          `SELECT id, position, department FROM officers
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
            position: fallbackOfficer.position,
            department: fallbackOfficer.department,
          };
        }
      }

      res.json({
        success: true,
        data: profile,
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
    const {
      username,
      password,
      fullName,
      email = null,
      phone = null,
      position = '',
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

    if (!username || !password || !fullName || !department) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, password, fullName, department',
        code: 'VALIDATION_ERROR',
      });
    }

    const isDepartmentValid = await (async () => {
      const connection = await pool.getConnection();
      try {
        return validateDepartment(connection, department);
      } finally {
        connection.release();
      }
    })();

    if (!isDepartmentValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid department selection',
        code: 'INVALID_DEPARTMENT',
      });
    }

    const allowedRoles = ['manager', 'officer'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Only manager or officer can be created.',
        code: 'INVALID_ROLE',
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
      await connection.beginTransaction();
      const hasUserIdColumn = await hasOfficersUserIdColumn(connection);

      const [existingUsername] = await connection.execute(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [username]
      );

      if (existingUsername.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists',
          code: 'USERNAME_EXISTS',
        });
      }

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

      const passwordHash = await bcrypt.hash(password, 10);

      const [result] = await connection.execute(
        `INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, passwordHash, fullName, email, role, avatar, status]
      );

      const [maxOfficerIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) as maxNum FROM officers WHERE id LIKE 'CB%'"
      );
      const nextOfficerNum = (maxOfficerIdRows[0].maxNum || 0) + 1;
      const newOfficerId = `CB${String(nextOfficerNum).padStart(3, '0')}`;

      const officerPosition = position || (role === 'manager' ? 'Quản lý' : 'Cán bộ');
      const officerDepartment = department;
      const split = splitTitleAndName(fullName);

      if (hasUserIdColumn) {
        await connection.execute(
          `INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, phone, email, role, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newOfficerId, result.insertId, fullName, split.officerTitle, split.officerName, officerPosition, officerDepartment, phone, email, role, status]
        );
      } else {
        await connection.execute(
          `INSERT INTO officers (id, fullName, officerTitle, officerName, position, department, phone, email, role, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newOfficerId, fullName, split.officerTitle, split.officerName, officerPosition, officerDepartment, phone, email, role, status]
        );
      }

      const [createdRows] = await connection.execute(
        'SELECT id, username, fullName, email, role, avatar, status, createdAt FROM users WHERE id = ?',
        [result.insertId]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        data: {
          ...createdRows[0],
          officerId: newOfficerId,
          officerPosition,
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
