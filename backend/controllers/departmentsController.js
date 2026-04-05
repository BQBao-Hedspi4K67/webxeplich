import pool from '../config/database.js';

const ensureDepartmentsTable = async (connection) => {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL UNIQUE,
      departmentType ENUM('ban_giam_doc', 'phong', 'khoa') NOT NULL,
      isActive TINYINT(1) DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_department_type (departmentType),
      INDEX idx_is_active (isActive)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

const normalizeDepartmentType = (name = '') => {
  if (name === 'Ban Giám đốc') return 'ban_giam_doc';
  if (/^Khoa\s/i.test(name)) return 'khoa';
  return 'phong';
};

export const getDepartments = async (req, res, next) => {
  try {
    const { includeInactive = 'false' } = req.query;
    const connection = await pool.getConnection();

    try {
      await ensureDepartmentsTable(connection);

      const includeAll = String(includeInactive).toLowerCase() === 'true';
      const [rows] = await connection.execute(
        `SELECT id, name, departmentType, isActive, createdAt, updatedAt
         FROM departments
         ${includeAll ? '' : 'WHERE isActive = 1'}
         ORDER BY
           CASE departmentType
             WHEN 'ban_giam_doc' THEN 1
             WHEN 'phong' THEN 2
             WHEN 'khoa' THEN 3
             ELSE 4
           END,
           name ASC`
      );

      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { name, departmentType = '' } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: name',
        code: 'VALIDATION_ERROR',
      });
    }

    const departmentName = String(name).trim();
    const type = departmentType || normalizeDepartmentType(departmentName);

    if (!['ban_giam_doc', 'phong', 'khoa'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid departmentType',
        code: 'INVALID_DEPARTMENT_TYPE',
      });
    }

    const connection = await pool.getConnection();
    try {
      await ensureDepartmentsTable(connection);

      const [result] = await connection.execute(
        'INSERT INTO departments (name, departmentType, isActive) VALUES (?, ?, 1)',
        [departmentName, type]
      );

      res.status(201).json({
        success: true,
        data: { id: result.insertId },
        message: 'Department created successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Department already exists',
        code: 'DEPARTMENT_EXISTS',
      });
    }
    next(err);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, departmentType, isActive } = req.body;

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(String(name).trim());
    }

    if (departmentType !== undefined) {
      if (!['ban_giam_doc', 'phong', 'khoa'].includes(departmentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid departmentType',
          code: 'INVALID_DEPARTMENT_TYPE',
        });
      }
      fields.push('departmentType = ?');
      params.push(departmentType);
    }

    if (isActive !== undefined) {
      fields.push('isActive = ?');
      params.push(isActive ? 1 : 0);
    }

    if (!fields.length) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        code: 'VALIDATION_ERROR',
      });
    }

    const connection = await pool.getConnection();
    try {
      await ensureDepartmentsTable(connection);

      const [checkRows] = await connection.execute('SELECT id FROM departments WHERE id = ? LIMIT 1', [id]);
      if (!checkRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Department not found',
          code: 'DEPARTMENT_NOT_FOUND',
        });
      }

      params.push(id);
      await connection.execute(
        `UPDATE departments SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );

      res.json({ success: true, message: 'Department updated successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Department already exists',
        code: 'DEPARTMENT_EXISTS',
      });
    }
    next(err);
  }
};

export const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await ensureDepartmentsTable(connection);

      const [checkRows] = await connection.execute('SELECT id FROM departments WHERE id = ? LIMIT 1', [id]);
      if (!checkRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Department not found',
          code: 'DEPARTMENT_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM departments WHERE id = ?', [id]);
      res.json({ success: true, message: 'Department deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
