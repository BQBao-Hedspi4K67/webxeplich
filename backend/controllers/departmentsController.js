import pool from '../config/database.js';

const ensureDepartmentsTable = async (connection) => {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL UNIQUE,
      departmentType ENUM('ban_giam_doc', 'phong', 'khoa', 'doi') NOT NULL,
      headOfficerId VARCHAR(10) NULL,
      isActive TINYINT(1) DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (headOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
      INDEX idx_department_type (departmentType),
      INDEX idx_head_officer (headOfficerId),
      INDEX idx_is_active (isActive)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await connection.execute("ALTER TABLE departments MODIFY COLUMN departmentType ENUM('ban_giam_doc', 'phong', 'khoa', 'doi') NOT NULL");

  const [columns] = await connection.execute('SHOW COLUMNS FROM departments');
  const colNames = new Set(columns.map((c) => c.Field));
  if (!colNames.has('headOfficerId')) {
    await connection.execute('ALTER TABLE departments ADD COLUMN headOfficerId VARCHAR(10) NULL AFTER departmentType');
    await connection.execute('ALTER TABLE departments ADD INDEX idx_head_officer (headOfficerId)');
  }
};

const normalizeDepartmentType = (name = '') => {
  if (name === 'Ban Giám đốc') return 'ban_giam_doc';
  if (/^Đội\s/i.test(name)) return 'doi';
  if (/^Khoa\s/i.test(name)) return 'khoa';
  return 'phong';
};

const hasOfficersDepartmentIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'departmentId'");
  return rows.length > 0;
};

export const getDepartments = async (req, res, next) => {
  try {
    const { includeInactive = 'false' } = req.query;
    const connection = await pool.getConnection();

    try {
      await ensureDepartmentsTable(connection);
      const hasDepartmentId = await hasOfficersDepartmentIdColumn(connection);
      const officerJoin = hasDepartmentId
        ? 'LEFT JOIN officers ofc ON (ofc.departmentId = d.id OR (ofc.departmentId IS NULL AND ofc.department = d.name))'
        : 'LEFT JOIN officers ofc ON ofc.department = d.name';

      const includeAll = String(includeInactive).toLowerCase() === 'true';
      const [rows] = await connection.execute(
        `SELECT
           d.id,
           d.name,
           d.departmentType,
           d.headOfficerId,
           NULLIF(TRIM(o.officerTitle), '') AS headOfficerTitle,
           NULLIF(TRIM(o.fullName), '') AS headOfficerFullName,
           d.isActive,
           d.createdAt,
           d.updatedAt,
           SUM(CASE WHEN ofc.role = 'manager' AND ofc.status = 'active' THEN 1 ELSE 0 END) AS managerCount,
           SUM(CASE WHEN ofc.role = 'officer' AND ofc.status = 'active' THEN 1 ELSE 0 END) AS officerCount
         FROM departments d
         LEFT JOIN officers o ON o.id = d.headOfficerId
         ${officerJoin}
         ${includeAll ? '' : 'WHERE isActive = 1'}
         GROUP BY d.id, d.name, d.departmentType, d.headOfficerId, o.officerTitle, o.fullName, d.isActive, d.createdAt, d.updatedAt
         ORDER BY
           CASE departmentType
             WHEN 'ban_giam_doc' THEN 1
             WHEN 'phong' THEN 2
             WHEN 'khoa' THEN 3
             ELSE 4
           END,
           name ASC`
      );

      // Normalize headOfficerName to avoid duplicated title prefixes like "Thiếu tướng Thiếu tướng ..."
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleaned = rows.map((r) => {
        const title = (r.headOfficerTitle || '').trim();
        const full = (r.headOfficerFullName || '').trim();
        let headOfficerName = '';

        if (full) {
          if (title) {
            // collapse repeated title prefixes in full name
            try {
              const re = new RegExp(`^(${escapeRegex(title)}\s+)+`, 'i');
              if (re.test(full)) {
                headOfficerName = full.replace(re, `${title} `).trim();
              } else {
                headOfficerName = `${title} ${full}`.trim();
              }
            } catch (e) {
              headOfficerName = `${title} ${full}`.trim();
            }
          } else {
            headOfficerName = full;
          }
        } else {
          headOfficerName = title;
        }

        return {
          id: r.id,
          name: r.name,
          departmentType: r.departmentType,
          headOfficerId: r.headOfficerId,
          headOfficerName,
          isActive: r.isActive,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          managerCount: r.managerCount,
          officerCount: r.officerCount,
        };
      });

      // replace rows with cleaned
      rows.length = 0;
      cleaned.forEach((c) => rows.push(c));

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
    const { name, departmentType = '', headOfficerId = null } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: name',
        code: 'VALIDATION_ERROR',
      });
    }

    const departmentName = String(name).trim();
    const type = departmentType || normalizeDepartmentType(departmentName);

    if (!['ban_giam_doc', 'phong', 'khoa', 'doi'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid departmentType',
        code: 'INVALID_DEPARTMENT_TYPE',
      });
    }

    const connection = await pool.getConnection();
    try {
      await ensureDepartmentsTable(connection);
      const hasDepartmentId = await hasOfficersDepartmentIdColumn(connection);

      const [result] = await connection.execute(
        'INSERT INTO departments (name, departmentType, headOfficerId, isActive) VALUES (?, ?, ?, 1)',
        [departmentName, type, headOfficerId || null]
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
    const { name, departmentType, headOfficerId, isActive } = req.body;

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(String(name).trim());
    }

    if (departmentType !== undefined) {
      if (!['ban_giam_doc', 'phong', 'khoa', 'doi'].includes(departmentType)) {
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

    if (headOfficerId !== undefined) {
      fields.push('headOfficerId = ?');
      params.push(headOfficerId || null);
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
      const hasDepartmentId = await hasOfficersDepartmentIdColumn(connection);

      const [checkRows] = await connection.execute('SELECT id FROM departments WHERE id = ? LIMIT 1', [id]);
      if (!checkRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Department not found',
          code: 'DEPARTMENT_NOT_FOUND',
        });
      }

      const [officerRows] = hasDepartmentId
        ? await connection.execute(
          `SELECT COUNT(*) AS total
           FROM officers
           WHERE departmentId = ?
              OR (departmentId IS NULL AND department = (SELECT name FROM departments WHERE id = ?))`,
          [id, id]
        )
        : await connection.execute(
          'SELECT COUNT(*) AS total FROM officers WHERE department = (SELECT name FROM departments WHERE id = ?)',
          [id]
        );
      if ((officerRows[0]?.total || 0) > 0) {
        return res.status(409).json({
          success: false,
          error: 'Cannot delete department while officers are still assigned',
          code: 'DEPARTMENT_HAS_OFFICERS',
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
