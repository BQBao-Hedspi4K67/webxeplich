import React, { useState } from 'react';
import { FileText, Eye, Download, Check, Shield, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../services/api';

const XuatLich = ({ xuatLichHistory = [], reloadData }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getWeekStartDateByDate = (value = new Date()) => {
    const date = new Date(value);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const toDateOnly = (value) => {
    if (!value) return '';

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatLocalDate(value);
    }

    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatLocalDate(parsed);
    }

    return raw.slice(0, 10);
  };
  const shiftDateOnly = (dateValue, days) => {
    const date = new Date(`${toDateOnly(dateValue)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return toDateOnly(dateValue);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
  };
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

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  };
  const getIsoWeekMetaFromDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return { weekNo: 1, year: new Date().getFullYear() };
    }

    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

    return {
      weekNo,
      year: utcDate.getUTCFullYear(),
    };
  };
  const currentWeekStart = toDateOnly(getWeekStartDateByDate());
  const getWeekBoundsFromStartDate = (startDateValue) => {
    const startDate = toDateOnly(startDateValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;

    const endDate = shiftDateOnly(startDate, 6);
    return { startDate, endDate };
  };
  const getScopeBounds = () => {
    if (exportScope === 'week') {
      return getWeekBoundsFromStartDate(weekStartDate);
    }
    if (exportScope === 'month' && monthValue) {
      const [y, m] = String(monthValue).split('-').map(Number);
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
  const [exportType, setExportType] = useState('congtac');
  const [exportScope, setExportScope] = useState('week');
  const [weekStartDate, setWeekStartDate] = useState(currentWeekStart);
  const [monthValue, setMonthValue] = useState(currentMonth);
  const [previewReady, setPreviewReady] = useState(false);
  const [exported, setExported] = useState(false);
  const [previewData, setPreviewData] = useState({ workSchedules: [], dutySchedules: [] });
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectedWeekMeta = getIsoWeekMetaFromDate(weekStartDate);
  const selectedWeekBounds = getWeekBoundsFromStartDate(weekStartDate);

  const handlePreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await apiClient.exports.preview({
        type: exportType,
        scope: exportScope,
        weekNo: selectedWeekMeta.weekNo,
        year: selectedWeekMeta.year,
        month: monthValue,
      });
      setPreviewData(res?.data || { workSchedules: [], dutySchedules: [] });
      setPreviewReady(true);
    } catch (err) {
      alert(err?.message || 'Không thể tạo xem trước.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await apiClient.exports.download({
        type: exportType,
        scope: exportScope,
        weekNo: selectedWeekMeta.weekNo,
        year: selectedWeekMeta.year,
        month: monthValue,
        format: 'pdf',
      });

      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 3000);
      if (reloadData) await reloadData();
    } catch (err) {
      alert(err?.message || 'Không thể xuất lịch.');
    }
  };

  const buildWorkResponsible = (x) => {
    const entries = [
      ['Người PT', x.responsibleOfficerName],
      ['Cán bộ 1', x.officer1Name],
      ['Cán bộ 2', x.officer2Name],
      ['Trực CH', x.commanderOfficerName],
    ].filter(([, value]) => Boolean(value));

    return entries.map(([label, value]) => `${label}: ${value}`).join(' | ');
  };

  const previewBounds = getScopeBounds();
  const previewDateList = getDateListByBounds(previewBounds);

  const buildWorkRowsByDay = (workRows, dateList) => {
    const byDate = new Map();
    for (const date of dateList) {
      byDate.set(date, { morning: [], afternoon: [] });
    }

    for (const row of workRows || []) {
      const date = toDateOnly(row.date);
      if (!byDate.has(date)) byDate.set(date, { morning: [], afternoon: [] });

      const start = String(row.startTime || '').slice(0, 5);
      const end = String(row.endTime || '').slice(0, 5);
      const timeRange = start && end ? `${start} - ${end}` : start || end || '';
      const location = row.location ? ` (${row.location})` : '';
      const responsible = row.responsibleSummary || buildWorkResponsible(row);
      const line = `${timeRange ? `- ${timeRange}: ` : '- '}${row.title || ''}${location}${responsible ? `\n  ${responsible}` : ''}`;

      const hour = Number(start.slice(0, 2));
      if (!Number.isNaN(hour) && hour >= 12) {
        byDate.get(date).afternoon.push(line);
      } else {
        byDate.get(date).morning.push(line);
      }
    }

    return (dateList.length ? dateList : Array.from(byDate.keys()).sort()).map((date) => {
      const slot = byDate.get(date) || { morning: [], afternoon: [] };
      return {
        date,
        morningText: slot.morning.join('\n\n') || '---',
        afternoonText: slot.afternoon.join('\n\n') || '---',
      };
    });
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
      const start = String(row.startTime || '').slice(0, 5);
      const end = String(row.endTime || '').slice(0, 5);
      const timeRange = start && end ? `${start} - ${end}` : start || end || '';
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
      const hbText = [day.hbOfficer1, day.hbOfficer2, day.hbCommander].filter(Boolean).join('\n\n') || '---';
      return {
        date,
        nhaHieuBo: hbText,
        laiXe: day.driver || '---',
        benhXa: day.medic || '---',
        giamDoc: day.director || '---',
      };
    });
  };

  const buildUnifiedRowsByDay = (workRows, dutyRows, bounds) => {
    const dateList = getDateListByBounds(bounds);
    const byDate = new Map(dateList.map((date) => [date, []]));

    const ensureDayRows = (date) => {
      if (!byDate.has(date)) byDate.set(date, []);
      return byDate.get(date);
    };

    const formatDutyLabel = (item) => {
      if (item.location === 'Nhà hiệu bộ' && item.dutyRole === 'commander') return 'HB - Chỉ huy';
      if (item.location === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 1) return 'HB - Cán bộ 1';
      if (item.location === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 2) return 'HB - Cán bộ 2';
      return item.location || 'Trực ban';
    };

    const dutyByDate = new Map();
    for (const row of dutyRows || []) {
      const date = toDateOnly(row.date);
      if (!dutyByDate.has(date)) {
        dutyByDate.set(date, []);
      }
      dutyByDate.get(date).push(row);
    }

    for (const row of workRows || []) {
      const date = toDateOnly(row.date);
      if (!byDate.has(date)) byDate.set(date, []);
    }

    for (const date of Array.from(new Set([...byDate.keys(), ...dutyByDate.keys()])).sort()) {
      const dayRows = ensureDayRows(date);
      const dayDuties = [...(dutyByDate.get(date) || [])].sort((a, b) => {
        const slotA = Number(a.slotNo || 1);
        const slotB = Number(b.slotNo || 1);
        if (a.dutyType !== b.dutyType) return a.dutyType === 'director_weekly' ? -1 : 1;
        if (a.location !== b.location) {
          const order = { 'Nhà hiệu bộ': 1, 'Lái xe': 2, 'Bệnh xá': 3 };
          return (order[a.location] || 99) - (order[b.location] || 99);
        }
        return slotA - slotB;
      });

      const directorDuty = dayDuties.find((item) => item.dutyType === 'director_weekly');
      const officerDuties = dayDuties.filter((item) => item.dutyType !== 'director_weekly');

      dayRows.push({
        session: 'Sáng',
        time: '00:00',
        isDutyRow: true,
        content: [
          `Trực ban Giám đốc: ${directorDuty?.officerName || directorDuty?.officerId || 'Chưa phân công'}`,
          'Trực ban cán bộ:',
          ...(
            officerDuties.length > 0
              ? officerDuties.map((item) => `${formatDutyLabel(item)}: ${item.officerName || item.officerId || 'Chưa phân công'}`)
              : ['Chưa phân công']
          ),
        ],
      });

      const morningSchedules = (workRows || []).filter((row) => toDateOnly(row.date) === date && Number(String(row.startTime || '00:00').slice(0, 2)) < 12)
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
      morningSchedules.forEach((row) => {
        const start = String(row.startTime || '').slice(0, 5);
        const end = String(row.endTime || '').slice(0, 5);
        const timeRange = start && end ? `${start} - ${end}` : start || end || '';
        const location = row.location ? ` - ${row.location}` : '';
        const unit = row.unit ? ` - ${row.unit}` : '';
        dayRows.push({
          session: 'Sáng',
          time: timeRange,
          isDutyRow: false,
          content: [`${row.title || ''}${location}${unit}`],
        });
      });

      dayRows.push({
        session: 'Chiều',
        time: '',
        isDutyRow: false,
        content: [],
      });

      const afternoonSchedules = (workRows || []).filter((row) => toDateOnly(row.date) === date && Number(String(row.startTime || '00:00').slice(0, 2)) >= 12)
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
      afternoonSchedules.forEach((row) => {
        const start = String(row.startTime || '').slice(0, 5);
        const end = String(row.endTime || '').slice(0, 5);
        const timeRange = start && end ? `${start} - ${end}` : start || end || '';
        const location = row.location ? ` - ${row.location}` : '';
        const unit = row.unit ? ` - ${row.unit}` : '';
        dayRows.push({
          session: 'Chiều',
          time: timeRange,
          isDutyRow: false,
          content: [`${row.title || ''}${location}${unit}`],
        });
      });
    }

    return Array.from(new Set([...byDate.keys(), ...dutyByDate.keys()])).sort().map((date) => ({
      date,
      rows: byDate.get(date) || [],
    }));
  };

  const workPreviewRows = (exportType === 'trucban' ? [] : buildWorkRowsByDay(previewData.workSchedules || [], previewDateList));
  const dutyPreviewRows = (exportType === 'congtac' ? [] : buildDutyRowsByDay(previewData.dutySchedules || [], previewBounds));
  const unifiedPreviewRows = exportType === 'both'
    ? buildUnifiedRowsByDay(previewData.workSchedules || [], previewData.dutySchedules || [], previewBounds)
    : [];

  const renderPreviewCell = (value) => (
    <div className="whitespace-pre-line leading-5 text-slate-700">{value}</div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Xuất / In lịch</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Config panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Tùy chọn xuất</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Loại lịch</label>
                <div className="space-y-2">
                  {[{ v: 'congtac', l: 'Lịch sự kiện', icon: CalendarDays },
                    { v: 'trucban', l: 'Lịch trực ban', icon: Shield },
                    { v: 'both', l: 'Cả hai loại', icon: FileText }].map(o => (
                    <label key={o.v} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${exportType === o.v ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" name="exportType" value={o.v} checked={exportType === o.v} onChange={e => setExportType(e.target.value)} className="sr-only" />
                      <o.icon size={16} className={exportType === o.v ? 'text-blue-600' : 'text-slate-400'} />
                      <span className={`text-sm font-medium ${exportType === o.v ? 'text-blue-700' : 'text-slate-600'}`}>{o.l}</span>
                      {exportType === o.v && <Check size={14} className="text-blue-600 ml-auto" />}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Khoảng thời gian</label>
                <div className="space-y-2">
                  <select className="input-field text-sm" value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
                    <option value="week">Theo tuần</option>
                    <option value="month">Theo tháng</option>
                  </select>
                  {exportScope === 'week' ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setWeekStartDate((current) => shiftDateOnly(current, -7))}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow"
                          title="Tuần trước"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <div className="text-xs font-semibold text-slate-700 text-center">
                          {selectedWeekBounds
                            ? `${formatDateVN(selectedWeekBounds.startDate)} - ${formatDateVN(selectedWeekBounds.endDate)}`
                            : 'Không xác định được khoảng tuần'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setWeekStartDate((current) => shiftDateOnly(current, 7))}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow"
                          title="Tuần sau"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="month"
                      className="input-field text-sm"
                      value={monthValue}
                      onChange={(e) => setMonthValue(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Định dạng xuất</label>
                <div className="py-2 px-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 text-center">
                  PDF
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button onClick={handlePreview} className="w-full btn-secondary justify-center" disabled={loadingPreview}>
                  <Eye size={15} /> {loadingPreview ? 'Đang tạo...' : 'Xem trước'}
                </button>
                <button onClick={handleExport}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${exported ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'}`}>
                  {exported ? <><Check size={15} /> Đã xuất!</> : <><Download size={15} /> Tải xuống PDF</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2">
          <div className="card-lg min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">Xem trước tài liệu</h3>
              {previewReady && <span className="badge bg-emerald-100 text-emerald-600">✓ Sẵn sàng xuất</span>}
            </div>

            {!previewReady ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                  <FileText size={36} className="opacity-40" />
                </div>
                <p className="text-sm font-medium text-slate-500">Chưa có bản xem trước</p>
                <button onClick={handlePreview} className="btn-primary mt-4"><Eye size={14} /> Tạo bản xem trước</button>
              </div>
            ) : (
              <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                {/* PDF-like document preview */}
                <div className="bg-white mx-6 my-5 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#0d2240] to-[#1a4a8a] px-6 py-4 text-white text-center">
                    <div className="text-[11px] uppercase tracking-wider text-blue-200 mb-1">BỘ CÔNG AN – HỌC VIỆN KỸ THUẬT VÀ CÔNG NGHỆ AN NINH</div>
                    <div className="text-base font-bold">
                      {exportType === 'congtac' ? 'Lịch sự kiện' : exportType === 'trucban' ? 'LỊCH TRỰC BAN' : 'Lịch sự kiện & TRỰC BAN'}
                    </div>
                    <div className="text-xs text-blue-200 mt-1">{previewBounds ? `(${formatDateVN(previewBounds.startDate)} - ${formatDateVN(previewBounds.endDate)})` : '(Theo phạm vi được chọn)'}</div>
                  </div>
                  <div className="p-4 space-y-5">
                    {exportType === 'congtac' && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">Lịch sự kiện TUẦN</div>
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="w-[24%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">THỨ/NGÀY</th>
                              <th className="w-[38%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">SÁNG</th>
                              <th className="w-[38%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">CHIỀU</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workPreviewRows.map((row, i) => (
                              <tr key={`${row.date}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">
                                  <div className="font-semibold">{getWeekdayLabel(row.date)}</div>
                                  <div className="text-slate-400">{formatDateVN(row.date)}</div>
                                </td>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">{renderPreviewCell(row.morningText)}</td>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">{renderPreviewCell(row.afternoonText)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {exportType === 'trucban' && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">LỊCH TRỰC BAN</div>
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="w-[18%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">THỨ/NGÀY</th>
                              <th className="w-[22%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">NHÀ HIỆU BỘ</th>
                              <th className="w-[18%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">LÁI XE</th>
                              <th className="w-[18%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">BỆNH XÁ</th>
                              <th className="w-[24%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">TRỰC BAN GIÁM ĐỐC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dutyPreviewRows.map((row, i) => (
                              <tr key={`${row.date}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">
                                  <div className="font-semibold">{getWeekdayLabel(row.date)}</div>
                                  <div className="text-slate-400">{formatDateVN(row.date)}</div>
                                </td>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">{renderPreviewCell(row.nhaHieuBo)}</td>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">{renderPreviewCell(row.laiXe)}</td>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">{renderPreviewCell(row.benhXa)}</td>
                                <td className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">{renderPreviewCell(row.giamDoc)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {exportType === 'both' && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">Lịch sự kiện & TRỰC BAN TUẦN</div>
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="w-[24%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">THỨ/NGÀY</th>
                              <th className="w-[12%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">BUỔI</th>
                              <th className="w-[16%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">GIỜ</th>
                              <th className="w-[48%] text-left py-2 px-2 font-semibold text-slate-600 border-b border-slate-200">CHI TIẾT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unifiedPreviewRows.map((day, dayIndex) => {
                              const rows = day.rows || [];
                              return rows.map((row, rowIndex) => {
                                const isFirstRow = rowIndex === 0;
                                const baseBorder = 'border-b border-slate-100';
                                return (
                                  <tr key={`${day.date}-${rowIndex}`} className={dayIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                    {isFirstRow && (
                                      <td rowSpan={rows.length} className="py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line">
                                        <div className="font-semibold">{getWeekdayLabel(day.date)}</div>
                                        <div className="text-slate-400">{formatDateVN(day.date)}</div>
                                      </td>
                                    )}
                                    <td className={`py-2 px-2 text-slate-700 border-b border-slate-100 align-top ${baseBorder}`}>{row.session || ''}</td>
                                    <td className={`py-2 px-2 text-slate-700 border-b border-slate-100 align-top ${baseBorder}`}>{row.time || ''}</td>
                                    <td className={`py-2 px-2 text-slate-700 border-b border-slate-100 align-top whitespace-pre-line ${baseBorder}`}>
                                      {renderPreviewCell((row.content || []).join('\n'))}
                                    </td>
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                      <span>Ngày in: {new Date().toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent exports */}
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Lịch sử xuất file gần đây</h3>
        <div className="space-y-2">
          {xuatLichHistory.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
              <div className="w-9 h-9 rounded-xl text-red-600 bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{`lich_${file.exportType}_${file.exportScope}.${file.exportFormat}`}</div>
                <div className="text-xs text-slate-400">{file.itemCount} mục · {new Date(file.createdAt).toLocaleString('vi-VN')}</div>
              </div>
              <button className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                <Download size={15} />
              </button>
            </div>
          ))}
          {xuatLichHistory.length === 0 && (
            <div className="text-sm text-slate-400">Chưa có lịch sử xuất.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default XuatLich;
