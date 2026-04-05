import pool from '../config/database.js';
import { LEAVE_REQUEST_STATUS } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureNotificationTargetingSchema,
  createRoleNotification,
  createUserNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';

const toDateOnly = (value) => String(value || '').slice(0, 10);

export const getOpinions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      officerId = '',
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const connection = await pool.getConnection();

    try {
      const whereConditions = [];
      const params = [];

      if (status) {
        whereConditions.push('lr.status = ?');
        params.push(status);
      }

      if (officerId) {
        whereConditions.push('lr.officerId = ?');
        params.push(officerId);
      }

      const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM leave_requests lr ${whereClause}`,
        params
      );

      const [rows] = await connection.execute(
        `SELECT lr.*, o.fullName AS officerName
         FROM leave_requests lr
         LEFT JOIN officers o ON o.id = lr.officerId
         ${whereClause}
         ORDER BY lr.createdAt DESC
         LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
        params
      );

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: countRows[0].total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(countRows[0].total / parseInt(limit, 10)),
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const getOpinionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT lr.*, o.fullName AS officerName
         FROM leave_requests lr
         LEFT JOIN officers o ON o.id = lr.officerId
         WHERE lr.id = ?`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Leave request not found',
          code: 'LEAVE_REQUEST_NOT_FOUND',
        });
      }

      res.json({ success: true, data: rows[0] });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const createOpinion = async (req, res, next) => {
  try {
    const { officerId, leaveDate, reason, dutyScheduleId } = req.body;

    if (!officerId || !leaveDate || !reason || !dutyScheduleId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: officerId, leaveDate, reason, dutyScheduleId',
        code: 'VALIDATION_ERROR',
      });
    }

    const connection = await pool.getConnection();

    try {
      const [officerRows] = await connection.execute(
        'SELECT id FROM officers WHERE id = ? LIMIT 1',
        [officerId]
      );

      if (!officerRows.length) {
        return res.status(404).json({
          success: false,
          error: 'Officer not found',
          code: 'OFFICER_NOT_FOUND',
        });
      }

      const [dutyRows] = await connection.execute(
        `SELECT id, officerId, dutyType, date, endDate
         FROM duty_schedules
         WHERE id = ?
           AND officerId = ?
         LIMIT 1`,
        [dutyScheduleId, officerId]
      );

      if (!dutyRows.length) {
        return res.status(400).json({
          success: false,
          error: 'Chỉ được xin nghỉ cho lịch trực đã phân công của chính bạn.',
          code: 'DUTY_NOT_ASSIGNED',
        });
      }

      const duty = dutyRows[0];
      const leaveDateOnly = toDateOnly(leaveDate);
      const dutyStart = toDateOnly(duty.date);
      const dutyEnd = toDateOnly(duty.endDate || duty.date);
      const inDutyRange = leaveDateOnly >= dutyStart && leaveDateOnly <= dutyEnd;

      if (!inDutyRange) {
        return res.status(400).json({
          success: false,
          error: 'Ngày xin nghỉ phải thuộc đúng ngày trực đã chọn.',
          code: 'LEAVE_DATE_NOT_IN_DUTY',
        });
      }

      const [dupeRows] = await connection.execute(
        `SELECT id FROM leave_requests
         WHERE officerId = ? AND leaveDate = ? AND status = 'pending'
         LIMIT 1`,
        [officerId, leaveDateOnly]
      );

      if (dupeRows.length) {
        return res.status(409).json({
          success: false,
          error: 'Đã có đơn xin nghỉ trực đang chờ duyệt cho ngày này.',
          code: 'DUPLICATE_PENDING_LEAVE',
        });
      }

      await connection.execute(
        `INSERT INTO leave_requests (officerId, dutyScheduleId, leaveDate, reason, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [officerId, dutyScheduleId, leaveDateOnly, reason]
      );

      const [idRows] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const leaveRequestId = idRows[0].id;

      await ensureNotificationTargetingSchema(connection);
      await createRoleNotification(connection, {
        title: 'Co don xin nghi cho duyet',
        content: `Can bo ${officerId} vua gui don xin nghi truc ngay ${leaveDateOnly}.`,
        type: 'info',
        module: 'leave_request',
        entityType: 'leave_request',
        entityId: String(leaveRequestId),
        targetRole: 'admin',
      });
      await createRoleNotification(connection, {
        title: 'Co don xin nghi cho duyet',
        content: `Can bo ${officerId} vua gui don xin nghi truc ngay ${leaveDateOnly}.`,
        type: 'info',
        module: 'leave_request',
        entityType: 'leave_request',
        entityId: String(leaveRequestId),
        targetRole: 'manager',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'leave_request',
        action: 'create',
        entityType: 'leave_request',
        entityId: String(leaveRequestId),
        summary: `Gui don xin nghi #${leaveRequestId}`,
      });

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const updateOpinionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminFeedback = '' } = req.body;

    if (!status || !Object.values(LEAVE_REQUEST_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${Object.values(LEAVE_REQUEST_STATUS).join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id, officerId, dutyScheduleId, leaveDate FROM leave_requests WHERE id = ? LIMIT 1',
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Leave request not found',
          code: 'LEAVE_REQUEST_NOT_FOUND',
        });
      }

      const leaveRequest = rows[0];

      await connection.execute(
        `UPDATE leave_requests
         SET status = ?, adminFeedback = ?, reviewedByOfficerId = ?, reviewedAt = NOW()
         WHERE id = ?`,
        [status, adminFeedback || null, req.user?.officerId || null, id]
      );

      if (status === LEAVE_REQUEST_STATUS.APPROVED) {
        const leaveDate = toDateOnly(leaveRequest.leaveDate);

        const [dutyRows] = await connection.execute(
          `SELECT id, dutyType, date
           FROM duty_schedules
           WHERE id = ?
           LIMIT 1`,
          [leaveRequest.dutyScheduleId]
        );

        if (dutyRows.length) {
          const duty = dutyRows[0];

          await connection.execute(
            'DELETE FROM duty_schedules WHERE id = ?',
            [duty.id]
          );

          if (duty.dutyType === 'officer_daily') {
            // Shift all later officer_daily duties up by one day.
            await connection.execute(
              `UPDATE duty_schedules
               SET date = DATE_SUB(date, INTERVAL 1 DAY)
               WHERE dutyType = 'officer_daily'
                 AND date > ?`,
              [leaveDate]
            );
          }
        }

        // Remove approved-leave officer from work assignments on leave date.
        await connection.execute(
          `UPDATE work_schedules
           SET
             responsibleOfficerId = CASE WHEN responsibleOfficerId = ? AND date = ? THEN NULL ELSE responsibleOfficerId END,
             officer1Id = CASE WHEN officer1Id = ? AND date = ? THEN NULL ELSE officer1Id END,
             officer2Id = CASE WHEN officer2Id = ? AND date = ? THEN NULL ELSE officer2Id END,
             commanderOfficerId = CASE WHEN commanderOfficerId = ? AND date = ? THEN NULL ELSE commanderOfficerId END
           WHERE date = ?
             AND (
               responsibleOfficerId = ? OR officer1Id = ? OR officer2Id = ? OR commanderOfficerId = ?
             )`,
          [
            leaveRequest.officerId,
            leaveDate,
            leaveRequest.officerId,
            leaveDate,
            leaveRequest.officerId,
            leaveDate,
            leaveRequest.officerId,
            leaveDate,
            leaveDate,
            leaveRequest.officerId,
            leaveRequest.officerId,
            leaveRequest.officerId,
            leaveRequest.officerId,
          ]
        );
      }

      await ensureNotificationTargetingSchema(connection);
      const submitterUserId = await resolveUserIdByOfficerId(connection, leaveRequest.officerId);
      await createUserNotification(connection, {
        title: status === 'approved' ? 'Don xin nghi da duoc duyet' : 'Don xin nghi bi tu choi',
        content:
          status === 'approved'
            ? `Don xin nghi #${id} da duoc phe duyet.`
            : `Don xin nghi #${id} da bi tu choi.`,
        type: status === 'approved' ? 'success' : 'warning',
        module: 'leave_request',
        entityType: 'leave_request',
        entityId: String(id),
        targetUserId: submitterUserId,
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'leave_request',
        action: status === 'approved' ? 'approve' : 'reject',
        entityType: 'leave_request',
        entityId: String(id),
        summary: `${status === 'approved' ? 'Duyet' : 'Tu choi'} don xin nghi #${id}`,
      });

      res.json({ success: true, message: 'Leave request updated successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const deleteOpinion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id FROM leave_requests WHERE id = ? LIMIT 1',
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Leave request not found',
          code: 'LEAVE_REQUEST_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM leave_requests WHERE id = ?', [id]);
      res.json({ success: true, message: 'Leave request deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
