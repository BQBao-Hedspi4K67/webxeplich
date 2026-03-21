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
  diaDiem: '', nguoiPhuTrach: '', donVi: '', loai: 'hop', ghiChu: '', trangThai: 'upcoming'
};

const LapLichCongTac = ({ user, lichCongTacData = [], canBoData = [], reloadData }) => {
  const canEdit = user?.role !== 'Cán bộ';
  const [data, setData] = useState(lichCongTacData);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'list'
  const [weekOffset, setWeekOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterLoai, setFilterLoai] = useState('');

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

  const currentWeek = data.find((x) => x.ngay >= toDateOnly(weekDates[0]) && x.ngay <= toDateOnly(weekDates[6]))?.tuanSo || null;

  const weekData = data.filter((l) => {
    const inRange = l.ngay >= toDateOnly(weekDates[0]) && l.ngay <= toDateOnly(weekDates[6]);
    return inRange && (!filterLoai || l.loai === filterLoai);
  });

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
    setForm({ ...initialForm, ngay: toDateOnly(weekDates[day] || new Date()), trangThai: 'upcoming' });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({ ...item });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.tieuDe || !form.ngay) return;

    const payload = {
      title: form.tieuDe,
      date: form.ngay,
      startTime: form.gioBatDau || null,
      endTime: form.gioKetThuc || null,
      location: form.diaDiem || '',
      assignedTo: form.nguoiPhuTrach || '',
      department: form.donVi || '',
      type: form.loai,
      weekNo: getIsoWeekNo(form.ngay),
      notes: form.ghiChu || '',
      status: form.trangThai,
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

  const trangThaiColor = { completed: 'bg-emerald-100 text-emerald-700', active: 'bg-blue-100 text-blue-700', upcoming: 'bg-slate-100 text-slate-600' };
  const trangThaiLabel = { completed: 'Đã diễn ra', active: 'Đang diễn ra', upcoming: 'Sắp diễn ra' };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lập lịch công tác tuần</h2>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý và lập lịch công tác theo tuần</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('week')}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <CalendarDays size={14} className="inline mr-1.5" />Lịch tuần
          </button>
          <button onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            ≡ Danh sách
          </button>
          {canEdit && (
            <button onClick={() => openAdd(3)} className="btn-primary">
              <Plus size={16} /> Thêm lịch
            </button>
          )}
        </div>
      </div>

      {/* Week navigation + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-semibold text-slate-700 min-w-[200px] text-center">{weekLabel}</span>
          <button onClick={() => setWeekOffset(w => w + 1)}
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
        </div>
        <span className="text-xs text-slate-400">{weekData.length} lịch trong tuần</span>
      </div>

      {viewMode === 'week' ? (
        /* Weekly calendar view */
        <div className="card-lg p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-slate-100">
            <div className="p-3 bg-slate-50 border-r border-slate-100" />
            {WEEK_DAYS.map((day, i) => {
              const isToday = toDateOnly(weekDates[i]) === toDateOnly(new Date());
              const events = getEventsForDate(i);
              return (
                <div key={i} className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                  <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{day}</div>
                  <div className={`text-lg font-extrabold mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                    {String(weekDates[i].getDate()).padStart(2, '0')}
                  </div>
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
                        return (
                          <div key={evt.id}
                            onClick={canEdit ? (e => { e.stopPropagation(); openEdit(evt); }) : undefined}
                            className={`${colorInfo.bg} ${colorInfo.text} rounded-lg p-1.5 mb-1 cursor-pointer hover:opacity-80 transition-opacity group/evt border border-current border-opacity-20`}>
                            <div className="text-[10px] font-bold leading-tight line-clamp-1">{evt.tieuDe}</div>
                            <div className="text-[9px] opacity-70 mt-0.5">{formatDisplayTime(evt.gioBatDau)}–{formatDisplayTime(evt.gioKetThuc)}</div>
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
      ) : (
        /* List view */
        <div className="card-lg p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Nội dung công tác', 'Ngày', 'Thời gian', 'Địa điểm', 'Người phụ trách', 'Loại', 'Trạng thái', ''].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekData.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                    <CalendarDays size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Chưa có lịch trong tuần này</p>
                  </td></tr>
                ) : weekData.map(evt => {
                  const colorInfo = LOAI_LICH_COLORS[evt.loai] || LOAI_LICH_COLORS.hop;
                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="table-td">
                        <div className="font-semibold text-slate-800 text-sm">{evt.tieuDe}</div>
                        {evt.ghiChu && <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{evt.ghiChu}</div>}
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-slate-700 font-medium">
                          {new Date(evt.ngay).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </span>
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock size={12} className="text-slate-400" />
                          {formatDisplayTime(evt.gioBatDau)} – {formatDisplayTime(evt.gioKetThuc)}
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 max-w-[160px]">
                          <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="line-clamp-1">{evt.diaDiem}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <User size={12} className="text-slate-400" />
                          <span className="line-clamp-1">{evt.nguoiPhuTrach.split(' ').slice(-2).join(' ')}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <span className={`badge ${colorInfo.bg} ${colorInfo.text}`}>{colorInfo.label}</span>
                      </td>
                      <td className="table-td">
                        <span className={`badge ${trangThaiColor[evt.trangThai]}`}>{trangThaiLabel[evt.trangThai]}</span>
                      </td>
                      <td className="table-td">
                        <div className="flex gap-1">
                          {canEdit && (
                            <>
                              <button onClick={() => openEdit(evt)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><Edit2 size={13} /></button>
                              <button onClick={() => setDeleteConfirm(evt)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Người phụ trách</label>
                  <select className="input-field" value={form.nguoiPhuTrach} onChange={e => setForm({...form, nguoiPhuTrach: e.target.value})}>
                    <option value="">-- Chọn cán bộ --</option>
                    {canBoData.map(cb => <option key={cb.id} value={cb.hoTen}>{cb.hoTen}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại lịch</label>
                  <select className="input-field" value={form.loai} onChange={e => setForm({...form, loai: e.target.value})}>
                    {Object.entries(LOAI_LICH_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {canEdit && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Trạng thái</label>
                  <select className="input-field" value={form.trangThai || 'upcoming'} onChange={e => setForm({...form, trangThai: e.target.value})}>
                    <option value="upcoming">Sắp diễn ra</option>
                    <option value="active">Đang diễn ra</option>
                    <option value="completed">Đã diễn ra</option>
                  </select>
                </div>
              )}
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
