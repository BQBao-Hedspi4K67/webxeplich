import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, User, X } from 'lucide-react';
import apiClient from '../services/api';
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
  night: 'Danh sách trực',
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

  const rows = [];

  // Always add morning section (even if empty)
  if (groupedSchedules.morning.length > 0) {
    groupedSchedules.morning.forEach((sch, idx) => {
      rows.push({
        isDutyRow: false,
        session: idx === 0 ? SESSION_LABELS.morning : '',
        time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
        schedules: [sch],
      });
    });
  } else {
    rows.push({ isDutyRow: false, session: SESSION_LABELS.morning, time: '', schedules: [] });
  }

  // Always add afternoon section (even if empty)
  if (groupedSchedules.afternoon.length > 0) {
    groupedSchedules.afternoon.forEach((sch, idx) => {
      rows.push({
        isDutyRow: false,
        session: idx === 0 ? SESSION_LABELS.afternoon : '',
        time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
        schedules: [sch],
      });
    });
  } else {
    rows.push({ isDutyRow: false, session: SESSION_LABELS.afternoon, time: '', schedules: [] });
  }

  rows.push({
    isDutyRow: true,
    session: SESSION_LABELS.night,
    time: '',
    content: [
      `Trực ban Giám đốc: ${directorDuty?.tenCanBo || 'Chưa phân công'}`,
      'Trực ban cán bộ:',
      ...(canboDuties.length > 0
        ? canboDuties.map((item) => `${buildSlotLabel(item)}: ${item.tenCanBo || 'Chưa phân công'}`)
        : ['Chưa phân công']),
    ],
  });

  // Add night schedules
  groupedSchedules.night.forEach((sch) => {
    rows.push({
      isDutyRow: false,
      session: '',
      time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
      schedules: [sch],
    });
  });

  return rows;
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
  const dayRows = buildRowsForDay(selectedDuties, selectedSchedules);

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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#07111f] via-[#0b1b33] to-[#07111f] relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-blue-800/15 rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
      </div>

      <div className="relative z-10 h-full px-4 sm:px-6 lg:px-8 py-2 flex flex-col overflow-hidden">
        {/* Header: Centered title + Login button top-right */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div />
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-all font-semibold"
          >
            Đăng nhập
          </button>
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

  <h3 className="text-base font-semibold text-white mb-1">
    Hệ thống quản lý lịch
  </h3>

  <p className="text-xs text-slate-300">
    Học viện Kỹ thuật và Công nghệ An ninh
  </p>
</div>



        {/* Centered Main Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex justify-center">
          <div className="w-full max-w-5xl bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 p-4 sm:p-5 shadow-2xl min-h-0 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              {selectedHoliday && <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-200 border border-red-400/20">{selectedHoliday}</span>}
            </div>

            <div className="flex items-center justify-between gap-2 mb-3 -mt-3">
              <button
                onClick={() => setWeekOffset((offset) => offset - 1)}
                className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all"
              >
                &lt;
              </button>
              <div className="text-center">
                <div className="text-sm font-bold text-white">{weekLabel}</div>
                <div className="text-[11px] text-white/55"></div>
              </div>
              <button
                onClick={() => setWeekOffset((offset) => offset + 1)}
                className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all"
              >
                &gt;
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {weekDates.map((date, index) => {
                const buttonLabel = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index];
                const isActive = date === selectedDate;
                const isToday = date === todayStr;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`rounded-xl px-2 py-2 text-sm font-semibold transition-all border ${isActive ? 'bg-blue-500 text-white border-blue-400 shadow-lg' : 'bg-white/8 text-white/85 border-white/10 hover:bg-white/12'} ${isToday && !isActive ? 'ring-1 ring-cyan-300/50' : ''}`}
                  >
                    <div>{buttonLabel}</div>
                    <div className="text-[11px] font-medium mt-0.5 opacity-80">{date.slice(8, 10)}/{date.slice(5, 7)}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-white/10 bg-black/10">
              <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white">Lịch công tác {selectedDate === todayStr ? 'hôm nay' : 'ngày đã chọn'} - {selectedDate.slice(8, 10)}/{selectedDate.slice(5, 7)}</div>
                  
                </div>
                
              </div>

              <div className="max-h-[calc(100vh-310px)] overflow-y-auto overflow-x-auto pb-16">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b-2 border-white/15 bg-white/5">
                      <th className="px-4 py-3 text-left font-bold text-white/85 w-[24%]">Ngày/Tháng/Năm</th>
                      <th className="px-4 py-3 text-left font-bold text-white/85 w-[12%]">Buổi</th>
                      <th className="px-4 py-3 text-left font-bold text-white/85 w-[16%]">Giờ</th>
                      <th className="px-4 py-3 text-left font-bold text-white/85 w-[48%]">Chi tiết nội dung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSchedules ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-white/70">Đang tải lịch công tác...</td>
                      </tr>
                    ) : dayRows.map((row, rowIdx) => {
                      const details = row.isDutyRow
                        ? row.content || []
                        : row.schedules?.length > 0
                          ? row.schedules.flatMap((sch) => buildScheduleDetails(sch))
                          : [];

                      return (
                        <tr key={`today-${rowIdx}`} className="border-b border-white/10 bg-white/[0.03] hover:bg-white/5 transition-colors">
                          {rowIdx === 0 && (
                            <td rowSpan={dayRows.length} className="px-4 py-3 bg-white/5 font-bold text-white align-top border-r border-white/10">
                              <div>{formatDateWithDay(selectedDateObj)}</div>
                              {selectedHoliday && <div className="text-[10px] text-red-300 mt-0.5">{selectedHoliday}</div>}
                            </td>
                          )}
                              <td className="px-4 py-3 text-center align-top text-white border-r border-white/10 whitespace-pre-line">{row.session || ''}</td>
                          <td className="px-4 py-3 text-slate-300 text-[10px] align-top border-r border-white/10">{row.time || ''}</td>
                          <td className="px-4 py-3 align-top text-white/90 leading-6">
                            {row.isDutyRow ? (
                              <div className="space-y-0.5">
                                {details.map((line, lineIdx) => (
                                  <div key={lineIdx} className={lineIdx === 0 || lineIdx === 1 ? 'font-semibold text-white' : 'text-white/90'}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            ) : details.length > 0 ? (
                              <div className="space-y-1">
                                {details.map((line, lineIdx) => (
                                  <div key={lineIdx}>{line}</div>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1f39] shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Đăng nhập hệ thống</h2>
                
              </div>
              <button onClick={() => setShowLoginModal(false)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Tên đăng nhập</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border border-white/15 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Mật khẩu</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-800/70 border border-white/15 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer group pt-1">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${form.remember ? 'bg-blue-600 border-blue-600' : 'border-slate-500 group-hover:border-slate-400'}`}
                  onClick={() => setForm({ ...form, remember: !form.remember })}
                >
                  {form.remember && <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-white rotate-45 mb-0.5" />}
                </div>
                <span className="text-sm text-slate-300">Ghi nhớ đăng nhập</span>
              </label>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-lg mt-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-blue-800 disabled:to-blue-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/40"
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
    </div>
  );
};

export default LandingLogin;
