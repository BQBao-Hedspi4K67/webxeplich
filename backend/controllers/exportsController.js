import pool from '../config/database.js';

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

const getDateRange = ({ scope, weekNo, month, year }) => {
  if (scope === 'week' && weekNo) {
    const range = getIsoWeekRange(weekNo, year);
    if (range) {
      return { where: 'date BETWEEN ? AND ?', params: [range.startDate, range.endDate] };
    }
  }

  if (scope === 'month' && month) {
    return {
      where: "DATE_FORMAT(date, '%Y-%m') = ?",
      params: [month],
    };
  }

  return { where: '1=1', params: [] };
};

const buildCsv = (rows) => {
  const header = ['Loai', 'ID', 'Ngay', 'ThoiGian', 'NoiDung', 'DiaDiem', 'NguoiPhuTrach', 'TrangThai'];
  const dataLines = rows.map((r) => [
    r.type,
    r.id,
    r.date,
    `${r.startTime || ''}-${r.endTime || ''}`,
    r.title,
    r.location || '',
    r.assignedTo || '',
    r.status,
  ]);

  const toCsvCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  return [header, ...dataLines].map((line) => line.map(toCsvCell).join(',')).join('\n');
};

export const getExportPreview = async (req, res, next) => {
  try {
    const {
      type = 'congtac',
      scope = 'week',
      weekNo = '',
      month = '',
      year = new Date().getFullYear(),
    } = req.query;

    const connection = await pool.getConnection();
    try {
      const selector = getDateRange({ scope, weekNo, month, year });
      const result = { workSchedules: [], dutySchedules: [] };

      if (type === 'congtac' || type === 'both') {
        const [workRows] = await connection.execute(
          `SELECT id, title, date, startTime, endTime, location, assignedTo, status
           FROM work_schedules
           WHERE ${selector.where}
           ORDER BY date ASC, startTime ASC`,
          selector.params
        );
        result.workSchedules = workRows;
      }

      if (type === 'trucban' || type === 'both') {
        const [dutyRows] = await connection.execute(
          `SELECT ds.id,
                  ds.dutyType,
                  ds.date,
                  ds.endDate,
                  ds.startTime,
                  ds.endTime,
                  ds.location,
                  ds.status,
                  o.fullName AS officerName
           FROM duty_schedules ds
           LEFT JOIN officers o ON ds.officerId = o.id
           WHERE ${selector.where}
           ORDER BY ds.date ASC, ds.startTime ASC`,
          selector.params
        );
        result.dutySchedules = dutyRows;
      }

      res.json({ success: true, data: result });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const downloadExport = async (req, res, next) => {
  try {
    const {
      type = 'congtac',
      scope = 'week',
      weekNo = '',
      month = '',
      year = new Date().getFullYear(),
      format = 'csv',
    } = req.query;

    const connection = await pool.getConnection();
    try {
      const selector = getDateRange({ scope, weekNo, month, year });
      let unifiedRows = [];

      if (type === 'congtac' || type === 'both') {
        const [workRows] = await connection.execute(
          `SELECT
             'congtac' AS type,
             id,
             date,
             startTime,
             endTime,
             title,
             location,
             assignedTo,
             status
           FROM work_schedules
           WHERE ${selector.where}`,
          selector.params
        );
        unifiedRows = unifiedRows.concat(workRows);
      }

      if (type === 'trucban' || type === 'both') {
        const [dutyRows] = await connection.execute(
          `SELECT
             'trucban' AS type,
             ds.id,
             ds.date,
             ds.startTime,
             ds.endTime,
             CONCAT('Truc ban - ', COALESCE(o.fullName, ds.officerId)) AS title,
             ds.location,
             COALESCE(o.fullName, ds.officerId) AS assignedTo,
             ds.status
           FROM duty_schedules ds
           LEFT JOIN officers o ON o.id = ds.officerId
           WHERE ${selector.where}`,
          selector.params
        );
        unifiedRows = unifiedRows.concat(dutyRows);
      }

      unifiedRows.sort((a, b) => {
        if (a.date === b.date) return String(a.startTime || '').localeCompare(String(b.startTime || ''));
        return String(a.date).localeCompare(String(b.date));
      });

      const fileNameBase = `lich_${type}_${scope}_${weekNo || month || 'all'}`;
      const actor = req.user;

      await connection.execute(
        `INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [actor.id, actor.username, actor.role, type, scope, format, unifiedRows.length]
      );

      if (format === 'json') {
        res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.json"`);
        return res.json({ success: true, data: unifiedRows });
      }

      const csv = buildCsv(unifiedRows);
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.csv"`);
      res.type('text/csv; charset=utf-8');
      return res.send(`\uFEFF${csv}`);
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

export const getExportHistory = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, username, role, exportType, exportScope, exportFormat, itemCount, createdAt
         FROM export_logs
         ORDER BY createdAt DESC
         LIMIT ${lim}`
      );

      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
