import React, { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, MapPin, User, Clock, X, Edit2, Filter, CalendarDays, Trash2 } from 'lucide-react';
import { LOAI_LICH_COLORS, WEEK_DAYS } from '../../data/uiConstants';
import apiClient from '../../services/api';

const HOURS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toDateOnly = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const d = value ? new Date(value) : new Date();
  return formatLocalDate(d);
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

const formatDDMM = (date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

const getIsoWeekNo = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

const formatDisplayTime = (timeValue) => {
  const time = String(timeValue || '');
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  return time === '00:00' ? '12:00' : time;
};

const initialForm = {
  tieuDe: '', ngay: toDateOnly(new Date()), gioBatDau: '08:00', gioKetThuc: '10:00',
  diaDiem: '', canBo1Id: '', canBo2Id: '', canBoTrucChiHuyId: '',
  thanhPhanThamGia: [], bgdMemberIds: [], loai: 'hop', ghiChu: ''
};

const LapLichCongTac = ({ user, lichCongTacData = [], canBoData = [], holidayData = [], reloadData }) => {
  const canEdit = user?.role !== 'Cán bộ';
  const canReview = user?.backendRole === 'admin';
  const [data, setData] = useState(lichCongTacData);
  const [viewMode, setViewMode] = useState('month'); // 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterLoai, setFilterLoai] = useState('');
  const [filterDonVi, setFilterDonVi] = useState('');
  const [showBgdPicker, setShowBgdPicker] = useState(false);

  useEffect(() => {
    setData(lichCongTacData);
  }, [lichCongTacData]);

  const weekStart = getWeekStart(weekOffset);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekLabel = weekOffset === 0
    ? `Tuần này (${formatDDMM(weekDates[0])} - ${formatDDMM(weekDates[6])})`
    : `Tuần ${toDateOnly(weekDates[0])} - ${toDateOnly(weekDates[6])}`;

  // Month calculation
  const monthNow = new Date();
  monthNow.setMonth(monthNow.getMonth() + monthOffset);
  const monthStart = new Date(monthNow.getFullYear(), monthNow.getMonth(), 1);
  const monthEnd = new Date(monthNow.getFullYear(), monthNow.getMonth() + 1, 0);
  const monthStartWeekDay = monthStart.getDay() === 0 ? 7 : monthStart.getDay();
  const monthDays = [];
  for (let i = 1; i < monthStartWeekDay; i += 1) monthDays.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d += 1) {
    monthDays.push(new Date(monthNow.getFullYear(), monthNow.getMonth(), d));
  }
  const monthLabel = monthNow.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const d_str = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${d_str}`;
  };

  const donViOptions = Array.from(new Set(
    data
      .map((l) => l.donVi)
      .filter(Boolean)
      .flatMap((dv) => String(dv).split(',').map((x) => x.trim()).filter(Boolean))
  ));

  const weekData = data.filter((l) => {
    const inRange = l.ngay >= toDateOnly(weekDates[0]) && l.ngay <= toDateOnly(weekDates[6]);
    const matchLoai = !filterLoai || l.loai === filterLoai;
    const matchDonVi = !filterDonVi || String(l.donVi || '').split(',').map((x) => x.trim()).includes(filterDonVi);
    return inRange && matchLoai && matchDonVi;
  });

  const monthData = data.filter((l) => {
    const lDate = new Date(`${l.ngay}T00:00:00`);
    const matchLoai = !filterLoai || l.loai === filterLoai;
    const matchDonVi = !filterDonVi || String(l.donVi || '').split(',').map((x) => x.trim()).includes(filterDonVi);
    return lDate >= monthStart && lDate <= monthEnd && matchLoai && matchDonVi;
  });

  const HOLIDAYS = (holidayData || []).reduce((acc, h) => {
    if (h?.ngay) acc[h.ngay] = h.ten;
    return acc;
  }, {});

  const participantUnits = Array.from(new Set(
    canBoData
      .map((cb) => cb.donVi)
      .filter(Boolean)
      .filter((dv) => /^Phòng\s|^Khoa\s/i.test(dv) || dv === 'Ban Giám đốc')
  ));

  const banGiamDocMembers = canBoData
    .filter((cb) => cb.vaiTro === 'Lãnh đạo' || cb.donVi === 'Ban Giám đốc')
    .slice(0, 4);

  const getDayEvents = (dateStr) => weekData.filter(l => {
    const d = new Date(l.ngay).getDay();
    const dayMap = { 1: '09', 2: '10', 3: '11', 4: '12', 5: '13', 6: '14', 0: '15' };
    const dd = dayMap[d];
    return l.ngay.endsWith(`-${dd}`);
  });

  const getEventsForDate = (dateIdx) => {
    const targetDate = toDateOnly(weekDates[dateIdx]);
    return weekData.filter((l) => l.ngay === targetDate);
  };

  const openAdd = (day) => {
    setForm({ ...initialForm, ngay: toDateOnly(weekDates[day] || new Date()) });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    const participants = item.participants || {};
    setForm({
      ...item,
      thanhPhanThamGia: Array.isArray(participants.units) ? participants.units : [],
      bgdMemberIds: Array.isArray(participants.boardMembers) ? participants.boardMembers : [],
    });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.tieuDe || !form.ngay) return;
    if (!form.canBo1Id || !form.canBo2Id || !form.canBoTrucChiHuyId) {
      alert('Vui lòng chọn đầy đủ: Cán bộ 1, Cán bộ 2 và Cán bộ chỉ huy.');
      return;
    }
    if (!form.thanhPhanThamGia?.length) {
      alert('Vui lòng chọn ít nhất một thành phần tham gia.');
      return;
    }

    const payload = {
      title: form.tieuDe,
      date: form.ngay,
      startTime: form.gioBatDau || null,
      endTime: form.gioKetThuc || null,
      location: form.diaDiem || '',
      officer1Id: form.canBo1Id || null,
      officer2Id: form.canBo2Id || null,
      commanderOfficerId: form.canBoTrucChiHuyId || null,
      department: (form.thanhPhanThamGia || []).join(', '),
      participants: {
        units: form.thanhPhanThamGia || [],
        boardMembers: form.bgdMemberIds || [],
      },
      type: form.loai,
      weekNo: getIsoWeekNo(form.ngay),
      notes: form.ghiChu || '',
    };

    try {
      if (editId) {
        await apiClient.workSchedules.update(editId, payload);
      } else {
        await apiClient.workSchedules.create(payload);
      }

      if (reloadData) await reloadData();
      setShowModal(false);
    } catch (err) {
      alert(err?.message || 'Không thể lưu lịch công tác.');
    }
  };

  const handleApprove = async (scheduleId) => {
    try {
      await apiClient.workSchedules.approve(scheduleId, 'approved');
      if (reloadData) await reloadData();
    } catch (err) {
      alert(err?.message || 'Không thể duyệt lịch công tác.');
    }
  };

  const getApprovalBadge = (status) => {
    if (status === 'pending') {
      return { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    if (status === 'rejected') {
      return { label: 'Từ chối', cls: 'bg-red-100 text-red-700 border-red-200' };
    }
    return { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch công tác</h2>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý lịch công tác theo tuần và tháng</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('week')}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <CalendarDays size={14} className="inline mr-1.5" />Lịch tuần
          </button>
          <button onClick={() => setViewMode('month')}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <CalendarDays size={14} className="inline mr-1.5" />Lịch tháng
          </button>
          {canEdit && (
            <button onClick={() => openAdd(3)} className="btn-primary">
              <Plus size={16} /> Thêm lịch
            </button>
          )}
        </div>
      </div>

      {/* Week/Month navigation + filter */}
      {(viewMode === 'week' || viewMode === 'month') && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => viewMode === 'week' ? setWeekOffset(w => w - 1) : setMonthOffset(m => m - 1)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-semibold text-slate-700 min-w-[200px] text-center">
              {viewMode === 'week' ? weekLabel : monthLabel}
            </span>
            <button onClick={() => viewMode === 'week' ? setWeekOffset(w => w + 1) : setMonthOffset(m => m + 1)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select value={filterLoai} onChange={e => setFilterLoai(e.target.value)}
              className="input-field !w-auto !py-2 text-sm">
              <option value="">Tất cả loại</option>
              {Object.entries(LOAI_LICH_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterDonVi} onChange={e => setFilterDonVi(e.target.value)}
              className="input-field !w-auto !py-2 text-sm">
              <option value="">Đơn vị: Tất cả</option>
              {donViOptions.map((dv) => <option key={dv} value={dv}>{dv}</option>)}
            </select>
          </div>
          <span className="text-xs text-slate-400">
            {viewMode === 'week' ? `${weekData.length} lịch trong tuần` : `${monthData.length} lịch trong tháng`}
          </span>
        </div>
      )}

      {viewMode === 'week' ? (
        /* Weekly calendar view */
        <div className="card-lg p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-slate-100">
            <div className="p-3 bg-slate-50 border-r border-slate-100" />
            {WEEK_DAYS.map((day, i) => {
              const isToday = toDateOnly(weekDates[i]) === toDateOnly(new Date());
              const events = getEventsForDate(i);
              const holiday = HOLIDAYS[toDateOnly(weekDates[i])];
              return (
                <div key={i} className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                  <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{day}</div>
                  <div className={`text-lg font-extrabold mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                    {String(weekDates[i].getDate()).padStart(2, '0')}
                  </div>
                  {holiday && <div className="text-[10px] text-red-600 font-semibold line-clamp-1">{holiday}</div>}
                  {events.length > 0 && (
                    <div className={`text-[10px] mt-0.5 font-medium ${isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                      {events.length} lịch
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="overflow-y-auto max-h-[500px]">
            {HOURS.map((hour, hi) => (
              <div key={hi} className="grid grid-cols-8 border-b border-slate-50 min-h-[64px]">
                <div className="p-2 text-[11px] text-slate-400 font-medium border-r border-slate-100 flex items-start pt-2 bg-slate-50/50">
                  {hour}
                </div>
                {[0,1,2,3,4,5,6].map(dayIdx => {
                  const events = getEventsForDate(dayIdx).filter(e => {
                    const h = parseInt(e.gioBatDau.split(':')[0]);
                    return h === parseInt(hour.split(':')[0]);
                  });
                  const isToday = toDateOnly(weekDates[dayIdx]) === toDateOnly(new Date());
                  return (
                    <div key={dayIdx}
                      className={`border-r border-slate-100 last:border-r-0 p-1 relative group cursor-pointer ${isToday ? 'bg-blue-50/30' : 'hover:bg-slate-50'} transition-colors`}
                      onClick={() => canEdit && !events.length && openAdd(dayIdx)}>
                      {events.map(evt => {
                        const colorInfo = LOAI_LICH_COLORS[evt.loai] || LOAI_LICH_COLORS.hop;
                        const approval = getApprovalBadge(evt.trangThaiDuyet);
                        return (
                          <div key={evt.id}
                            onClick={canEdit ? (e => { e.stopPropagation(); openEdit(evt); }) : undefined}
                            className={`${colorInfo.bg} ${colorInfo.text} rounded-lg p-1.5 mb-1 cursor-pointer hover:opacity-80 transition-opacity group/evt border border-current border-opacity-20`}>
                            <div className="flex items-start justify-between gap-1 mb-0.5">
                              <div className="text-[10px] font-bold leading-tight line-clamp-1 flex-1">{evt.tieuDe}</div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold whitespace-nowrap ${approval.cls}`}>
                                {approval.label}
                              </span>
                            </div>
                            <div className="text-[9px] opacity-70 mt-0.5">{formatDisplayTime(evt.gioBatDau)}–{formatDisplayTime(evt.gioKetThuc)}</div>
                            {canReview && evt.trangThaiDuyet === 'pending' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleApprove(evt.id); }}
                                className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Duyệt
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!events.length && (
                        <div className="absolute inset-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Plus size={10} className="text-blue-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'month' ? (
        /* Monthly calendar view */
        <div className="card-lg p-0 overflow-hidden">
          <div className="p-5">
            <div className="grid grid-cols-7 gap-3 mb-4">
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map((x, i) => (
                <div key={x} className={`py-3 text-center font-bold text-sm rounded-lg ${i === 5 ? 'bg-amber-50 text-amber-700' : i === 6 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                  {x}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-3 auto-rows-fr">
              {monthDays.map((d, idx) => {
                if (!d) return <div key={`empty-${idx}`} className="min-h-32 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100/50" />;
                const dateStr = toDateStr(d);
                const isToday = dateStr === toDateStr(new Date());
                const isMonday = d.getDay() === 1;
                const isWeekend = d.getDay() === 6 || d.getDay() === 0;
                const holiday = HOLIDAYS[dateStr];
                const dayEvents = monthData.filter((x) => x.ngay === dateStr);
                return (
                  <div key={dateStr} 
                    className={`min-h-32 rounded-lg p-3 transition-all duration-200 cursor-pointer group relative overflow-hidden ${
                      isToday 
                        ? 'border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-50/30 shadow-lg' 
                        : isWeekend
                        ? 'border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-md hover:border-slate-300'
                        : 'border border-slate-200 bg-white hover:shadow-md hover:border-slate-300'
                    }`}
                    onClick={() => {
                      if (canEdit) {
                        setForm({ ...initialForm, ngay: dateStr });
                        setEditId(null);
                        setShowModal(true);
                      }
                    }}>
                    {/* Background accent */}
                    <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/5 rounded-bl-lg group-hover:bg-blue-500/10 transition-colors" />
                    
                    {/* Day number */}
                    <div className="flex items-start justify-between mb-2 relative z-10">
                      <span className={`text-base font-extrabold ${isToday ? 'text-blue-700' : isWeekend ? 'text-slate-400' : 'text-slate-800'}`}>
                        {d.getDate()}
                      </span>
                      {isMonday && (
                        <span className="text-[9px] px-2 py-1 rounded-full font-bold bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200">
                          Chào cờ
                        </span>
                      )}
                    </div>
                    {holiday && <div className="text-[10px] text-red-600 font-semibold line-clamp-1 mb-1">{holiday}</div>}

                    {/* Events container */}
                    <div className="space-y-1.5 relative z-10 max-h-20 overflow-y-auto scrollbar-hide">
                      {dayEvents.slice(0, 3).map((evt, eIdx) => {
                        const colorInfo = LOAI_LICH_COLORS[evt.loai] || LOAI_LICH_COLORS.hop;
                        const timeDisplay = evt.gioBatDau ? `${evt.gioBatDau.slice(0, 5)}` : '';
                        const approval = getApprovalBadge(evt.trangThaiDuyet);
                        return (
                          <div 
                            key={evt.id}
                            className={`text-[11px] px-2 py-1.5 rounded-md transition-all duration-150 cursor-pointer hover:shadow-sm hover:scale-105 transform origin-left border border-current border-opacity-30 group/evt ${colorInfo.bg} ${colorInfo.text}`}
                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                            title={evt.tieuDe}>
                            <div className="flex items-start gap-1 justify-between">
                              {timeDisplay && (
                                <span className="font-bold whitespace-nowrap text-opacity-80 flex-shrink-0">{timeDisplay}</span>
                              )}
                              <span className="font-medium line-clamp-1 flex-1 group-hover/evt:underline">{evt.tieuDe}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold whitespace-nowrap ${approval.cls}`}>
                                {approval.label}
                              </span>
                            </div>
                            {canReview && evt.trangThaiDuyet === 'pending' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleApprove(evt.id); }}
                                className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Duyệt
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* More indicator */}
                    {dayEvents.length > 3 && (
                      <div className="mt-1.5 text-[10px] font-bold text-slate-400 pl-2 relative z-10">
                        +{dayEvents.length - 3} lịch
                      </div>
                    )}

                    {/* Add button indicator */}
                    {canEdit && dayEvents.length === 0 && (
                      <div className="mt-1 text-center">
                        <div className="text-[10px] text-slate-300 group-hover:text-blue-400 transition-colors">Nhấn để thêm</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-1">
        {Object.entries(LOAI_LICH_COLORS).map(([k, v]) => (
          <span key={k} className={`badge ${v.bg} ${v.text}`}>{v.label}</span>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{editId ? 'Chỉnh sửa lịch công tác' : 'Thêm lịch công tác'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nội dung công tác <span className="text-red-500">*</span></label>
                <input className="input-field" placeholder="Nhập nội dung công tác..." value={form.tieuDe} onChange={e => setForm({...form, tieuDe: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày <span className="text-red-500">*</span></label>
                  <input type="date" className="input-field" value={form.ngay} onChange={e => setForm({...form, ngay: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Từ giờ</label>
                  <input type="time" className="input-field" value={form.gioBatDau} onChange={e => setForm({...form, gioBatDau: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đến giờ</label>
                  <input type="time" className="input-field" value={form.gioKetThuc} onChange={e => setForm({...form, gioKetThuc: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Địa điểm</label>
                <input className="input-field" placeholder="VD: Phòng họp A - Tầng 2" value={form.diaDiem} onChange={e => setForm({...form, diaDiem: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại lịch</label>
                <select className="input-field" value={form.loai} onChange={e => setForm({...form, loai: e.target.value})}>
                  {Object.entries(LOAI_LICH_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cán bộ 1 <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.canBo1Id || ''} onChange={e => setForm({...form, canBo1Id: e.target.value})}>
                    <option value="">-- Chọn --</option>
                    {canBoData.map(cb => <option key={cb.id} value={cb.id}>{[cb.capBac, cb.hoTen].filter(Boolean).join(' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cán bộ 2 <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.canBo2Id || ''} onChange={e => setForm({...form, canBo2Id: e.target.value})}>
                    <option value="">-- Chọn --</option>
                    {canBoData.map(cb => <option key={cb.id} value={cb.id}>{[cb.capBac, cb.hoTen].filter(Boolean).join(' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cán bộ chỉ huy <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.canBoTrucChiHuyId || ''} onChange={e => setForm({...form, canBoTrucChiHuyId: e.target.value})}>
                    <option value="">-- Chọn --</option>
                    {canBoData.map(cb => <option key={cb.id} value={cb.id}>{[cb.capBac, cb.hoTen].filter(Boolean).join(' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Thành phần tham gia <span className="text-red-500">*</span></label>
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto bg-slate-50/40">
                  {participantUnits.map((unit) => {
                    const checked = (form.thanhPhanThamGia || []).includes(unit);
                    return (
                      <label key={unit} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...(form.thanhPhanThamGia || []), unit]
                              : (form.thanhPhanThamGia || []).filter((x) => x !== unit);
                            setForm({ ...form, thanhPhanThamGia: next, bgdMemberIds: unit === 'Ban Giám đốc' && !e.target.checked ? [] : form.bgdMemberIds });
                            if (unit === 'Ban Giám đốc' && e.target.checked) {
                              setShowBgdPicker(true);
                            }
                          }}
                        />
                        <span>{unit}</span>
                      </label>
                    );
                  })}
                </div>
                {(form.thanhPhanThamGia || []).includes('Ban Giám đốc') && (
                  <button
                    type="button"
                    onClick={() => setShowBgdPicker(true)}
                    className="mt-2 px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Chọn thành viên Ban Giám đốc ({(form.bgdMemberIds || []).length}/4)
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ghi chú</label>
                <textarea rows={2} className="input-field resize-none" placeholder="Ghi chú thêm..." value={form.ghiChu} onChange={e => setForm({...form, ghiChu: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">{editId ? 'Lưu' : 'Thêm lịch'}</button>
            </div>
          </div>
        </div>
      )}

      {showBgdPicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Thành viên Ban Giám đốc</h3>
              <button onClick={() => setShowBgdPicker(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Chọn các thành viên tham gia (4 ô tên Ban Giám đốc).</p>
            <div className="space-y-2">
              {banGiamDocMembers.map((cb) => {
                const checked = (form.bgdMemberIds || []).includes(cb.id);
                return (
                  <label key={cb.id} className="flex items-center gap-2 text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = form.bgdMemberIds || [];
                        const next = e.target.checked
                          ? [...current, cb.id]
                          : current.filter((id) => id !== cb.id);
                        setForm({ ...form, bgdMemberIds: next });
                      }}
                    />
                    <span>{[cb.capBac, cb.hoTen].filter(Boolean).join(' ')}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowBgdPicker(false)} className="btn-secondary">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Xóa lịch công tác?</h3>
            <p className="text-sm text-slate-500 mb-5">Bạn có chắc muốn xóa lịch <span className="font-semibold text-slate-700">"{deleteConfirm.tieuDe}"</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button
                onClick={async () => {
                  try {
                    await apiClient.workSchedules.delete(deleteConfirm.id);
                    if (reloadData) await reloadData();
                    setDeleteConfirm(null);
                  } catch (err) {
                    alert(err?.message || 'Không thể xóa lịch công tác.');
                  }
                }}
                className="btn-danger flex-1 justify-center"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LapLichCongTac;
