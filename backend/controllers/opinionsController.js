import pool from '../config/database.js';
import { OPINION_STATUS } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';

// Get all opinions
export const getOpinions = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = '',
      officerId = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const connection = await pool.getConnection();

    try {
      let whereConditions = [];
      let params = [];

      if (status) {
        whereConditions.push("status = ?");
        params.push(status);
      }

      if (officerId) {
        whereConditions.push("officerId = ?");
        params.push(officerId);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Count
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM opinions ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // Get data
      const [opinions] = await connection.execute(
        `SELECT o.*, oc.fullName as officerName 
         FROM opinions o 
         LEFT JOIN officers oc ON o.officerId = oc.id 
         ${whereClause} 
         ORDER BY o.createdAt DESC 
         LIMIT ${parseInt(limit)} OFFSET ${offset}`,
        params
      );

      res.json({
        success: true,
        data: opinions,
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

// Get single opinion
export const getOpinionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT o.*, oc.fullName as officerName 
         FROM opinions o 
         LEFT JOIN officers oc ON o.officerId = oc.id 
         WHERE o.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Opinion not found',
          code: 'OPINION_NOT_FOUND',
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

// Create opinion (by officer on duty)
export const createOpinion = async (req, res, next) => {
  try {
    const { officerId, dutyDate, content } = req.body;

    if (!officerId || !dutyDate || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: officerId, dutyDate, content',
        code: 'VALIDATION_ERROR',
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

      // Verify officer is on duty
      const [dutyCheck] = await connection.execute(
        `SELECT id FROM duty_schedules 
         WHERE officerId = ? 
         AND ((dutyType = 'officer_daily' AND date = ?) 
              OR (dutyType = 'director_weekly' AND date <= ? AND (endDate IS NULL OR endDate >= ?)))`,
        [officerId, dutyDate, dutyDate, dutyDate]
      );

      if (dutyCheck.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Officer is not on duty on this date',
          code: 'NOT_ON_DUTY',
        });
      }

      // Create opinion
      await connection.execute(
        `INSERT INTO opinions (officerId, dutyDate, content, status)
         VALUES (?, ?, ?, 'pending')`,
        [officerId, dutyDate, content]
      );

      const [idRows] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const opinionId = idRows[0].id;

      await connection.execute(
        `INSERT INTO notifications (title, content, type, module, entityType, entityId)
         VALUES (?, ?, 'info', 'ykien', 'opinion', ?)`,
        [
          'Co y kien truc ban cho duyet',
          `Can bo ${officerId} vua gui y kien truc ban moi.`,
          String(opinionId),
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Opinion submitted successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'ykien',
        action: 'create',
        entityType: 'opinion',
        entityId: String(opinionId),
        summary: `Gui y kien truc ban #${opinionId}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Approve/Reject opinion (admin only)
export const updateOpinionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminFeedback = '' } = req.body;

    if (!status || !Object.values(OPINION_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${Object.values(OPINION_STATUS).join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check exists
      const [check] = await connection.execute(
        'SELECT id FROM opinions WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Opinion not found',
          code: 'OPINION_NOT_FOUND',
        });
      }

      await connection.execute(
        `UPDATE opinions SET status = ?, adminFeedback = ? WHERE id = ?`,
        [status, adminFeedback || null, id]
      );

      await connection.execute(
        `INSERT INTO notifications (title, content, type, module, entityType, entityId)
         VALUES (?, ?, ?, 'ykien', 'opinion', ?)`,
        [
          status === 'approved' ? 'Y kien da duoc duyet' : 'Y kien bi tu choi',
          status === 'approved'
            ? `Y kien #${id} da duoc admin phe duyet.`
            : `Y kien #${id} da bi admin tu choi.`,
          status === 'approved' ? 'success' : 'warning',
          String(id),
        ]
      );

      res.json({
        success: true,
        message: 'Opinion updated successfully',
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'ykien',
        action: status === 'approved' ? 'approve' : 'reject',
        entityType: 'opinion',
        entityId: String(id),
        summary: `${status === 'approved' ? 'Duyet' : 'Tu choi'} y kien truc ban #${id}`,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Delete opinion (admin only)
export const deleteOpinion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [check] = await connection.execute(
        'SELECT id FROM opinions WHERE id = ?',
        [id]
      );

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Opinion not found',
          code: 'OPINION_NOT_FOUND',
        });
      }

      await connection.execute('DELETE FROM opinions WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Opinion deleted successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
