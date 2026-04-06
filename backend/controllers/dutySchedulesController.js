import pool from '../config/database.js';
import { DUTY_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureNotificationTargetingSchema,
  createUserNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';

const OFFICER_DUTY_LOCATIONS = ['Nhà hiệu bộ', 'Nhà xe', 'Trạm xá'];

const getMonthRange = (dateValue) => {
  const raw = String(dateValue || '').slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return null;

  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

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
      bulkAssignments = null,
      notes = ''
    } = req.body;

    // Validate
    if (!dutyType || !date || !shift) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: dutyType, date, shift',
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

      const prefix = dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? 'TBGD' : 'TBCB';
      const [maxIdRows] = await connection.execute(
        `SELECT MAX(CAST(SUBSTRING(id, ${prefix.length + 1}) AS UNSIGNED)) as maxNum FROM duty_schedules WHERE id LIKE '${prefix}%'`
      );
      let nextNum = (maxIdRows[0].maxNum || 0) + 1;

      const buildNewId = () => {
        const id = `${prefix}${String(nextNum).padStart(3, '0')}`;
        nextNum += 1;
        return id;
      };

      const createdIds = [];

      if (dutyType === DUTY_TYPES.OFFICER_DAILY && Array.isArray(bulkAssignments) && bulkAssignments.length) {
        const normalized = bulkAssignments
          .map((x) => ({ officerId: x?.officerId, location: x?.location }))
          .filter((x) => x.officerId && x.location);

        const seenLocations = new Set();
        for (const item of normalized) {
          if (!OFFICER_DUTY_LOCATIONS.includes(item.location)) {
            return res.status(400).json({
              success: false,
              error: `Invalid location. Must be one of: ${OFFICER_DUTY_LOCATIONS.join(', ')}`,
              code: 'INVALID_LOCATION',
            });
          }
          if (seenLocations.has(item.location)) {
            return res.status(400).json({
              success: false,
              error: 'Each location can only be assigned once per day',
              code: 'DUPLICATE_LOCATION',
            });
          }
          seenLocations.add(item.location);
        }

        for (const item of normalized) {
          const [officerCheck] = await connection.execute('SELECT id FROM officers WHERE id = ?', [item.officerId]);
          if (!officerCheck.length) {
            return res.status(404).json({ success: false, error: 'Officer not found', code: 'OFFICER_NOT_FOUND' });
          }

          const [dupeDaily] = await connection.execute(
            `SELECT id FROM duty_schedules
             WHERE dutyType = ? AND date = ? AND location = ?
             LIMIT 1`,
            [DUTY_TYPES.OFFICER_DAILY, date, item.location]
          );
          if (dupeDaily.length) {
            return res.status(409).json({
              success: false,
              error: `Vị trí ${item.location} đã có cán bộ trực trong ngày ${date}`,
              code: 'DAILY_LOCATION_ALREADY_ASSIGNED',
            });
          }

          const newId = buildNewId();
          await connection.execute(
            `INSERT INTO duty_schedules
             (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, '00:00', '23:59', ?, ?)`,
            [newId, item.officerId, dutyType, date, endDate, weekStartDate, shift, item.location, notes]
          );
          createdIds.push({ id: newId, officerId: item.officerId, location: item.location });
        }
      } else {
        if (!officerId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: officerId',
            code: 'VALIDATION_ERROR',
          });
        }

        const [officerCheck] = await connection.execute('SELECT id FROM officers WHERE id = ?', [officerId]);
        if (officerCheck.length === 0) {
          return res.status(404).json({ success: false, error: 'Officer not found', code: 'OFFICER_NOT_FOUND' });
        }

        if (dutyType === DUTY_TYPES.OFFICER_DAILY && location && !OFFICER_DUTY_LOCATIONS.includes(location)) {
          return res.status(400).json({
            success: false,
            error: `Invalid location. Must be one of: ${OFFICER_DUTY_LOCATIONS.join(', ')}`,
            code: 'INVALID_LOCATION',
          });
        }

        const newId = buildNewId();
        await connection.execute(
          `INSERT INTO duty_schedules
           (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, '00:00', '23:59', ?, ?)`,
          [newId, officerId, dutyType, date, endDate, weekStartDate, shift, location, notes]
        );
        createdIds.push({ id: newId, officerId, location });
      }

      await ensureNotificationTargetingSchema(connection);
      for (const created of createdIds) {
        const targetUserId = await resolveUserIdByOfficerId(connection, created.officerId);
        await createUserNotification(connection, {
          title: 'Ban duoc phan cong lich truc ban',
          content: `Lich ${created.id} vao ngay ${date} - ${created.location}`,
          type: 'info',
          module: 'lichtrucban',
          entityType: 'duty_schedule',
          entityId: created.id,
          targetUserId,
        });
      }

      res.status(201).json({
        success: true,
        data: { ids: createdIds.map((x) => x.id) },
        message: 'Duty schedule created successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'create',
        entityType: 'duty_schedule',
        entityId: createdIds.map((x) => x.id).join(','),
        summary: `Them moi ${createdIds.length} lich truc ban ngay ${date}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Auto assign officer daily duty for a week with fair round-robin inside the month.
export const autoAssignOfficerDailyWeek = async (req, res, next) => {
  try {
    const { weekStartDate } = req.body;
    const monday = getWeekStartDate(weekStartDate || new Date().toISOString().slice(0, 10));

    if (!monday) {
      return res.status(400).json({
        success: false,
        error: 'weekStartDate không hợp lệ',
        code: 'INVALID_WEEK_START',
      });
    }

    const monthRange = getMonthRange(monday);
    if (!monthRange) {
      return res.status(400).json({
        success: false,
        error: 'Không xác định được tháng để xếp lịch',
        code: 'INVALID_MONTH_RANGE',
      });
    }

    const weekDates = Array.from({ length: 7 }, (_, idx) => {
      const dt = new Date(`${monday}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + idx);
      return dt.toISOString().slice(0, 10);
    });

    const weekEndDate = weekDates[6];
    const connection = await pool.getConnection();

    try {
      const [officers] = await connection.execute(
        `SELECT id
         FROM officers
         WHERE status = 'active' AND role = 'officer'
         ORDER BY id ASC`
      );

      const officerIds = officers.map((o) => o.id);
      if (officerIds.length < OFFICER_DUTY_LOCATIONS.length) {
        return res.status(400).json({
          success: false,
          error: `Cần ít nhất ${OFFICER_DUTY_LOCATIONS.length} cán bộ active để xếp đủ vị trí mỗi ngày.`,
          code: 'INSUFFICIENT_ACTIVE_OFFICERS',
        });
      }

      const [monthlyRows] = await connection.execute(
        `SELECT officerId, COUNT(*) AS total
         FROM duty_schedules
         WHERE dutyType = ?
           AND date BETWEEN ? AND ?
           AND location IN (?, ?, ?)
         GROUP BY officerId`,
        [
          DUTY_TYPES.OFFICER_DAILY,
          monthRange.startDate,
          monthRange.endDate,
          OFFICER_DUTY_LOCATIONS[0],
          OFFICER_DUTY_LOCATIONS[1],
          OFFICER_DUTY_LOCATIONS[2],
        ]
      );

      const monthlyCount = new Map(officerIds.map((id) => [id, 0]));
      for (const row of monthlyRows) {
        if (monthlyCount.has(row.officerId)) {
          monthlyCount.set(row.officerId, Number(row.total) || 0);
        }
      }

      const [weekRows] = await connection.execute(
        `SELECT id, date, location, officerId
         FROM duty_schedules
         WHERE dutyType = ?
           AND date BETWEEN ? AND ?
           AND location IN (?, ?, ?)
         ORDER BY date ASC, location ASC`,
        [
          DUTY_TYPES.OFFICER_DAILY,
          monday,
          weekEndDate,
          OFFICER_DUTY_LOCATIONS[0],
          OFFICER_DUTY_LOCATIONS[1],
          OFFICER_DUTY_LOCATIONS[2],
        ]
      );

      const existingBySlot = new Map();
      const assignedByDate = new Map();
      for (const row of weekRows) {
        existingBySlot.set(`${row.date}|${row.location}`, row);
        if (!assignedByDate.has(row.date)) assignedByDate.set(row.date, new Set());
        assignedByDate.get(row.date).add(row.officerId);
      }

      const [maxIdRows] = await connection.execute(
        "SELECT MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)) AS maxNum FROM duty_schedules WHERE id LIKE 'TBCB%'"
      );
      let nextNum = (maxIdRows[0].maxNum || 0) + 1;
      const nextId = () => {
        const id = `TBCB${String(nextNum).padStart(3, '0')}`;
        nextNum += 1;
        return id;
      };

      const createdRows = [];
      for (const date of weekDates) {
        if (!assignedByDate.has(date)) assignedByDate.set(date, new Set());
        const alreadyOnDate = assignedByDate.get(date);

        for (const location of OFFICER_DUTY_LOCATIONS) {
          if (existingBySlot.has(`${date}|${location}`)) {
            continue;
          }

          const available = officerIds.filter((id) => !alreadyOnDate.has(id));
          if (!available.length) {
            return res.status(409).json({
              success: false,
              error: `Không còn cán bộ khả dụng cho ngày ${date}`,
              code: 'NO_AVAILABLE_OFFICER_FOR_DAY',
            });
          }

          const minCount = Math.min(...available.map((id) => monthlyCount.get(id) || 0));
          const leastUsed = available.filter((id) => (monthlyCount.get(id) || 0) === minCount);
          const chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)];

          const id = nextId();
          await connection.execute(
            `INSERT INTO duty_schedules
             (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, notes)
             VALUES (?, ?, ?, ?, NULL, NULL, 'nguyenday', '00:00', '23:59', ?, ?)` ,
            [id, chosen, DUTY_TYPES.OFFICER_DAILY, date, location, 'Auto xep theo vong (fair random)']
          );

          createdRows.push({ id, officerId: chosen, date, location });
          alreadyOnDate.add(chosen);
          monthlyCount.set(chosen, (monthlyCount.get(chosen) || 0) + 1);
        }
      }

      if (!createdRows.length) {
        return res.json({
          success: true,
          data: {
            createdCount: 0,
            weekStartDate: monday,
            weekEndDate,
          },
          message: 'Tuần này đã đủ lịch trực, không cần xếp thêm.',
        });
      }

      await ensureNotificationTargetingSchema(connection);
      for (const created of createdRows) {
        const targetUserId = await resolveUserIdByOfficerId(connection, created.officerId);
        await createUserNotification(connection, {
          title: 'Ban duoc phan cong lich truc ban tu dong',
          content: `${created.date} - ${created.location}`,
          type: 'info',
          module: 'lichtrucban',
          entityType: 'duty_schedule',
          entityId: created.id,
          targetUserId,
        });
      }

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'create',
        entityType: 'duty_schedule',
        entityId: createdRows.map((x) => x.id).join(','),
        summary: `Auto xep lich truc ban tuan ${monday} - ${weekEndDate} (${createdRows.length} lich)`,
      });

      return res.status(201).json({
        success: true,
        data: {
          createdCount: createdRows.length,
          weekStartDate: monday,
          weekEndDate,
          createdIds: createdRows.map((x) => x.id),
        },
        message: 'Da auto xep lich truc ban theo vong cho tuan duoc chon.',
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
      const nextLocation = location !== undefined ? location : current.location;

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

      if (nextDutyType === DUTY_TYPES.OFFICER_DAILY && nextLocation) {
        const [dupeDaily] = await connection.execute(
          `SELECT id FROM duty_schedules
           WHERE dutyType = ? AND date = ? AND location = ? AND id <> ?
           LIMIT 1`,
          [DUTY_TYPES.OFFICER_DAILY, nextDate, nextLocation, id]
        );
        if (dupeDaily.length > 0) {
          return res.status(409).json({
            success: false,
            error: `Vị trí ${nextLocation} đã có cán bộ trực trong ngày ${nextDate}`,
            code: 'DAILY_LOCATION_ALREADY_ASSIGNED',
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
        if (nextDutyType === DUTY_TYPES.OFFICER_DAILY && location && !OFFICER_DUTY_LOCATIONS.includes(location)) {
          return res.status(400).json({
            success: false,
            error: `Invalid location. Must be one of: ${OFFICER_DUTY_LOCATIONS.join(', ')}`,
            code: 'INVALID_LOCATION',
          });
        }
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
