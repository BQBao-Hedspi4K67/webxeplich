import pool from '../config/database.js';

const toRelativeTimeVi = (dateValue) => {
  const date = new Date(dateValue);
  const diffSec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;

  return date.toLocaleDateString('vi-VN');
};

export const getNotifications = async (req, res, next) => {
  try {
    const { limit = 20, onlyUnread = '' } = req.query;
    const userId = req.user.id;
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));

    const connection = await pool.getConnection();
    try {
      let unreadClause = '';
      if (String(onlyUnread) === 'true') {
        unreadClause = 'AND nr.notificationId IS NULL';
      }

      const [rows] = await connection.execute(
        `SELECT n.id, n.title, n.content, n.type, n.createdAt, nr.readAt
         FROM notifications n
         LEFT JOIN notification_reads nr
           ON n.id = nr.notificationId AND nr.userId = ?
         WHERE n.isActive = 1 ${unreadClause}
         ORDER BY n.createdAt DESC
         LIMIT ${lim}`,
        [userId]
      );

      const data = rows.map((n) => ({
        id: n.id,
        tieuDe: n.title,
        noiDung: n.content,
        loai: n.type,
        daDoc: Boolean(n.readAt),
        thoiGian: toRelativeTimeVi(n.createdAt),
        createdAt: n.createdAt,
      }));

      res.json({ success: true, data });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO notification_reads (notificationId, userId, readAt)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE readAt = VALUES(readAt)`,
        [id, userId]
      );

      res.json({ success: true, message: 'Notification marked as read' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO notification_reads (notificationId, userId, readAt)
         SELECT n.id, ?, NOW()
         FROM notifications n
         WHERE n.isActive = 1
         ON DUPLICATE KEY UPDATE readAt = VALUES(readAt)`,
        [userId]
      );

      res.json({ success: true, message: 'All notifications marked as read' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
