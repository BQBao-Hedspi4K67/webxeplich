import pool from '../config/database.js';

export const getHolidays = async (req, res, next) => {
  try {
    const { year = '', month = '', fromDate = '', toDate = '' } = req.query;
    const connection = await pool.getConnection();

    try {
      const where = [];
      const params = [];

      if (fromDate) {
        where.push('holidayDate >= ?');
        params.push(fromDate);
      }

      if (toDate) {
        where.push('holidayDate <= ?');
        params.push(toDate);
      }

      if (year) {
        where.push('YEAR(holidayDate) = ?');
        params.push(parseInt(year, 10));
      }

      if (month) {
        where.push('MONTH(holidayDate) = ?');
        params.push(parseInt(month, 10));
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await connection.execute(
        `SELECT id, holidayDate, holidayName, holidayType, isRecurring
         FROM holidays
         ${whereClause}
         ORDER BY holidayDate ASC`,
        params
      );

      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const createHoliday = async (req, res, next) => {
  try {
    const { holidayDate, holidayName, holidayType = 'holiday', isRecurring = false } = req.body;

    if (!holidayDate || !holidayName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: holidayDate, holidayName',
        code: 'VALIDATION_ERROR',
      });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.execute(
        `INSERT INTO holidays (holidayDate, holidayName, holidayType, isRecurring)
         VALUES (?, ?, ?, ?)`,
        [holidayDate, holidayName, holidayType, isRecurring ? 1 : 0]
      );

      res.status(201).json({
        success: true,
        data: { id: result.insertId },
        message: 'Holiday created successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Holiday already exists for this date and name',
        code: 'HOLIDAY_DUPLICATE',
      });
    }
    next(err);
  }
};

export const updateHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { holidayDate, holidayName, holidayType, isRecurring } = req.body;

    const updateFields = [];
    const params = [];

    if (holidayDate !== undefined) {
      updateFields.push('holidayDate = ?');
      params.push(holidayDate);
    }
    if (holidayName !== undefined) {
      updateFields.push('holidayName = ?');
      params.push(holidayName);
    }
    if (holidayType !== undefined) {
      updateFields.push('holidayType = ?');
      params.push(holidayType);
    }
    if (isRecurring !== undefined) {
      updateFields.push('isRecurring = ?');
      params.push(isRecurring ? 1 : 0);
    }

    if (!updateFields.length) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        code: 'VALIDATION_ERROR',
      });
    }

    const connection = await pool.getConnection();

    try {
      const [checkRows] = await connection.execute('SELECT id FROM holidays WHERE id = ? LIMIT 1', [id]);
      if (!checkRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Holiday not found',
          code: 'HOLIDAY_NOT_FOUND',
        });
      }

      params.push(id);
      await connection.execute(
        `UPDATE holidays
         SET ${updateFields.join(', ')}, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        params
      );

      res.json({ success: true, message: 'Holiday updated successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Holiday already exists for this date and name',
        code: 'HOLIDAY_DUPLICATE',
      });
    }
    next(err);
  }
};

export const deleteHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [checkRows] = await connection.execute('SELECT id FROM holidays WHERE id = ? LIMIT 1', [id]);
      if (!checkRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Holiday not found',
          code: 'HOLIDAY_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM holidays WHERE id = ?', [id]);
      res.json({ success: true, message: 'Holiday deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
