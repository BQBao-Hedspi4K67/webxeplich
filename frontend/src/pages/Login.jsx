import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
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
  const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
  const formatted = date.toLocaleDateString('vi-VN', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatDisplayTime = (timeValue) => {
  const time = String(timeValue || '');
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  return time === '00:00' ? '12:00' : time;
};

const toTimeOnly = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 5);
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
});

const buildSlotLabel = (item) => {
  if (item.viTri === 'Nhà hiệu bộ' && item.dutyRole === 'commander') return 'HB - Chỉ huy';
  if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 1) return 'HB - Cán bộ 1';
  if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 2) return 'HB - Cán bộ 2';
  return item.viTri || 'Trực ban';
};

const buildTodayRows = (dutyItems = [], scheduleItems = []) => {
  const sortedDutyItems = [...dutyItems].sort((a, b) => {
    const slotA = Number(a.slotNo || 1);
    const slotB = Number(b.slotNo || 1);
    if (a.kieuTruc !== b.kieuTruc) return a.kieuTruc === 'giamdoc' ? -1 : 1;
    if (a.viTri !== b.viTri) {
      const order = { 'Nhà hiệu bộ': 1, 'Lái xe': 2, 'Bệnh xá': 3, 'Trực ban Giám đốc': 0 };
      return (order[a.viTri] || 99) - (order[b.viTri] || 99);
    }
    return slotA - slotB;
  });

  const directorDuty = sortedDutyItems.find((item) => item.kieuTruc === 'giamdoc');
  const canboDuties = sortedDutyItems.filter((item) => item.kieuTruc === 'canbo');

  const morningSchedules = [...scheduleItems]
    .filter((evt) => {
      const hour = parseInt(String(evt.gioBatDau || '00:00').split(':')[0]);
      return hour < 12;
    })
    .sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || '')));

  const afternoonSchedules = [...scheduleItems]
    .filter((evt) => {
      const hour = parseInt(String(evt.gioBatDau || '00:00').split(':')[0]);
      return hour >= 12;
    })
    .sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || '')));

  const rows = [
    {
      isFirstRow: true,
      session: 'Sáng',
      time: '00:00',
      isDutyRow: true,
      content: [
        `Trực ban Giám đốc: ${directorDuty?.tenCanBo || 'Chưa phân công'}`,
        'Trực ban cán bộ:',
        ...(canboDuties.length > 0
          ? canboDuties.map((item) => `${buildSlotLabel(item)}: ${item.tenCanBo || 'Chưa phân công'}`)
          : ['Chưa phân công']),
      ],
    },
  ];

  morningSchedules.forEach((sch) => {
    rows.push({
      isFirstRow: false,
      session: 'Sáng',
      time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
      isDutyRow: false,
      schedules: [sch],
    });
  });

  rows.push({
    isFirstRow: false,
    session: 'Chiều',
    time: '',
    isDutyRow: false,
    schedules: [],
  });

  afternoonSchedules.forEach((sch) => {
    rows.push({
      isFirstRow: false,
      session: 'Chiều',
      time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
      isDutyRow: false,
      schedules: [sch],
    });
  });

  return rows;
};

const Login = ({ onLogin }) => {
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Today's schedule
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [todayDuties, setTodayDuties] = useState([]);
  const [todayHoliday, setTodayHoliday] = useState(null);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  // Fetch today's schedules and duties
  useEffect(() => {
    const fetchTodaySchedules = async () => {
      try {
        const today = formatLocalDate(new Date());
        
        // Fetch work schedules for today
        const schedulesRes = await apiClient.workSchedules.list(1, 100, { 
          startDate: today, 
          endDate: today 
        });
        setTodaySchedules((schedulesRes?.data || []).map((evt) => ({
          id: evt.id,
          tieuDe: evt.title || evt.tieuDe || '',
          ngay: evt.date || evt.ngay || today,
          gioBatDau: toTimeOnly(evt.startTime || evt.gioBatDau),
          gioKetThuc: toTimeOnly(evt.endTime || evt.gioKetThuc),
          diaDiem: evt.location || evt.diaDiem || '',
          donVi: evt.departmentName || evt.department || evt.donVi || '',
        })));
        
        // Fetch duty schedules for today
        const dutiesRes = await apiClient.dutySchedules.list(1, 100, { 
          startDate: today, 
          endDate: today 
        });
        setTodayDuties((dutiesRes?.data || []).map((duty) => normalizeDutyItem({
          ...duty,
          officerName: duty.officerName || duty.officerId || '',
          location: duty.location || duty.viTri || '',
        })));
        
        // Fetch holidays
        try {
          const holidaysRes = await apiClient.holidays.list({ year: new Date().getFullYear() });
          const holiday = (holidaysRes?.data || []).find((h) => (h.holidayDate || h.ngay) === today);
          setTodayHoliday(holiday);
        } catch (err) {
          // Ignore holiday fetch error
        }
      } catch (err) {
        console.error('Error fetching schedules:', err);
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchTodaySchedules();
  }, []);

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
    } catch (err) {
      setError(err?.message || 'Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0d2240] to-[#0a1628] relative overflow-hidden p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-blue-800/15 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Main content */}
      <div className="w-full max-w-6xl relative z-10">
        {/* Logo and title */}
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
          <img src={logoSchool} alt="Logo" className="w-16 h-16 drop-shadow-lg" />
          <div>
            <h1 className="text-white font-bold text-xl leading-snug">Học viện Kỹ thuật</h1>
            <h1 className="text-white font-bold text-xl leading-snug">và Công nghệ An ninh</h1>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule Preview - Left side (desktop) / Top (mobile) */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-6">
                Lịch công tác hôm nay - {formatDDMM(new Date())}
                {todayHoliday && <span className="text-red-300 text-sm ml-2">({todayHoliday.ten})</span>}
              </h2>
              
              {loadingSchedules ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b-2 border-white/20 bg-white/5">
                        <th className="px-4 py-3 text-left font-bold text-white/85 w-[24%]">Ngày/Tháng/Năm</th>
                        <th className="px-4 py-3 text-left font-bold text-white/85 w-[12%]">Buổi</th>
                        <th className="px-4 py-3 text-left font-bold text-white/85 w-[16%]">Giờ</th>
                        <th className="px-4 py-3 text-left font-bold text-white/85 w-[48%]">Chi tiết nội dung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const dayRows = buildTodayRows(todayDuties, todaySchedules);
                        const dateLabel = formatDateWithDay(new Date());

                        return dayRows.map((row, rowIdx) => {
                          const isDutyRow = row.isDutyRow;
                          const details = isDutyRow
                            ? row.content || []
                            : row.schedules?.length > 0
                              ? row.schedules.map((sch) => {
                                const timeLabel = sch.gioBatDau || sch.gioKetThuc ? `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}` : '';
                                const content = [sch.tieuDe, sch.diaDiem, sch.donVi].filter(Boolean).join(' - ');
                                return timeLabel ? `${timeLabel} | ${content}` : content;
                              })
                              : [];

                          return (
                            <tr key={`today-${rowIdx}`} className="border-b border-white/10 bg-white/[0.03] hover:bg-white/5 transition-colors">
                              {rowIdx === 0 && (
                                <td rowSpan={dayRows.length} className="px-4 py-3 bg-white/5 font-bold text-white align-top border-r border-white/10">
                                  <div>{dateLabel}</div>
                                  {todayHoliday && <div className="text-[10px] text-red-300 mt-0.5">{todayHoliday.ten || todayHoliday.holidayName}</div>}
                                </td>
                              )}
                              <td className="px-4 py-3 text-center align-top text-white border-r border-white/10">{row.session}</td>
                              <td className="px-4 py-3 text-slate-300 text-[10px] align-top border-r border-white/10">{row.time || ''}</td>
                              <td className="px-4 py-3 align-top text-white/90 leading-6">
                                {isDutyRow ? (
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
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Login Form - Right side (desktop) / Bottom (mobile) */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white text-center">Đăng nhập</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Tên đăng nhập</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/15 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-800/50 border border-white/15 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember checkbox */}
            <label className="flex items-center gap-2 cursor-pointer group pt-1">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${form.remember ? 'bg-blue-600 border-blue-600' : 'border-slate-500 group-hover:border-slate-400'}`}
                onClick={() => setForm({ ...form, remember: !form.remember })}>
                {form.remember && <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-white rotate-45 mb-0.5" />}
              </div>
              <span className="text-sm text-slate-400">Ghi nhớ đăng nhập</span>
            </label>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-lg mt-4">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                <span className="text-sm text-red-300">{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-blue-800 disabled:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg shadow-blue-900/40 hover:shadow-blue-800/50 active:translate-y-0 mt-6">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang xác thực...</span></>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 Học viện Kỹ thuật và Công nghệ An ninh
        </p>
      </div>
    </div>
  );
};

export default Login;
