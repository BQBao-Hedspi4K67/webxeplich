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

const toMonthLabel = (monthKey) => {
  const month = parseInt(String(monthKey).slice(5), 10);
  return `T${month}`;
};

export const getOverview = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [officersRows] = await connection.execute(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
         FROM officers`
      );

      const [workRows] = await connection.execute(
        `SELECT
          COUNT(*) AS total
         FROM work_schedules`
      );

      const [dutyRows] = await connection.execute(
        `SELECT
          COUNT(*) AS total
         FROM duty_schedules`
      );

      const [pendingLeaveRows] = await connection.execute(
        `SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'pending'`
      );

      const [monthlyWork] = await connection.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') AS monthKey, COUNT(*) AS countWork
         FROM work_schedules
         WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY monthKey ASC`
      );

      const [monthlyDuty] = await connection.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') AS monthKey, COUNT(*) AS countDuty
         FROM duty_schedules
         WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY monthKey ASC`
      );

      const [activitiesRows] = await connection.execute(
        `SELECT id, actorUsername, action, module, summary, createdAt
         FROM activity_logs
         ORDER BY createdAt DESC
         LIMIT 12`
      );

      const activityData = activitiesRows.map((a) => ({
        id: a.id,
        time: toRelativeTimeVi(a.createdAt),
        text: a.summary,
        user: a.actorUsername || 'system',
        type: a.action,
      }));

      const monthMap = new Map();
      for (const row of monthlyWork) {
        monthMap.set(row.monthKey, {
          thang: toMonthLabel(row.monthKey),
          lichCongTac: Number(row.countWork),
          lichTrucBan: 0,
        });
      }
      for (const row of monthlyDuty) {
        const current = monthMap.get(row.monthKey) || {
          thang: toMonthLabel(row.monthKey),
          lichCongTac: 0,
          lichTrucBan: 0,
        };
        current.lichTrucBan = Number(row.countDuty);
        monthMap.set(row.monthKey, current);
      }

      const monthlyStats = [...monthMap.entries()]
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map((x) => x[1]);

      res.json({
        success: true,
        data: {
          stats: {
            totalOfficers: Number(officersRows[0].total || 0),
            activeOfficers: Number(officersRows[0].active || 0),
            totalWorkSchedules: Number(workRows[0].total || 0),
            totalDutySchedules: Number(dutyRows[0].total || 0),
            pendingLeaveRequests: Number(pendingLeaveRows[0].pending || 0),
          },
          monthlyStats,
          recentActivities: activityData,
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
