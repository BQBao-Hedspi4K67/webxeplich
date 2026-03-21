import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

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
      const [rows] = await connection.execute(
        'SELECT id, username, fullName, email, role, avatar, status FROM users WHERE id = ?',
        [req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
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

    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, password, fullName',
        code: 'VALIDATION_ERROR',
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
      const officerDepartment = department || 'Chưa phân công';

      await connection.execute(
        `INSERT INTO officers (id, fullName, position, department, phone, email, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newOfficerId, fullName, officerPosition, officerDepartment, phone, email, role, status]
      );

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
