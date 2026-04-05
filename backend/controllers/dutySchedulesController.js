import pool from '../config/database.js';
import { DUTY_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureNotificationTargetingSchema,
  createUserNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';

const getIsoWeekRange = (weekNo, year = new Date().getFullYear()) => {
  const w = Number(weekNo);
  const y = Number(year);
  if (!Number.isInteger(w) || w < 1 || w > 53) return null;

  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const toDateOnly = (d) => d.toISOString().slice(0, 10);
  return { startDate: toDateOnly(start), endDate: toDateOnly(end) };
};

const getWeekStartDate = (dateValue) => {
  const raw = String(dateValue || '').slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return null;

  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
};

// Get all duty schedules
export const getDutySchedules = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      dutyType = '', 
      weekNo = '',
      year = new Date().getFullYear(),
      startDate = '',
      endDate = '',
      officerId = '',
      location = '',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const connection = await pool.getConnection();

    try {
      let whereConditions = [];
      let params = [];

      if (dutyType) {
        whereConditions.push('ds.dutyType = ?');
        params.push(dutyType);
      }

      if (weekNo) {
        const range = getIsoWeekRange(weekNo, year);
        if (range) {
          whereConditions.push('date BETWEEN ? AND ?');
          params.push(range.startDate, range.endDate);
        }
      }

      if (startDate) {
        whereConditions.push('ds.date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('ds.date <= ?');
        params.push(endDate);
      }

      if (officerId) {
        whereConditions.push('ds.officerId = ?');
        params.push(officerId);
      }

      if (location) {
        whereConditions.push('ds.location = ?');
        params.push(location);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Count
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total
         FROM duty_schedules ds
         LEFT JOIN officers o ON ds.officerId = o.id
         ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // Get data with officer info
      const [schedules] = await connection.execute(
        `SELECT ds.*, o.fullName as officerName, o.department 
         FROM duty_schedules ds 
         LEFT JOIN officers o ON ds.officerId = o.id 
         ${whereClause} 
         ORDER BY ds.date ASC 
         LIMIT ${parseInt(limit)} OFFSET ${offset}`,
        params
      );

      res.json({
        success: true,
        data: schedules,
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

// Get single schedule
export const getDutyScheduleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT ds.*, o.fullName as officerName, o.department 
         FROM duty_schedules ds 
         LEFT JOIN officers o ON ds.officerId = o.id 
         WHERE ds.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Duty schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
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

// Create new duty schedule
export const createDutySchedule = async (req, res, next) => {
  try {
    const { 
      officerId, 
      dutyType, 
      date, 
      endDate = null,
      shift,
      location = '',
      notes = ''
    } = req.body;

    // Validate
    if (!officerId || !dutyType || !date || !shift) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: officerId, dutyType, date, shift',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!Object.values(DUTY_TYPES).includes(dutyType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid dutyType. Must be one of: ${Object.values(DUTY_TYPES).join(', ')}`,
        code: 'INVALID_DUTY_TYPE',
      });
    }

    const connection = await pool.getConnection();

    try {
      // Verify officer exists
      const [officerCheck] = await connection.execute(
        'SELECT id FROM officers WHERE id = ?',
        [officerId]
      );

      if (officerCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Officer not found',
          code: 'OFFICER_NOT_FOUND',
        });
      }

      const weekStartDate = dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? getWeekStartDate(date) : null;
      if (dutyType === DUTY_TYPES.DIRECTOR_WEEKLY && weekStartDate) {
        const [dupeRows] = await connection.execute(
          `SELECT id FROM duty_schedules
           WHERE dutyType = ? AND weekStartDate = ?
           LIMIT 1`,
          [DUTY_TYPES.DIRECTOR_WEEKLY, weekStartDate]
        );

        if (dupeRows.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Mỗi tuần chỉ được có một giám đốc trực.',
            code: 'DIRECTOR_WEEK_ALREADY_ASSIGNED',
          });
        }
      }

      // Generate ID
      const prefix = dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? 'TBGD' : 'TBCB';
      const [maxIdRows] = await connection.execute(
        `SELECT MAX(CAST(SUBSTRING(id, ${prefix.length + 1}) AS UNSIGNED)) as maxNum FROM duty_schedules WHERE id LIKE '${prefix}%'`
      );
      const nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const newId = `${prefix}${String(nextNum).padStart(3, '0')}`;

      await connection.execute(
        `INSERT INTO duty_schedules 
         (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, '00:00', '23:59', ?, ?)`,
        [newId, officerId, dutyType, date, endDate, weekStartDate, shift, location, notes]
      );

      await ensureNotificationTargetingSchema(connection);
      const targetUserId = await resolveUserIdByOfficerId(connection, officerId);
      await createUserNotification(connection, {
        title: 'Ban duoc phan cong lich truc ban',
        content: `Lich ${newId} vao ngay ${date}`,
        type: 'info',
        module: 'lichtrucban',
        entityType: 'duty_schedule',
        entityId: newId,
        targetUserId,
      });

      res.status(201).json({
        success: true,
        data: { id: newId },
        message: 'Duty schedule created successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'create',
        entityType: 'duty_schedule',
        entityId: newId,
        summary: `Them moi lich truc ban ${newId}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Update duty schedule
export const updateDutySchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officerId, dutyType, date, endDate, shift, location, notes } = req.body;

    const connection = await pool.getConnection();

    try {
      // Check exists
      const [check] = await connection.execute(
        'SELECT id, dutyType, date, officerId FROM duty_schedules WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Duty schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      const current = check[0];
      const nextDutyType = dutyType !== undefined ? dutyType : current.dutyType;
      const nextDate = date !== undefined ? date : current.date;
      const nextWeekStartDate = nextDutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? getWeekStartDate(nextDate) : null;

      if (nextDutyType === DUTY_TYPES.DIRECTOR_WEEKLY && nextWeekStartDate) {
        const [dupeRows] = await connection.execute(
          `SELECT id FROM duty_schedules
           WHERE dutyType = ? AND weekStartDate = ? AND id <> ?
           LIMIT 1`,
          [DUTY_TYPES.DIRECTOR_WEEKLY, nextWeekStartDate, id]
        );

        if (dupeRows.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Mỗi tuần chỉ được có một giám đốc trực.',
            code: 'DIRECTOR_WEEK_ALREADY_ASSIGNED',
          });
        }
      }

      // Build update
      let updateFields = [];
      let params = [];

      if (officerId !== undefined) {
        updateFields.push('officerId = ?');
        params.push(officerId);
      }
      if (dutyType !== undefined) {
        updateFields.push('dutyType = ?');
        params.push(dutyType);
      }
      if (date !== undefined) {
        updateFields.push('date = ?');
        params.push(date);
      }
      if (endDate !== undefined) {
        updateFields.push('endDate = ?');
        params.push(endDate);
      }
      if (shift !== undefined) {
        updateFields.push('shift = ?');
        params.push(shift);
      }
      if (location !== undefined) {
        updateFields.push('location = ?');
        params.push(location);
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        params.push(notes);
      }

      updateFields.push('weekStartDate = ?');
      params.push(nextWeekStartDate);

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update',
          code: 'VALIDATION_ERROR',
        });
      }

      params.push(id);

      await connection.execute(
        `UPDATE duty_schedules SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      const nextOfficerId = officerId !== undefined ? officerId : current.officerId;
      const targetUserId = await resolveUserIdByOfficerId(connection, nextOfficerId);
      await ensureNotificationTargetingSchema(connection);
      await createUserNotification(connection, {
        title: 'Lich truc ban cua ban vua duoc cap nhat',
        content: `Lich ${id} vao ngay ${nextDate}`,
        type: 'info',
        module: 'lichtrucban',
        entityType: 'duty_schedule',
        entityId: id,
        targetUserId,
      });

      res.json({
        success: true,
        message: 'Duty schedule updated successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'update',
        entityType: 'duty_schedule',
        entityId: id,
        summary: `Cap nhat lich truc ban ${id}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Delete duty schedule
export const deleteDutySchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [check] = await connection.execute(
        'SELECT id FROM duty_schedules WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Duty schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM duty_schedules WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Duty schedule deleted successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'delete',
        entityType: 'duty_schedule',
        entityId: id,
        summary: `Xoa lich truc ban ${id}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
