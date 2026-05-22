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

const toDateOnly = (value) => String(value || '').slice(0, 10);

const formatDateVN = (dateValue) => {
  const [y, m, d] = toDateOnly(dateValue).split('-');
  if (!y || !m || !d) return toDateOnly(dateValue);
  return `${d}/${m}/${y}`;
};

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const getWeekdayLabel = (dateValue) => {
  const dt = new Date(`${toDateOnly(dateValue)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return WEEKDAY_LABELS[dt.getDay()] || '';
};

const getScopeBounds = ({ scope, weekNo, month, year }) => {
  if (scope === 'week' && weekNo) {
    return getIsoWeekRange(weekNo, year);
  }

  if (scope === 'month' && month) {
    const [y, m] = String(month).split('-').map(Number);
    if (!y || !m) return null;
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  return null;
};

const getDateListByBounds = (bounds) => {
  if (!bounds?.startDate || !bounds?.endDate) return [];
  const out = [];
  const cursor = new Date(`${bounds.startDate}T00:00:00Z`);
  const end = new Date(`${bounds.endDate}T00:00:00Z`);

  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
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

const drawPdfTopHeader = (doc, selectedFont, { title, bounds }) => {
  const leftX = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rightBoxWidth = 150;
  const topY = doc.page.margins.top;

  if (selectedFont) {
    doc.font(selectedFont);
  }

  doc.fontSize(14).text('BỘ CÔNG AN', leftX, topY + 2, { width: 120, align: 'center' });
  doc.fontSize(12).text('T07', leftX, topY + 25, { width: 120, align: 'center', underline: true });

  const centerX = leftX + 120;
  const centerWidth = contentWidth - 120 - rightBoxWidth;
  doc.fontSize(20).text(title, centerX, topY + 5, { width: centerWidth, align: 'center' });

  const rangeText = bounds
    ? `(Từ ngày ${formatDateVN(bounds.startDate)} đến hết ngày ${formatDateVN(bounds.endDate)})`
    : '(Theo phạm vi được chọn)';
  // Keep this line full-width so the end date is never clipped by the right update box.
  doc.fontSize(13).text(rangeText, leftX, topY + 42, { width: contentWidth, align: 'center' });

  const rightX = leftX + contentWidth - rightBoxWidth;
  doc.rect(rightX, topY, rightBoxWidth, 28).stroke('#111827');
  doc.fontSize(10).text(`Cập nhật ${new Date().toLocaleDateString('vi-VN')}`, rightX + 6, topY + 8, {
    width: rightBoxWidth - 12,
    align: 'center',
  });

  doc.y = topY + 68;
};

const drawTableRow = (doc, y, widths, cells, { isHeader = false, minHeight = 24 } = {}) => {
  const startX = doc.page.margins.left;
  const padding = 4;
  const fontSize = isHeader ? 10 : 9;
  doc.fontSize(fontSize);

  const textHeights = cells.map((cell, idx) => doc.heightOfString(String(cell || ''), {
    width: widths[idx] - (padding * 2),
    align: 'left',
  }));

  const rowHeight = Math.max(minHeight, ...textHeights.map((h) => h + (padding * 2)));
  let x = startX;

  for (let i = 0; i < cells.length; i += 1) {
    if (isHeader) {
      doc.rect(x, y, widths[i], rowHeight).fillAndStroke('#f3f4f6', '#1f2937');
      doc.fillColor('#111827');
    } else {
      doc.rect(x, y, widths[i], rowHeight).stroke('#9ca3af');
      doc.fillColor('#111827');
    }

    doc.text(String(cells[i] || ''), x + padding, y + padding, {
      width: widths[i] - (padding * 2),
      align: i === 0 ? 'center' : 'left',
    });
    x += widths[i];
  }

  return y + rowHeight;
};

const ensurePageSpace = (doc, y, needed, selectedFont) => {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + needed <= bottom) return y;
  doc.addPage();
  if (selectedFont) doc.font(selectedFont);
  return doc.page.margins.top;
};

const buildWorkRowsByDay = (workRows, dateList) => {
  const byDate = new Map();
  for (const date of dateList) {
    byDate.set(date, { morning: [], afternoon: [] });
  }

  for (const row of workRows || []) {
    const date = toDateOnly(row.date);
    if (!byDate.has(date)) byDate.set(date, { morning: [], afternoon: [] });

    const timeRange = formatTimeRange(row.startTime, row.endTime);
    const location = row.location ? ` (${row.location})` : '';
    const responsible = formatWorkResponsible(row);
    const line = `${timeRange ? `- ${timeRange}: ` : '- '}${row.title || ''}${location}${responsible ? `\n  ${responsible}` : ''}`;

    const hour = Number(String(row.startTime || '').slice(0, 2));
    if (!Number.isNaN(hour) && hour >= 12) {
      byDate.get(date).afternoon.push(line);
    } else {
      byDate.get(date).morning.push(line);
    }
  }

  return dateList.map((date) => {
    const slot = byDate.get(date) || { morning: [], afternoon: [] };
    return {
      date,
      morningText: slot.morning.join('\n\n') || '---',
      afternoonText: slot.afternoon.join('\n\n') || '---',
    };
  });
};

const writeWorkSchedulePdf = (doc, selectedFont, workRows, bounds) => {
  drawPdfTopHeader(doc, selectedFont, { title: 'LỊCH SỰ KIỆN TUẦN', bounds });

  const dateList = getDateListByBounds(bounds);
  const rows = buildWorkRowsByDay(workRows, dateList.length ? dateList : Array.from(new Set((workRows || []).map((x) => toDateOnly(x.date)))));
  const widths = [110, 206, 206];
  let y = doc.y;

  y = drawTableRow(doc, y, widths, ['THỨ/NGÀY', 'SÁNG', 'CHIỀU'], { isHeader: true, minHeight: 28 });

  for (const row of rows) {
    y = ensurePageSpace(doc, y, 60, selectedFont);
    const dayCell = `${getWeekdayLabel(row.date)}\n${formatDateVN(row.date)}`;
    y = drawTableRow(doc, y, widths, [dayCell, row.morningText, row.afternoonText], { minHeight: 44 });
  }

  if (!rows.length) {
    doc.moveDown(1);
    doc.fontSize(11).fillColor('#6b7280').text('Không có dữ liệu lịch sự kiện trong phạm vi đã chọn.', { align: 'center' });
  }
};

const buildDutyRowsByDay = (dutyRows, bounds) => {
  const dateList = getDateListByBounds(bounds);
  const byDate = new Map(dateList.map((d) => [d, {
    hbOfficer1: null,
    hbOfficer2: null,
    hbCommander: null,
    driver: null,
    medic: null,
    director: null,
  }]));

  const ensureDay = (date) => {
    if (!byDate.has(date)) {
      byDate.set(date, {
        hbOfficer1: null,
        hbOfficer2: null,
        hbCommander: null,
        driver: null,
        medic: null,
        director: null,
      });
    }
    return byDate.get(date);
  };

  const buildPersonText = (row) => {
    const officerName = row.officerName || row.officerId || '---';
    const timeRange = formatTimeRange(row.startTime, row.endTime);
    const dutyTypeTag = row.dutyType === 'holiday_daily' ? ' (Trực lễ)' : '';
    return `${officerName}${dutyTypeTag}${timeRange ? `\n${timeRange}` : ''}`;
  };

  for (const row of dutyRows || []) {
    const value = buildPersonText(row);

    if (row.dutyType === 'director_weekly') {
      const start = toDateOnly(row.date);
      const end = toDateOnly(row.endDate || row.date);
      const dates = dateList.length ? dateList.filter((d) => d >= start && d <= end) : [start];
      for (const d of dates) {
        const day = ensureDay(d);
        day.director = `Trực ban Giám đốc\n${value}`;
      }
      continue;
    }

    const d = toDateOnly(row.date);
    const day = ensureDay(d);
    const dutyRole = String(row.dutyRole || 'officer');
    const slotNo = Number(row.slotNo || 1);
    const location = String(row.location || '');

    if (location === 'Nhà hiệu bộ') {
      if (dutyRole === 'commander') {
        day.hbCommander = `Chỉ huy: ${value}`;
      } else if (slotNo === 2) {
        day.hbOfficer2 = `Cán bộ 2: ${value}`;
      } else {
        day.hbOfficer1 = `Cán bộ 1: ${value}`;
      }
    }

    if (location === 'Lái xe' || location === 'Nhà xe') {
      day.driver = value;
    }

    if (location === 'Bệnh xá' || location === 'Trạm xá') {
      day.medic = value;
    }
  }

  const keys = dateList.length ? dateList : Array.from(byDate.keys()).sort();
  return keys.map((date) => {
    const day = byDate.get(date) || {};
    const hbText = [
      day.hbOfficer1,
      day.hbOfficer2,
      day.hbCommander,
    ].filter(Boolean).join('\n\n') || '---';

    return {
      date,
      nhaHieuBo: hbText,
      laiXe: day.driver || '---',
      benhXa: day.medic || '---',
      giamDoc: day.director || '---',
    };
  });
};

const writeDutySchedulePdf = (doc, selectedFont, dutyRows, bounds) => {
  drawPdfTopHeader(doc, selectedFont, { title: 'LỊCH TRỰC BAN', bounds });

  const rows = buildDutyRowsByDay(dutyRows, bounds);
  const widths = [90, 108, 108, 108, 108];
  let y = doc.y;

  y = drawTableRow(doc, y, widths, ['THỨ/NGÀY', 'NHÀ HIỆU BỘ', 'LÁI XE', 'BỆNH XÁ', 'TRỰC BAN GIÁM ĐỐC'], { isHeader: true, minHeight: 30 });

  for (const row of rows) {
    y = ensurePageSpace(doc, y, 64, selectedFont);
    const dayCell = `${getWeekdayLabel(row.date)}\n${formatDateVN(row.date)}`;
    y = drawTableRow(doc, y, widths, [dayCell, row.nhaHieuBo, row.laiXe, row.benhXa, row.giamDoc], { minHeight: 52 });
  }

  if (!rows.length) {
    doc.moveDown(1);
    doc.fontSize(11).fillColor('#6b7280').text('Không có dữ liệu lịch trực ban trong phạm vi đã chọn.', { align: 'center' });
  }
};

const writePdf = (res, fileName, payload, meta) => {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const selectedFont = pickPdfFontPath();

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  if (selectedFont) {
    doc.font(selectedFont);
  }

  if (meta.type === 'congtac') {
    writeWorkSchedulePdf(doc, selectedFont, payload.workRows || [], meta.bounds);
  } else if (meta.type === 'trucban') {
    writeDutySchedulePdf(doc, selectedFont, payload.dutyRows || [], meta.bounds);
  } else {
    writeWorkSchedulePdf(doc, selectedFont, payload.workRows || [], meta.bounds);
    doc.addPage();
    if (selectedFont) doc.font(selectedFont);
    writeDutySchedulePdf(doc, selectedFont, payload.dutyRows || [], meta.bounds);
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
                  CONCAT_WS(' ', NULLIF(ro.officerTitle, ''), ro.fullName) AS responsibleOfficerName,
                  CONCAT_WS(' ', NULLIF(o1.officerTitle, ''), o1.fullName) AS officer1Name,
                  CONCAT_WS(' ', NULLIF(o2.officerTitle, ''), o2.fullName) AS officer2Name,
                  CONCAT_WS(' ', NULLIF(cmd.officerTitle, ''), cmd.fullName) AS commanderOfficerName
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
        const bounds = getScopeBounds({ scope, weekNo, month, year });
        if (bounds) {
          const [dutyRows] = await connection.execute(
            `SELECT ds.id,
                    ds.dutyType,
                    ds.date,
                    ds.endDate,
                    ds.startTime,
                    ds.endTime,
                    ds.location,
                  ds.dutyRole,
                  ds.slotNo,
                  ds.assignmentGroup,
                    ds.officerId,
                    CONCAT_WS(' ', NULLIF(o.officerTitle, ''), o.fullName) AS officerName
             FROM duty_schedules ds
             LEFT JOIN officers o ON ds.officerId = o.id
             WHERE (
               (ds.dutyType IN ('officer_daily', 'holiday_daily') AND ds.date BETWEEN ? AND ?)
               OR
               (ds.dutyType = 'director_weekly' AND ds.date <= ? AND COALESCE(ds.endDate, ds.date) >= ?)
             )
             ORDER BY ds.date ASC, ds.startTime ASC`,
            [bounds.startDate, bounds.endDate, bounds.endDate, bounds.startDate]
          );
          result.dutySchedules = dutyRows;
        } else {
          const [dutyRows] = await connection.execute(
            `SELECT ds.id,
                    ds.dutyType,
                    ds.date,
                    ds.endDate,
                    ds.startTime,
                    ds.endTime,
                    ds.location,
                  ds.dutyRole,
                  ds.slotNo,
                  ds.assignmentGroup,
                    ds.officerId,
                    CONCAT_WS(' ', NULLIF(o.officerTitle, ''), o.fullName) AS officerName
             FROM duty_schedules ds
             LEFT JOIN officers o ON ds.officerId = o.id
             WHERE ${selector.where}
             ORDER BY ds.date ASC, ds.startTime ASC`,
            selector.params
          );
          result.dutySchedules = dutyRows;
        }
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
             CONCAT_WS(' ', NULLIF(ro.officerTitle, ''), ro.fullName) AS responsibleOfficerName,
             CONCAT_WS(' ', NULLIF(o1.officerTitle, ''), o1.fullName) AS officer1Name,
             CONCAT_WS(' ', NULLIF(o2.officerTitle, ''), o2.fullName) AS officer2Name,
             CONCAT_WS(' ', NULLIF(cmd.officerTitle, ''), cmd.fullName) AS commanderOfficerName
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
        const bounds = getScopeBounds({ scope, weekNo, month, year });
        if (bounds) {
          const [rows] = await connection.execute(
            `SELECT
               ds.id,
               ds.dutyType,
               ds.date,
               ds.endDate,
               ds.startTime,
               ds.endTime,
               ds.location,
              ds.dutyRole,
              ds.slotNo,
              ds.assignmentGroup,
               ds.officerId,
               COALESCE(CONCAT_WS(' ', NULLIF(o.officerTitle, ''), o.fullName), ds.officerId) AS officerName
             FROM duty_schedules ds
             LEFT JOIN officers o ON o.id = ds.officerId
             WHERE (
               (ds.dutyType IN ('officer_daily', 'holiday_daily') AND ds.date BETWEEN ? AND ?)
               OR
               (ds.dutyType = 'director_weekly' AND ds.date <= ? AND COALESCE(ds.endDate, ds.date) >= ?)
             )
             ORDER BY ds.date ASC, ds.startTime ASC`,
            [bounds.startDate, bounds.endDate, bounds.endDate, bounds.startDate]
          );
          dutyRows = rows;
        } else {
          const [rows] = await connection.execute(
            `SELECT
               ds.id,
               ds.dutyType,
               ds.date,
               ds.endDate,
               ds.startTime,
               ds.endTime,
               ds.location,
              ds.dutyRole,
              ds.slotNo,
              ds.assignmentGroup,
               ds.officerId,
               COALESCE(CONCAT_WS(' ', NULLIF(o.officerTitle, ''), o.fullName), ds.officerId) AS officerName
             FROM duty_schedules ds
             LEFT JOIN officers o ON o.id = ds.officerId
             WHERE ${selector.where}`,
            selector.params
          );
          dutyRows = rows;
        }
      }

      const bounds = getScopeBounds({ scope, weekNo, month, year });

      const fileNameBase = `lich_${type}_${scope}_${weekNo || month || 'all'}`;
      const actor = req.user;
      if (actor) {
        await connection.execute(
          `INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [actor.id, actor.username, actor.role, type, scope, 'pdf', (workRows?.length || 0) + (dutyRows?.length || 0)]
        );
      }

      writePdf(
        res,
        fileNameBase,
        { workRows, dutyRows },
        { type, bounds }
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
