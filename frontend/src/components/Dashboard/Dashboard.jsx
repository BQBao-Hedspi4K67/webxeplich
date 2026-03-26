import React from 'react';
import {
  Users, CalendarDays, ClipboardList, AlertCircle,
  TrendingUp, ArrowUpRight, Clock, MapPin, User, ChevronRight, Mail, Phone
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
  thongBaoData = [],
  thongKeTheoThang = [],
  hoatDongGanDay = [],
}) => {
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
  const needUpdate = lichCongTacData.filter(l => l.trangThai === 'upcoming').length;
  const activeCanBo = canBoData.filter(c => c.trangThai === 'active').length;
  const quickCanBo = canBoData.slice(0, 6);

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
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[#1a3a6b] to-[#1e50a0] rounded-2xl p-5 flex items-center justify-between overflow-hidden relative shadow-lg">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute top-4 right-20 w-24 h-24 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 right-40 w-16 h-16 bg-cyan-400/10 rounded-full" />
        </div>
        <div className="relative z-10">
          <p className="text-blue-200 text-xs font-medium mb-1">{todayLabel}</p>
          <h2 className="text-white text-xl font-bold mb-1">Chào buổi sáng! 👋</h2>
          <p className="text-blue-200/80 text-sm">
            Hôm nay có <span className="text-white font-semibold">{todayEvents.length} lịch công tác</span> và{' '}
            <span className="text-white font-semibold">{todayDuty.length} lịch trực ban</span>
          </p>
        </div>
        <div className="relative z-10 hidden sm:flex items-center gap-2">
          <button onClick={() => onNavigate('lichcongtac')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-sm rounded-xl transition-all font-medium border border-white/20">
            Xem lịch hôm nay <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard icon={Users} title="Tổng số cán bộ" value={activeCanBo} sub={`${canBoData.length} tổng · ${canBoData.length - activeCanBo} tạm nghỉ`} color="bg-blue-600" />
        <StatCard icon={CalendarDays} title="Lịch công tác tuần" value={weekItems.length} sub={`Tuần ${currentWeekNo} · ${weekRangeText}`} color="bg-indigo-500" />
        <StatCard icon={ClipboardList} title="Trực ban hôm nay" value={todayDuty.length} sub={`${todayDuty.filter(d => d.trangThai === 'active').length} đang trực`} color="bg-cyan-500" />
        <StatCard icon={AlertCircle} title="Lịch cần xử lý" value={needUpdate} sub="Lịch upcoming cần theo dõi" color="bg-amber-500" />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Chart */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-800">Thống kê lịch 6 tháng gần nhất</h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-500" />
                Lịch công tác
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-cyan-400" />
                Lịch trực ban
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={thongKeTheoThang} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="thang" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="lichCongTac" name="Lịch công tác" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lichTrucBan" name="Lịch trực ban" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Thông báo mới</h3>
            <span className="badge bg-red-100 text-red-600">{thongBaoData.filter(t => !t.daDoc).length} mới</span>
          </div>
          <div className="space-y-3">
            {thongBaoData.slice(0, 4).map(n => {
              const colors = { success: 'bg-emerald-100 text-emerald-600', warning: 'bg-amber-100 text-amber-600', info: 'bg-blue-100 text-blue-600' };
              return (
                <div key={n.id} className={`flex gap-3 p-3 rounded-xl transition-colors hover:bg-slate-50 cursor-pointer ${!n.daDoc ? 'bg-blue-50/60' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${colors[n.loai]}`}>
                    {n.loai === 'success' ? '✓' : n.loai === 'warning' ? '!' : 'i'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-tight text-slate-800 line-clamp-2 ${!n.daDoc ? 'font-semibold' : 'font-medium'}`}>{n.tieuDe}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{n.thoiGian}</p>
                  </div>
                  {!n.daDoc && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's schedule */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Lịch công tác hôm nay</h3>
            <button onClick={() => onNavigate('lichcongtac')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Xem tất cả <ArrowUpRight size={12} />
            </button>
          </div>
          {todayEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CalendarDays size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Không có lịch hôm nay</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayEvents.map(event => {
                const colorInfo = LOAI_LICH_COLORS[event.loai] || LOAI_LICH_COLORS.hop;
                return (
                  <div key={event.id} className="flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-200">
                    <div className="flex flex-col items-center flex-shrink-0 w-12">
                      <span className="text-[11px] font-bold text-blue-600">{event.gioBatDau}</span>
                      <div className="w-px h-3 bg-slate-200 my-0.5" />
                      <span className="text-[10px] text-slate-400">{event.gioKetThuc}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <span className={`badge flex-shrink-0 ${colorInfo.bg} ${colorInfo.text}`}>{colorInfo.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1">{event.tieuDe}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin size={10} />
                          <span className="line-clamp-1">{event.diaDiem}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <User size={10} />
                          <span className="truncate">{event.nguoiPhuTrach.split(' ').slice(-2).join(' ')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activities */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Hoạt động gần đây</h3>
            <Clock size={14} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {recentActivities.map((act, i) => (
              <div key={i} className="flex gap-3 items-start group">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${actColors[act.type] || 'bg-slate-100 text-slate-600'}`}>
                  {actIcons[act.type] || 'i'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-relaxed">{act.text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Bảng cán bộ nhanh</h3>
            <p className="text-xs text-slate-400 mt-0.5">Nhúng từ phân hệ Quản lý cán bộ để theo dõi nhanh trên Dashboard</p>
          </div>
          <button onClick={() => onNavigate('canbo')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Mở đầy đủ <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                {['Cán bộ', 'Chức vụ', 'Đơn vị', 'Liên hệ', 'Vai trò', 'Trạng thái'].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quickCanBo.map(cb => (
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
                  <td className="table-td text-sm text-slate-700">{cb.chucVu}</td>
                  <td className="table-td text-sm text-slate-700">{cb.donVi}</td>
                  <td className="table-td">
                    <div className="text-xs text-slate-500 space-y-1">
                      <div className="flex items-center gap-1"><Phone size={11} /> {cb.soDienThoai}</div>
                      <div className="flex items-center gap-1"><Mail size={11} /> {cb.email}</div>
                    </div>
                  </td>
                  <td className="table-td">
                    <span className={`badge ${cb.vaiTro === 'Lãnh đạo' ? 'bg-purple-100 text-purple-700' : cb.vaiTro === 'Quản lý' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {cb.vaiTro}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={`badge ${cb.trangThai === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {cb.trangThai === 'active' ? 'Đang công tác' : 'Tạm nghỉ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Bảng thời gian biểu tuần</h3>
            <p className="text-xs text-slate-400 mt-0.5">Lịch công tác từ {weekRangeText}</p>
          </div>
          <button onClick={() => onNavigate('lichcongtac')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Mở lịch chi tiết <ArrowUpRight size={12} />
          </button>
        </div>
        {weekItems.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <CalendarDays size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Không có lịch công tác trong tuần hiện tại</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Calendar week view */}
            <div id="calendar-schedule">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50">
                <div className="p-3 border-r border-slate-100" />
                {weekDates.map((d, i) => {
                  const isToday = toDateStr(d) === today;
                  const dayName = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];
                  const dayNum = String(d.getDate()).padStart(2, '0');
                  const dateStr = toDateStr(d);
                  const dayEvents = weekItems.filter(e => e.ngay === dateStr);
                  
                  return (
                    <div key={i} className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                      <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{dayName}</div>
                      <div className={`text-lg font-extrabold mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>{dayNum}</div>
                      {dayEvents.length > 0 && (
                        <div className={`text-[10px] mt-0.5 font-medium ${isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                          {dayEvents.length} lịch
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="overflow-y-auto max-h-[400px]">
                {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map((hour, hi) => (
                  <div key={hi} className="grid grid-cols-8 border-b border-slate-50 min-h-[64px]">
                    <div className="p-2 text-[11px] text-slate-400 font-medium border-r border-slate-100 flex items-start pt-2 bg-slate-50/50">
                      {hour}
                    </div>
                    {weekDates.map((d, dayIdx) => {
                      const isToday = toDateStr(d) === today;
                      const dateStr = toDateStr(d);
                      const dayEvents = weekItems.filter(e => {
                        if (e.ngay !== dateStr) return false;
                        const h = parseInt(e.gioBatDau.split(':')[0]);
                        return h === parseInt(hour.split(':')[0]);
                      });
                      
                      return (
                        <div key={dayIdx}
                          className={`border-r border-slate-100 last:border-r-0 p-1 relative ${isToday ? 'bg-blue-50/30' : 'hover:bg-slate-50'} transition-colors`}>
                          {dayEvents.map(evt => {
                            const colorInfo = LOAI_LICH_COLORS[evt.loai] || LOAI_LICH_COLORS.hop;
                            return (
                              <div key={evt.id}
                                className={`${colorInfo.bg} ${colorInfo.text} rounded-lg p-1.5 mb-1 cursor-pointer hover:opacity-80 transition-opacity border border-current border-opacity-20`}>
                                <div className="text-[10px] font-bold leading-tight line-clamp-1">{evt.tieuDe}</div>
                                <div className="text-[9px] opacity-70 mt-0.5">{evt.gioBatDau}–{evt.gioKetThuc}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
