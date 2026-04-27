import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, CalendarDays, ClipboardList, AlertCircle,
  TrendingUp, ArrowUpRight, Clock, MapPin, User, ChevronLeft, ChevronRight, Mail, Phone
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { LOAI_LICH_COLORS } from '../../data/uiConstants';

const StatCard = ({ icon: Icon, title, value, sub, color, trend }) => (
  <div className="card group hover:-translate-y-0.5 hover:shadow-card-lg transition-all duration-300 animate-fade-in-up">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      {trend && (
        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg">
          <TrendingUp size={11} className="text-emerald-500" />
          <span className="text-[10px] font-semibold text-emerald-600">{trend}</span>
        </div>
      )}
    </div>
    <div className="text-2xl font-extrabold text-slate-800 mb-0.5">{value}</div>
    <div className="text-sm font-semibold text-slate-600">{title}</div>
    {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card-lg p-3">
        <p className="text-xs font-bold text-slate-600 mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-slate-500">{p.name}: </span>
            <span className="text-xs font-bold text-slate-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard = ({
  onNavigate,
  canBoData = [],
  lichCongTacData = [],
  lichTrucBanData = [],
  holidayData = [],
  thongBaoData = [],
  thongKeTheoThang = [],
  hoatDongGanDay = [],
}) => {
  const OFFICERS_PER_PAGE = 10;
  const [officerPage, setOfficerPage] = useState(1);

  const HOLIDAYS = holidayData.reduce((acc, h) => {
    if (h?.ngay) acc[h.ngay] = h.ten;
    return acc;
  }, {});
  // Format local date to YYYY-MM-DD (not UTC)
  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const d_str = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${d_str}`;
  };
  
  const today = toDateStr(new Date());
  const todayEvents = lichCongTacData.filter(l => l.ngay === today);
  const todayDuty = lichTrucBanData.filter(l => {
    if (l.kieuTruc === 'canbo') return l.ngay === today;
    return l.kieuTruc === 'giamdoc' && l.ngay <= today && (l.denNgay || l.ngay) >= today;
  });
  const todayDutySorted = [...todayDuty].sort((a, b) => {
    const byLocation = String(a.viTri || '').localeCompare(String(b.viTri || ''));
    if (byLocation !== 0) return byLocation;

    const roleOrderA = a.vaiTroTruc === 'commander' ? 0 : 1;
    const roleOrderB = b.vaiTroTruc === 'commander' ? 0 : 1;
    if (roleOrderA !== roleOrderB) return roleOrderA - roleOrderB;

    return Number(a.slotNo || 1) - Number(b.slotNo || 1);
  });
  const activeCanBo = canBoData.filter(c => c.trangThai === 'active').length;
  const quickCanBo = canBoData;
  const totalOfficerPages = Math.max(1, Math.ceil(quickCanBo.length / OFFICERS_PER_PAGE));

  useEffect(() => {
    if (officerPage > totalOfficerPages) {
      setOfficerPage(totalOfficerPages);
    }
  }, [officerPage, totalOfficerPages]);

  const pagedOfficers = useMemo(() => {
    const start = (officerPage - 1) * OFFICERS_PER_PAGE;
    return quickCanBo.slice(start, start + OFFICERS_PER_PAGE);
  }, [quickCanBo, officerPage]);

  const recentActivities = hoatDongGanDay;
  const todayLabel = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const currentWeekNo = lichCongTacData.reduce((acc, x) => {
    if (!x.tuanSo) return acc;
    return x.ngay === today ? x.tuanSo : acc;
  }, null) || (lichCongTacData[0]?.tuanSo || 0);
  const weekItems = lichCongTacData.filter(l => l.tuanSo === currentWeekNo);
  const weekRangeText = weekItems.length
    ? `${weekItems.map((x) => x.ngay).sort()[0]} - ${weekItems.map((x) => x.ngay).sort().slice(-1)[0]}`
    : 'Du lieu hien tai';

  // Calculate consistent week dates
  const getWeekDates = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  };
  const weekDates = getWeekDates();
  const monthNow = new Date();
  const monthStart = new Date(monthNow.getFullYear(), monthNow.getMonth(), 1);
  const monthEnd = new Date(monthNow.getFullYear(), monthNow.getMonth() + 1, 0);
  const monthStartWeekDay = monthStart.getDay() === 0 ? 7 : monthStart.getDay();
  const monthDays = [];
  for (let i = 1; i < monthStartWeekDay; i += 1) monthDays.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d += 1) {
    monthDays.push(new Date(monthNow.getFullYear(), monthNow.getMonth(), d));
  }

  const actColors = {
    create: 'bg-emerald-100 text-emerald-600',
    update: 'bg-blue-100 text-blue-600',
    delete: 'bg-red-100 text-red-600',
    approve: 'bg-purple-100 text-purple-600',
    reject: 'bg-amber-100 text-amber-600',
  };
  const actIcons = { create: '+', update: '✏', delete: '-', approve: '✓', reject: '!' };

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Lịch tháng</h3>
          </div>
          <button onClick={() => onNavigate('lichcongtac')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Mở lịch chi tiết <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500 mb-2">
            {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map((x) => (
              <div key={x} className="px-2">{x}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} className="h-28 rounded-xl bg-slate-50" />;
              const dateStr = toDateStr(d);
              const isToday = dateStr === today;
              const isFirstMondayOfMonth = d.getDay() === 1 && d.getDate() <= 7;
              const holiday = HOLIDAYS[dateStr];
              const dayEvents = lichCongTacData.filter((x) => x.ngay === dateStr);
              return (
                <div key={dateStr} className={`h-28 rounded-xl border p-2 overflow-hidden ${isToday ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{d.getDate()}</span>
                    {isFirstMondayOfMonth && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Chào cờ</span>}
                  </div>
                  {holiday && <div className="text-[10px] text-red-600 font-medium line-clamp-1">{holiday}</div>}
                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map((evt) => {
                      const colorInfo = LOAI_LICH_COLORS[evt.loai] || LOAI_LICH_COLORS.hop;
                      const timeDisplay = evt.gioBatDau ? `${evt.gioBatDau}` + (evt.gioKetThuc ? `-${evt.gioKetThuc}` : '') : '';
                      return (
                        <div key={evt.id} className={`text-[10px] px-1.5 py-0.5 rounded ${colorInfo.bg} ${colorInfo.text}`}>
                          {timeDisplay && <span className="font-medium">{timeDisplay} </span>}
                          {evt.tieuDe}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && <div className="text-[10px] text-slate-400">+{dayEvents.length - 2} lịch</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Người trực hôm nay</h3>
            <p className="text-xs text-slate-500 mt-0.5">Ngày {today}</p>
          </div>
          <span className="badge bg-blue-100 text-blue-700">{todayDutySorted.length} người trực</span>
        </div>

        {todayDutySorted.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">Hôm nay chưa có lịch trực.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  {['Họ và tên', 'Vị trí trực', 'Vai trò', 'Thời gian'].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayDutySorted.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="table-td text-sm font-semibold text-slate-800">{item.tenCanBo}</td>
                    <td className="table-td text-sm text-slate-700">{item.viTri || '-'}</td>
                    <td className="table-td">
                      <span className={`badge ${item.kieuTruc === 'giamdoc' || item.vaiTroTruc === 'commander' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.kieuTruc === 'giamdoc' ? 'Trực ban giám đốc' : item.vaiTroTruc === 'commander' ? 'Chỉ huy trực' : 'Cán bộ trực'}
                      </span>
                    </td>
                    <td className="table-td text-sm text-slate-700">
                      {item.kieuTruc === 'giamdoc'
                        ? `${item.ngay} - ${item.denNgay || item.ngay}`
                        : `${item.gioBatDau || '--:--'} - ${item.gioKetThuc || '--:--'}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Bảng cán bộ nhanh</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                {['Họ và tên', 'Chức vụ', 'Đơn vị', 'Liên hệ', 'Vai trò', 'Trạng thái'].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedOfficers.map(cb => (
                <tr key={cb.id} className="hover:bg-slate-50/70">
                  <td className="table-td">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                        {cb.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{cb.hoTen}</div>
                        <div className="text-xs text-slate-400 font-mono">{cb.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-td text-sm text-slate-700 whitespace-nowrap">{cb.chucVu}</td>
                  <td className="table-td text-sm text-slate-700">{cb.donVi}</td>
                  <td className="table-td">
                    <div className="text-xs text-slate-500 space-y-1">
                      <div className="flex items-center gap-1"><Phone size={11} /> {cb.soDienThoai}</div>
                      <div className="flex items-center gap-1"><Mail size={11} /> {cb.email}</div>
                    </div>
                  </td>
                  <td className="table-td">
                    <span className={`badge inline-flex items-center whitespace-nowrap ${cb.vaiTro === 'Lãnh đạo' ? 'bg-purple-100 text-purple-700' : cb.vaiTro === 'Quản lý' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {cb.vaiTro}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={`badge inline-flex items-center whitespace-nowrap ${cb.trangThai === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {cb.trangThai === 'active' ? 'Đang công tác' : 'Tạm nghỉ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalOfficerPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Trang {officerPage}/{totalOfficerPages} · {quickCanBo.length} cán bộ
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOfficerPage((p) => Math.max(1, p - 1))}
                disabled={officerPage === 1}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={14} />
              </button>

              {[...Array(totalOfficerPages)].map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOfficerPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${officerPage === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'}`}
                >
                  {i + 1}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setOfficerPage((p) => Math.min(totalOfficerPages, p + 1))}
                disabled={officerPage === totalOfficerPages}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
