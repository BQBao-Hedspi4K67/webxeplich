import pool from '../config/database.js';
import { WORK_STATUS, WORK_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureNotificationTargetingSchema,
  createUserNotification,
  resolveUserIdsByAssignedTo,
} from '../utils/notificationTargeting.js';

// Get all work schedules with pagination and filters
export const getWorkSchedules = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      type = '', 
      status = '', 
      weekNo = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const connection = await pool.getConnection();

    try {
      let whereConditions = [];
      let params = [];

      if (search) {
        whereConditions.push("(title LIKE ? OR assignedTo LIKE ? OR department LIKE ?)");
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (type) {
        whereConditions.push("type = ?");
        params.push(type);
      }

      if (status) {
        whereConditions.push("status = ?");
        params.push(status);
      }

      if (weekNo) {
        whereConditions.push("weekNo = ?");
        params.push(parseInt(weekNo));
      }

      if (startDate) {
        whereConditions.push("date >= ?");
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push("date <= ?");
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Count
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM work_schedules ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // Get data
      const [schedules] = await connection.execute(
        `SELECT * FROM work_schedules ${whereClause} ORDER BY date ASC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
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
export const getWorkScheduleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT * FROM work_schedules WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
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

// Create new schedule
export const createWorkSchedule = async (req, res, next) => {
  try {
    const { 
      title, 
      date, 
      startTime, 
      endTime, 
      location, 
      assignedTo, 
      department, 
      type, 
      weekNo,
      notes = '' 
    } = req.body;

    // Validate
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

    const connection = await pool.getConnection();

    try {
      // Generate ID
      const [maxIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as maxNum FROM work_schedules WHERE id LIKE 'LCT%'"
      );
      const nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const newId = `LCT${String(nextNum).padStart(3, '0')}`;

      await connection.execute(
        `INSERT INTO work_schedules 
         (id, title, date, startTime, endTime, location, assignedTo, department, type, status, weekNo, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, title, date, startTime || null, endTime || null, location || '', assignedTo || '', department || '', type, 'upcoming', weekNo || null, notes]
      );

      await ensureNotificationTargetingSchema(connection);
      const targetUserIds = await resolveUserIdsByAssignedTo(connection, assignedTo);
      for (const targetUserId of targetUserIds) {
        await createUserNotification(connection, {
          title: 'Ban duoc phan cong lich cong tac moi',
          content: `${title} (${date})`,
          type: 'info',
          module: 'lichcongtac',
          entityType: 'work_schedule',
          entityId: newId,
          targetUserId,
        });
      }

      res.status(201).json({
        success: true,
        data: { id: newId },
        message: 'Work schedule created successfully',
      });

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
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Update schedule
export const updateWorkSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, date, startTime, endTime, location, assignedTo, department, type, status, weekNo, notes } = req.body;

    const connection = await pool.getConnection();

    try {
      // Check exists
      const [check] = await connection.execute(
        'SELECT id, title, date, assignedTo FROM work_schedules WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      // Build update
      let updateFields = [];
      let params = [];

      if (title !== undefined) {
        updateFields.push('title = ?');
        params.push(title);
      }
      if (date !== undefined) {
        updateFields.push('date = ?');
        params.push(date);
      }
      if (startTime !== undefined) {
        updateFields.push('startTime = ?');
        params.push(startTime);
      }
      if (endTime !== undefined) {
        updateFields.push('endTime = ?');
        params.push(endTime);
      }
      if (location !== undefined) {
        updateFields.push('location = ?');
        params.push(location);
      }
      if (assignedTo !== undefined) {
        updateFields.push('assignedTo = ?');
        params.push(assignedTo);
      }
      if (department !== undefined) {
        updateFields.push('department = ?');
        params.push(department);
      }
      if (type !== undefined) {
        updateFields.push('type = ?');
        params.push(type);
      }
      if (status !== undefined) {
        updateFields.push('status = ?');
        params.push(status);
      }
      if (weekNo !== undefined) {
        updateFields.push('weekNo = ?');
        params.push(weekNo);
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        params.push(notes);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update',
          code: 'VALIDATION_ERROR',
        });
      }

      params.push(id);

      await connection.execute(
        `UPDATE work_schedules SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      const prev = check[0];
      const nextAssignedTo = assignedTo !== undefined ? assignedTo : prev.assignedTo;
      const nextTitle = title !== undefined ? title : prev.title;
      const nextDate = date !== undefined ? date : prev.date;
      await ensureNotificationTargetingSchema(connection);
      const targetUserIds = await resolveUserIdsByAssignedTo(connection, nextAssignedTo);
      for (const targetUserId of targetUserIds) {
        await createUserNotification(connection, {
          title: 'Lich cong tac cua ban vua duoc cap nhat',
          content: `${nextTitle} (${nextDate})`,
          type: 'info',
          module: 'lichcongtac',
          entityType: 'work_schedule',
          entityId: id,
          targetUserId,
        });
      }

      res.json({
        success: true,
        message: 'Work schedule updated successfully',
      });

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
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Delete schedule
export const deleteWorkSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [check] = await connection.execute(
        'SELECT id FROM work_schedules WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Work schedule not found',
          code: 'SCHEDULE_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM work_schedules WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Work schedule deleted successfully',
      });

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
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
