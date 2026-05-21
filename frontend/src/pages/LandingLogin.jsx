import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Printer, User, X } from 'lucide-react';
import apiClient from '../services/api';
import XuatLich from '../components/XuatLich/XuatLich';
import logoSchool from '../assets/logo.png';

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDDMM = (date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatDateWithDay = (date) => {
  const formatted = date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatDisplayTime = (timeValue) => {
  const time = String(timeValue || '');
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  return time === '00:00' ? '12:00' : time;
};

const getSessionBucket = (timeValue) => {
  const hour = Number.parseInt(String(timeValue || '00:00').split(':')[0], 10);
  if (Number.isNaN(hour) || hour < 8) return 'night';
  if (hour < 16) return 'morning';
  return 'afternoon';
};

const SESSION_LABELS = {
  morning: 'Sáng\n(08:00-16:00)',
  afternoon: 'Chiều\n(16:00-24:00)',
};

const toTimeOnly = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 5);
};

const getWeekStart = (offset = 0) => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getIsoWeekNo = (date) => {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 4 - (target.getDay() || 7));
  const yearStart = new Date(target.getFullYear(), 0, 1);
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
};

const normalizeDutyItem = (duty) => ({
  id: duty.id,
  kieuTruc: duty.dutyType === 'director_weekly' ? 'giamdoc' : 'canbo',
  tenCanBo: duty.officerName || duty.officerId || '',
  viTri: duty.location || '',
  dutyRole: duty.dutyRole || 'officer',
  slotNo: Number(duty.slotNo || 1),
  dutyType: duty.dutyType || '',
  ngay: duty.date || '',
  denNgay: duty.endDate || duty.denNgay || '',
});

const buildSlotLabel = (item) => {
  if (item.viTri === 'Nhà hiệu bộ' && item.dutyRole === 'commander') return 'TB - Chỉ huy';
  if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 1) return 'TB - Cán bộ 1';
  if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 2) return 'TB - Cán bộ 2';
  return item.viTri || 'Trực ban';
};

const buildRowsForDay = (dutyItems = [], scheduleItems = []) => {
  const sortedDutyItems = [...dutyItems].sort((a, b) => {
    const slotA = Number(a.slotNo || 1);
    const slotB = Number(b.slotNo || 1);
    if (a.kieuTruc !== b.kieuTruc) return a.kieuTruc === 'giamdoc' ? -1 : 1;
    // Prefer commander among canbo duties
    if (a.kieuTruc === 'canbo' && b.kieuTruc === 'canbo') {
      const aIsCommander = (a.vaiTroTruc || a.dutyRole || '') === 'commander';
      const bIsCommander = (b.vaiTroTruc || b.dutyRole || '') === 'commander';
      if (aIsCommander !== bIsCommander) return aIsCommander ? -1 : 1;
    }
    if (a.viTri !== b.viTri) {
      const order = { 'Trực ban Giám đốc': 0, 'Nhà hiệu bộ': 1, 'Lái xe': 2, 'Bệnh xá': 3 };
      return (order[a.viTri] || 99) - (order[b.viTri] || 99);
    }
    return slotA - slotB;
  });

  const directorDuty = sortedDutyItems.find((item) => item.kieuTruc === 'giamdoc');
  const canboDuties = sortedDutyItems.filter((item) => item.kieuTruc === 'canbo');

  const groupedSchedules = {
    night: [...scheduleItems].filter((evt) => getSessionBucket(evt.gioBatDau) === 'night').sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || ''))),
    morning: [...scheduleItems].filter((evt) => getSessionBucket(evt.gioBatDau) === 'morning').sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || ''))),
    afternoon: [...scheduleItems].filter((evt) => getSessionBucket(evt.gioBatDau) === 'afternoon').sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || ''))),
  };

  const dutyLines = [
    'Trực ban Giám đốc: ' + (directorDuty?.tenCanBo || 'Chưa phân công'),
    'Trực ban cán bộ:',
    ...(canboDuties.length > 0
      ? canboDuties.map((item) => buildSlotLabel(item) + ': ' + (item.tenCanBo || 'Chưa phân công'))
      : ['Chưa phân công']),
  ];

  const rows = [];

  if (groupedSchedules.morning.length > 0) {
    groupedSchedules.morning.forEach((sch, idx) => {
      rows.push({
        isDutyRow: false,
        session: idx === 0 ? SESSION_LABELS.morning : '',
        time: formatDisplayTime(sch.gioBatDau) + ' - ' + formatDisplayTime(sch.gioKetThuc),
        schedules: [sch],
      });
    });
  } else {
    rows.push({ isDutyRow: false, session: SESSION_LABELS.morning, time: '', schedules: [] });
  }

  if (groupedSchedules.afternoon.length > 0) {
    groupedSchedules.afternoon.forEach((sch, idx) => {
      rows.push({
        isDutyRow: false,
        session: idx === 0 ? SESSION_LABELS.afternoon : '',
        time: formatDisplayTime(sch.gioBatDau) + ' - ' + formatDisplayTime(sch.gioKetThuc),
        schedules: [sch],
      });
    });
  } else {
    rows.push({ isDutyRow: false, session: SESSION_LABELS.afternoon, time: '', schedules: [] });
  }

  groupedSchedules.night.forEach((sch) => {
    rows.push({
      isDutyRow: false,
      session: '',
      time: formatDisplayTime(sch.gioBatDau) + ' - ' + formatDisplayTime(sch.gioKetThuc),
      schedules: [sch],
    });
  });

  return { rows, dutyLines };
};
const getBoardMemberLine = (participants) => {
  const labels = participants?.boardMemberLabels;
  if (!Array.isArray(labels) || !labels.length) return '';
  return `Ban giám đốc: ${labels.join(', ')}`;
};

const buildScheduleDetails = (schedule) => {
  const details = [schedule.tieuDe, schedule.diaDiem].filter(Boolean);
  const boardMemberLine = getBoardMemberLine(schedule.participants);
  const units = String(schedule.donVi || '')
    .split(',')
    .map((unit) => unit.trim())
    .filter(Boolean);
  const filteredUnits = boardMemberLine
    ? units.filter((unit) => unit.toLowerCase() !== 'ban giám đốc')
    : units;
  const participantLine = boardMemberLine
    ? [boardMemberLine, ...filteredUnits].join(', ')
    : filteredUnits.join(', ');
  if (participantLine) details.push(participantLine);
  return details;
};

const ROLE_LABELS_TO_BOLD = new Set([
  'Trực ban Giám đốc',
  'Trực ban cán bộ',
  'TB - Chỉ huy',
  'TB - Cán bộ 1',
  'TB - Cán bộ 2',
  'Lái xe',
  'Bệnh xá',
]);

const LandingLogin = ({ onLogin }) => {
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [weekSchedules, setWeekSchedules] = useState([]);
  const [weekDuties, setWeekDuties] = useState([]);
  const [holidayMap, setHolidayMap] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);

  const weekStart = useMemo(() => getWeekStart(weekOffset), [weekOffset]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return formatLocalDate(d);
  }), [weekStart]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 6);
    return d;
  }, [weekStart]);
  const weekLabel = `Tuần ${getIsoWeekNo(weekStart)} (${formatDDMM(weekStart)} - ${formatDDMM(weekEnd)}/${weekEnd.getFullYear()})`;
  const todayStr = formatLocalDate(new Date());

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowLoginModal(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!weekDates.includes(selectedDate)) {
      setSelectedDate(weekOffset === 0 ? todayStr : weekDates[0]);
    }
  }, [selectedDate, weekDates, weekOffset, todayStr]);

  useEffect(() => {
    const fetchWeeklyData = async () => {
      setLoadingSchedules(true);
      try {
        const [workRes, dutyRes, holidaysRes] = await Promise.all([
          apiClient.workSchedules.list(1, 200, { startDate: weekDates[0], endDate: weekDates[6] }),
          apiClient.dutySchedules.list(1, 200, { startDate: weekDates[0], endDate: weekDates[6] }),
          apiClient.holidays.list({ year: new Date(weekDates[0]).getFullYear() }),
        ]);

        setWeekSchedules((workRes?.data || []).map((evt) => ({
          id: evt.id,
          tieuDe: evt.title || evt.tieuDe || '',
          ngay: evt.date || evt.ngay || weekDates[0],
          gioBatDau: toTimeOnly(evt.startTime || evt.gioBatDau),
          gioKetThuc: toTimeOnly(evt.endTime || evt.gioKetThuc),
          diaDiem: evt.location || evt.diaDiem || '',
          donVi: evt.departmentName || evt.department || evt.donVi || '',
          participants: (() => {
            const participants = evt.participants;
            if (!participants) return { units: [], boardMembers: [], boardMemberLabels: [] };
            if (typeof participants === 'string') {
              try {
                return JSON.parse(participants);
              } catch {
                return { units: [], boardMembers: [], boardMemberLabels: [] };
              }
            }
            return participants;
          })(),
        })));

        setWeekDuties((dutyRes?.data || []).map((duty) => normalizeDutyItem({
          ...duty,
          officerName: duty.officerName || duty.officerId || '',
          location: duty.location || duty.viTri || '',
        })));

        const holidays = (holidaysRes?.data || []).reduce((acc, item) => {
          const date = item.holidayDate || item.ngay;
          if (date) acc[date] = item.ten || item.holidayName || '';
          return acc;
        }, {});
        setHolidayMap(holidays);
      } catch (err) {
        console.error('Error fetching schedules:', err);
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchWeeklyData();
  }, [weekDates]);

  const selectedSchedules = weekSchedules.filter((item) => item.ngay === selectedDate);
  const selectedDuties = weekDuties.filter((item) => {
    // Director weekly: check if selectedDate is within duty date range
    if (item.kieuTruc === 'giamdoc' && item.denNgay) {
      return item.ngay <= selectedDate && selectedDate <= item.denNgay;
    }
    // Officer daily: exact match
    return item.ngay === selectedDate;
  });
  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
  const dayLabel = selectedDateObj.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const selectedHoliday = holidayMap[selectedDate];
  const { rows: dayRows, dutyLines } = buildRowsForDay(selectedDuties, selectedSchedules);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.auth.login(form.username, form.password);
      const token = response?.data?.token;
      const profile = response?.data?.user;

      if (!token || !profile) {
        throw new Error('Đăng nhập thất bại. Dữ liệu phản hồi không hợp lệ.');
      }

      apiClient.setAuthToken(token);
      onLogin(profile);
      setShowLoginModal(false);
    } catch (err) {
      setError(err?.message || 'Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 relative">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `url(${logoSchool})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '240px 240px',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative z-10 h-full px-4 sm:px-6 lg:px-8 py-2 flex flex-col overflow-hidden">
        {/* Header: Centered title + Login button top-right */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all font-semibold flex items-center gap-2"
            >
              <Printer size={16} />
              Xuất / In lịch
            </button>
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 transition-all font-semibold"
            >
              Đăng nhập
            </button>
          </div>
        </div>

        {/* Centered Title Section */}
        <div className="text-center mb-4 -mt-10">
  <div className="flex items-center justify-center mb-1">
    <img 
      src={logoSchool} 
      alt="Logo" 
      className="w-12 h-12 drop-shadow-md"
    />
  </div>

  <h3 className="text-base font-semibold text-slate-900 mb-1">
    Hệ thống quản lý lịch
  </h3>

  <p className="text-xs text-slate-600">
    Học viện Kỹ thuật và Công nghệ An ninh
  </p>
</div>



        {/* Centered Main Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex justify-center">
          <div className="w-full max-w-5xl bg-gray-50 rounded-2xl border border-gray-300 p-4 sm:p-5 shadow-lg min-h-0 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              {selectedHoliday && <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-300">{selectedHoliday}</span>}
            </div>

            <div className="flex items-center justify-between gap-2 mb-3 -mt-3">
              <button
                onClick={() => setWeekOffset((offset) => offset - 1)}
                className="px-3 py-2 rounded-xl bg-gray-200 border border-gray-300 text-slate-900 hover:bg-gray-300 transition-all"
              >
                &lt;
              </button>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-900">{weekLabel}</div>
                <div className="text-[11px] text-slate-600"></div>
              </div>
              <button
                onClick={() => setWeekOffset((offset) => offset + 1)}
                className="px-3 py-2 rounded-xl bg-gray-200 border border-gray-300 text-slate-900 hover:bg-gray-300 transition-all"
              >
                &gt;
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {weekDates.map((date, index) => {
                const buttonLabel = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index];
                const isActive = date === selectedDate;
                const isToday = date === todayStr;
                const isWeekend = index >= 5;
                const isHoliday = Boolean(holidayMap && holidayMap[date]);
                const labelClass = isWeekend || isHoliday ? 'text-red-600' : 'text-slate-900';
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`rounded-xl px-2 py-2 text-sm font-semibold transition-all border ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-gray-200 border-gray-300 hover:bg-gray-300'} ${isToday && !isActive ? 'ring-1 ring-blue-400' : ''}`}
                  >
                    <div className={labelClass}>{buttonLabel}</div>
                    <div className={`text-[11px] font-medium mt-0.5 opacity-80 ${labelClass}`}>{date.slice(8, 10)}/{date.slice(5, 7)}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-300 bg-white">
              <div className="px-4 py-3 border-b border-gray-300 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">Lịch công tác {selectedDate === todayStr ? 'hôm nay' : 'ngày đã chọn'} - {selectedDate.slice(8, 10)}/{selectedDate.slice(5, 7)}</div>
                  
                </div>
                
              </div>

              <div className="max-h-[calc(100vh-310px)] overflow-y-auto overflow-x-auto pb-16">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-100">
                      <th className="px-4 py-3 text-left font-bold text-slate-900 w-[36%]">Danh sách trực</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-900 w-[14%]">Buổi</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-900  w-[12%]">Giờ</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-900 w-[38%]">Chi tiết nội dung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSchedules ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-slate-600">Đang tải lịch công tác...</td>
                      </tr>
                    ) : dayRows.map((row, rowIdx) => {
                      const details = row.isDutyRow
                        ? row.content || []
                        : row.schedules?.length > 0
                          ? row.schedules.flatMap((sch) => buildScheduleDetails(sch))
                          : [];

                      return (
                        <tr key={`today-${rowIdx}`} className="border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                          {rowIdx === 0 && (
                            <td rowSpan={dayRows.length} className="px-4 py-3 bg-white text-slate-900 align-top border-r border-gray-300 whitespace-pre-line">
                              {dutyLines.map((line, index) => {
                                const colonIdx = line.indexOf(':');
                                const rawLabel = colonIdx !== -1 ? line.slice(0, colonIdx).trim() : line.trim();
                                const labelWithColon = colonIdx !== -1 ? line.slice(0, colonIdx + 1) : rawLabel;
                                const rest = colonIdx !== -1 ? line.slice(colonIdx + 1).trim() : '';
                                const shouldBold = ROLE_LABELS_TO_BOLD.has(rawLabel) || rawLabel.startsWith('TB -');
                                return (
                                  <div key={index} className={index === 0 ? 'text-slate-900' : 'text-slate-700'}>
                                    <span className={shouldBold ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}>{labelWithColon}</span>
                                    {rest ? <span className="ml-1 text-slate-700">{rest}</span> : null}
                                  </div>
                                );
                              })}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center align-top text-slate-900 border-r border-gray-200 whitespace-pre-line">{row.session || ''}</td>
                          <td className="px-4 py-3 text-slate-600 text-[10px] align-top border-r border-gray-200">{row.time || ''}</td>
                          <td className="px-4 py-3 align-top text-slate-700 leading-6">
                            {row.isDutyRow ? (
                              <div className="space-y-0.5">
                                {details.map((line, lineIdx) => (
                                  <div key={lineIdx} className={lineIdx === 0 || lineIdx === 1 ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            ) : details.length > 0 ? (
                              <div className="space-y-1">
                                {details.map((line, lineIdx) => (
                                  <div key={lineIdx} className={lineIdx === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}>{line}</div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-slate-400">—</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-gray-300 bg-white shadow-xl overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Đăng nhập hệ thống</h2>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-600 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Tên đăng nhập</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Mật khẩu</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-2.5 bg-white border border-gray-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer group pt-1">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${form.remember ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-slate-400'}`}
                  onClick={() => setForm({ ...form, remember: !form.remember })}
                >
                  {form.remember && <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-white rotate-45 mb-0.5" />}
                </div>
                <span className="text-sm text-slate-600">Ghi nhớ đăng nhập</span>
              </label>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-100 border border-red-300 rounded-lg mt-2">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full flex-shrink-0" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/30"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang xác thực...</span></>
                ) : (
                  <span>Đăng nhập</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Xuất / In lịch</h2>
                <p className="text-xs text-slate-500">Chọn loại lịch, xem trước và tải PDF.</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-600 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <XuatLich xuatLichHistory={[]} variant="modal" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingLogin;
