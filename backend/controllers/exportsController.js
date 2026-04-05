import pool from '../config/database.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const pickPdfFontPath = () => {
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf'),
    path.join(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
    path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/tahoma.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return null;
};

const formatTimeRange = (startTime, endTime) => {
  const start = String(startTime || '').slice(0, 5);
  const end = String(endTime || '').slice(0, 5);
  if (start && end) return `${start} - ${end}`;
  return start || end || '';
};

const formatWorkResponsible = (row) => {
  const entries = [
    ['Người PT', row.responsibleOfficerName],
    ['Cán bộ 1', row.officer1Name],
    ['Cán bộ 2', row.officer2Name],
    ['Trực CH', row.commanderOfficerName],
  ].filter(([, value]) => Boolean(value));

  return entries.map(([label, value]) => `${label}: ${value}`).join(' | ');
};

const buildUnifiedRows = ({ workRows, dutyRows }) => {
  const work = (workRows || []).map((row) => ({
    date: row.date,
    title: row.title,
    timeRange: formatTimeRange(row.startTime, row.endTime),
    responsible: formatWorkResponsible(row),
  }));

  const duty = (dutyRows || []).map((row) => ({
    date: row.date,
    title: `Trực ban - ${row.officerName || ''}`,
    timeRange: formatTimeRange(row.startTime, row.endTime),
    responsible: row.officerName || '',
  }));

  return [...work, ...duty].sort((a, b) => {
    if (a.date === b.date) return String(a.timeRange || '').localeCompare(String(b.timeRange || ''));
    return String(a.date).localeCompare(String(b.date));
  });
};

const shouldShowOnlyApprovedWorkSchedules = (role) => role !== 'admin' && role !== 'manager';
const writePdf = (res, fileName, rows, title) => {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const selectedFont = pickPdfFontPath();

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  if (selectedFont) {
    doc.font(selectedFont);
  }

  doc.fontSize(14).text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, { align: 'right' });
  doc.moveDown(0.7);

  const headers = ['STT', 'Ngày', 'Nội dung', 'Thời gian', 'Phụ trách'];
  const widths = [35, 70, 175, 85, 165];
  const startX = doc.page.margins.left;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const padding = 4;
  let y = doc.y;

  const drawRow = (cells, isHeader = false) => {
    const fontSize = isHeader ? 9 : 8.5;
    doc.fontSize(fontSize).fillColor('#111827');

    const textHeights = cells.map((cell, idx) => doc.heightOfString(String(cell || ''), {
      width: widths[idx] - (padding * 2),
      align: 'left',
    }));

    const baseHeight = isHeader ? 22 : 20;
    const rowHeight = Math.max(baseHeight, ...textHeights.map((h) => h + (padding * 2)));

    if (y + rowHeight > pageBottom()) {
      doc.addPage();
      if (selectedFont) doc.font(selectedFont);
      y = doc.page.margins.top;
      drawRow(headers, true);
    }

    let x = startX;
    for (let i = 0; i < cells.length; i += 1) {
      if (isHeader) {
        doc.rect(x, y, widths[i], rowHeight).fillAndStroke('#f1f5f9', '#cbd5e1');
      } else {
        doc.rect(x, y, widths[i], rowHeight).stroke('#d1d5db');
      }
      doc.fillColor('#111827').text(String(cells[i] || ''), x + padding, y + padding, {
        width: widths[i] - (padding * 2),
        align: 'left',
      });
      x += widths[i];
    }
    y += rowHeight;
  };

  drawRow(headers, true);
  rows.forEach((row, index) => {
    drawRow([
      String(index + 1),
      row.date,
      row.title,
      row.timeRange,
      row.responsible,
    ]);
  });

  if (!rows.length) {
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#6b7280').text('Không có dữ liệu trong phạm vi đã chọn.', { align: 'center' });
  }

  doc.end();
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
      const approvalFilter = shouldShowOnlyApprovedWorkSchedules(req.user?.role)
        ? " AND COALESCE(ws.approvalStatus, 'approved') = 'approved'"
        : '';

      if (type === 'congtac' || type === 'both') {
        const [workRows] = await connection.execute(
          `SELECT ws.id, ws.title, ws.date, ws.startTime, ws.endTime, ws.location,
                  ro.fullName AS responsibleOfficerName,
                  o1.fullName AS officer1Name,
                  o2.fullName AS officer2Name,
                  cmd.fullName AS commanderOfficerName
           FROM work_schedules ws
           LEFT JOIN officers ro ON ro.id = ws.responsibleOfficerId
           LEFT JOIN officers o1 ON o1.id = ws.officer1Id
           LEFT JOIN officers o2 ON o2.id = ws.officer2Id
           LEFT JOIN officers cmd ON cmd.id = ws.commanderOfficerId
           WHERE ${selector.where}${approvalFilter}
           ORDER BY ws.date ASC, ws.startTime ASC`,
          selector.params
        );
        result.workSchedules = workRows.map((row) => ({
          ...row,
          responsibleSummary: formatWorkResponsible(row),
        }));
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
      format = 'pdf',
    } = req.query;

    if (String(format || '').toLowerCase() !== 'pdf') {
      return res.status(400).json({
        success: false,
        error: 'Only PDF export is supported',
        code: 'UNSUPPORTED_EXPORT_FORMAT',
      });
    }

    const approvalFilter = shouldShowOnlyApprovedWorkSchedules(req.user?.role)
      ? " AND COALESCE(ws.approvalStatus, 'approved') = 'approved'"
      : '';

    const connection = await pool.getConnection();
    try {
      const selector = getDateRange({ scope, weekNo, month, year });
      let workRows = [];
      let dutyRows = [];

      if (type === 'congtac' || type === 'both') {
        const [rows] = await connection.execute(
          `SELECT
             ws.id,
             ws.date,
             ws.startTime,
             ws.endTime,
             ws.title,
             ws.location,
             ro.fullName AS responsibleOfficerName,
             o1.fullName AS officer1Name,
             o2.fullName AS officer2Name,
             cmd.fullName AS commanderOfficerName
           FROM work_schedules ws
           LEFT JOIN officers ro ON ro.id = ws.responsibleOfficerId
           LEFT JOIN officers o1 ON o1.id = ws.officer1Id
           LEFT JOIN officers o2 ON o2.id = ws.officer2Id
           LEFT JOIN officers cmd ON cmd.id = ws.commanderOfficerId
           WHERE ${selector.where}${approvalFilter}
           ORDER BY ws.date ASC, ws.startTime ASC`,
          selector.params
        );
        workRows = rows;
      }

      if (type === 'trucban' || type === 'both') {
        const [rows] = await connection.execute(
          `SELECT
             ds.id,
             ds.date,
             ds.startTime,
             ds.endTime,
             ds.location,
             COALESCE(o.fullName, ds.officerId) AS officerName
           FROM duty_schedules ds
           LEFT JOIN officers o ON o.id = ds.officerId
           WHERE ${selector.where}`,
          selector.params
        );
        dutyRows = rows;
      }

      const unifiedRows = buildUnifiedRows({ workRows, dutyRows });

      const fileNameBase = `lich_${type}_${scope}_${weekNo || month || 'all'}`;
      const actor = req.user;

      await connection.execute(
        `INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [actor.id, actor.username, actor.role, type, scope, 'pdf', unifiedRows.length]
      );

      const pdfTitle =
        type === 'congtac'
          ? 'BẢNG PHÂN CÔNG LỊCH CÔNG TÁC'
          : type === 'trucban'
            ? 'BẢNG PHÂN CÔNG LỊCH TRỰC BAN'
            : 'BẢNG PHÂN CÔNG LỊCH CÔNG TÁC VÀ TRỰC BAN';

      writePdf(
        res,
        fileNameBase,
        unifiedRows,
        pdfTitle
      );
      return null;
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
