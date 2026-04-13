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
  diaDiem: '', nguoiPhuTrachId: '',
  thanhPhanThamGia: [], bgdMemberIds: [], loai: 'hop', ghiChu: ''
};

const LapLichCongTac = ({ user, lichCongTacData = [], canBoData = [], departmentData = [], holidayData = [], reloadData }) => {
  const canCreate = Boolean(
    user?.canCreateWorkSchedules
    || user?.backendRole === 'admin'
    || user?.backendRole === 'manager'
  );
  const canEdit = ['Quản trị viên', 'Quản lý'].includes(user?.role);
  const canReview = Boolean(
    user?.canApproveWorkSchedules
    || user?.backendRole === 'admin'
  );
  const canGrantPermission = Boolean(
    user?.canGrantWorkSchedulePermissions
    || user?.backendRole === 'admin'
  );
  const [data, setData] = useState(lichCongTacData);
  const [officerOptions, setOfficerOptions] = useState(canBoData || []);
  const [viewMode, setViewMode] = useState('month'); // 'week' | 'month' | 'permission'
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
  const [permissionLoadingId, setPermissionLoadingId] = useState('');
  const [permissionResult, setPermissionResult] = useState({ type: '', message: '' });
  const [permissionPage, setPermissionPage] = useState(1);
  const [permissionRowsState, setPermissionRowsState] = useState([]);

  const PERMISSION_PAGE_SIZE = 8;

  useEffect(() => {
    setData(lichCongTacData);
  }, [lichCongTacData]);

  useEffect(() => {
    setOfficerOptions(canBoData || []);
  }, [canBoData]);

  useEffect(() => {
    setPermissionRowsState((canBoData || []).filter((item) => item.trangThai === 'active'));
  }, [canBoData]);

  useEffect(() => {
    const loadOfficerOptions = async () => {
      try {
        const res = await apiClient.officers.list(1, 500, { status: 'active', accessScope: 'system' });
        const mapped = (res?.data || []).map((o) => ({
          id: o.id,
          hoTen: o.officerName || o.fullName || o.id,
          capBac: o.officerTitle || '',
          donVi: o.department || '',
          vaiTro: o.role === 'leader' ? 'Lãnh đạo' : o.role === 'manager' ? 'Quản lý' : 'Cán bộ',
        }));
        if (mapped.length) setOfficerOptions(mapped);
      } catch {
        // Fallback to canBoData when fetching full system officers fails.
      }
    };

    loadOfficerOptions();
  }, []);

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

  const donViOptions = Array.from(new Set([
    ...(departmentData || []).map((d) => String(d.name || '').trim()).filter(Boolean),
    ...data
      .map((l) => l.donVi)
      .filter(Boolean)
      .flatMap((dv) => String(dv).split(',').map((x) => x.trim()).filter(Boolean)),
  ])).sort((a, b) => a.localeCompare(b, 'vi'));

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

  const participantUnits = (departmentData || []).length
    ? Array.from(new Set((departmentData || []).map((d) => d.name).filter(Boolean)))
    : Array.from(new Set((officerOptions || []).map((cb) => cb.donVi).filter(Boolean)));

  const banGiamDocMembers = officerOptions
    .filter((cb) => cb.vaiTro === 'Lãnh đạo' || cb.donVi === 'Ban Giám đốc')
    .slice(0, 4);

  const getBgdMemberNames = (memberIds = []) => {
    if (!Array.isArray(memberIds) || !memberIds.length) return [];
    return banGiamDocMembers
      .filter((cb) => memberIds.includes(cb.id))
      .map((cb) => [cb.capBac, cb.hoTen].filter(Boolean).join(' '));
  };

  const handleConfirmBgdSelection = () => {
    setShowBgdPicker(false);
  };

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
      nguoiPhuTrachId: item.nguoiPhuTrachId || item.canBoTrucChiHuyId || '',
      thanhPhanThamGia: Array.isArray(participants.units) ? participants.units : [],
      bgdMemberIds: Array.isArray(participants.boardMembers) ? participants.boardMembers : [],
    });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.tieuDe || !form.ngay) return;
    if (!form.nguoiPhuTrachId) {
      alert('Vui lòng chọn người phụ trách.');
      return;
    }
    if (!form.thanhPhanThamGia?.length) {
      alert('Vui lòng chọn ít nhất một thành phần tham gia.');
      return;
    }

    // Kiểm tra thời gian trong phạm vi 7:00-18:00
    if (form.gioBatDau) {
      const startHour = parseInt(form.gioBatDau.split(':')[0]);
      if (startHour < 7 || startHour >= 18) {
        alert('Giờ bắt đầu phải trong phạm vi 7:00 - 18:00.');
        return;
      }
    }
    if (form.gioKetThuc) {
      const endHour = parseInt(form.gioKetThuc.split(':')[0]);
      if (endHour < 7 || endHour > 18) {
        alert('Giờ kết thúc phải trong phạm vi 7:00 - 18:00.');
        return;
      }
    }

    const payload = {
      title: form.tieuDe,
      date: form.ngay,
      startTime: form.gioBatDau || null,
      endTime: form.gioKetThuc || null,
      location: form.diaDiem || '',
      responsibleOfficerId: form.nguoiPhuTrachId || null,
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

  const handleReject = async (scheduleId) => {
    const confirmed = window.confirm('Không duyệt lịch này? Lịch sẽ bị xóa khỏi hệ thống.');
    if (!confirmed) return;

    try {
      await apiClient.workSchedules.approve(scheduleId, 'rejected');
      if (reloadData) await reloadData();
    } catch (err) {
      alert(err?.message || 'Không thể từ chối lịch công tác.');
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

  const canReviewSchedule = (schedule) => {
    return canReview && schedule?.trangThaiDuyet === 'pending';
  };

  const permissionCandidates = permissionRowsState;
  const permissionTotalPages = Math.max(1, Math.ceil(permissionCandidates.length / PERMISSION_PAGE_SIZE));
  const permissionPageSafe = Math.min(permissionPage, permissionTotalPages);
  const permissionRows = permissionCandidates.slice(
    (permissionPageSafe - 1) * PERMISSION_PAGE_SIZE,
    (permissionPageSafe - 1) * PERMISSION_PAGE_SIZE + PERMISSION_PAGE_SIZE
  );

  useEffect(() => {
    if (permissionPage > permissionTotalPages) {
      setPermissionPage(permissionTotalPages);
    }
  }, [permissionPage, permissionTotalPages]);

  const handleToggleWorkSchedulePermission = async (officer, field) => {
    if (!officer?.id) return;

    const currentCreate = Boolean(officer.canCreateWorkSchedulesByPermission);
    const currentApprove = Boolean(officer.canApproveWorkSchedulesByPermission);
    const nextCreate = field === 'create' ? !currentCreate : currentCreate;
    const nextApprove = field === 'approve' ? !currentApprove : currentApprove;

    setPermissionResult({ type: '', message: '' });

    try {
      setPermissionLoadingId(`${officer.id}:${field}`);
      await apiClient.officers.updateWorkSchedulePermission(officer.id, {
        canCreateWorkSchedules: nextCreate,
        canApproveWorkSchedules: nextApprove,
      });

      setPermissionRowsState((prev) => prev.map((item) => {
        if (item.id !== officer.id) return item;
        return {
          ...item,
          canCreateWorkSchedulesByPermission: nextCreate,
          canApproveWorkSchedulesByPermission: nextApprove,
          canCreateWorkSchedules: Boolean(item.canCreateWorkSchedulesByRole) || nextCreate,
          canApproveWorkSchedules: Boolean(item.canApproveWorkSchedulesByRole) || nextApprove,
        };
      }));

      setPermissionResult({
        type: 'success',
        message: `Đã cập nhật quyền lịch công tác cho ${officer.hoTenDayDu || officer.hoTen}.`,
      });
    } catch (err) {
      setPermissionResult({
        type: 'error',
        message: err?.message || 'Không thể cập nhật quyền lịch công tác.',
      });
    } finally {
      setPermissionLoadingId('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch công tác</h2>
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
          {canGrantPermission && (
            <button onClick={() => setViewMode('permission')}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === 'permission' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Phân quyền
            </button>
          )}
          {canCreate && viewMode !== 'permission' && (
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

          {/* Time grid - continuous layout */}
          <div className="overflow-y-auto max-h-[600px] relative">
            {/* Time labels and grid lines */}
            <div className="grid grid-cols-8 relative">
              <div className="col-span-1">
                {HOURS.map((hour, hi) => (
                  <div key={hi} className="h-16 p-2 text-[11px] text-slate-400 font-medium border-r border-slate-100 border-b border-slate-50 bg-slate-50/50 flex items-start">
                    {hour}
                  </div>
                ))}
              </div>
              
              {/* Day columns with events */}
              {[0,1,2,3,4,5,6].map(dayIdx => {
                const dayEvents = getEventsForDate(dayIdx);
                const isToday = toDateOnly(weekDates[dayIdx]) === toDateOnly(new Date());
                
                // Xử lý overlapping events - gán column cho mỗi event
                const processedEvents = dayEvents.map((evt, idx) => {
                  const startHour = parseInt(evt.gioBatDau.split(':')[0]);
                  const startMin = parseInt(evt.gioBatDau.split(':')[1]);
                  const endHour = parseInt(evt.gioKetThuc.split(':')[0]);
                  const endMin = parseInt(evt.gioKetThuc.split(':')[1]);
                  const startTotalMin = startHour * 60 + startMin;
                  const endTotalMin = endHour * 60 + endMin;
                  
                  return {
                    ...evt,
                    startTotalMin,
                    endTotalMin,
                    originalIndex: idx
                  };
                }).sort((a, b) => a.startTotalMin - b.startTotalMin);
                
                // Tìm overlapping events và gán column
                const columns = [];
                processedEvents.forEach(evt => {
                  let columnIdx = 0;
                  for (let col of columns) {
                    const overlapping = col.some(e => 
                      !(e.endTotalMin <= evt.startTotalMin || e.startTotalMin >= evt.endTotalMin)
                    );
                    if (!overlapping) {
                      columnIdx = Math.max(columnIdx, columns.indexOf(col) + 1);
                    }
                  }
                  
                  if (!columns[columnIdx]) columns[columnIdx] = [];
                  columns[columnIdx].push({ ...evt, columnIdx });
                });
                
                const totalColumns = columns.length || 1;
                const eventsWithLayout = processedEvents.map(evt => {
                  const col = columns.find(c => c.some(e => e.id === evt.id));
                  const columnIdx = col ? col[0].columnIdx : 0;
                  return { ...evt, columnIdx, totalColumns };
                });
                
                return (
                  <div key={dayIdx} className={`relative col-span-1 border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}>
                    {/* Hour grid lines */}
                    {HOURS.map((hour, hi) => (
                      <div key={hi} className="h-16 border-b border-slate-50 relative" />
                    ))}
                    
                    {/* Events overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      {eventsWithLayout.map(evt => {
                        const colorInfo = LOAI_LICH_COLORS[evt.loai] || LOAI_LICH_COLORS.hop;
                        
                        const firstHour = parseInt(HOURS[0].split(':')[0]);
                        const firstHourTotalMin = firstHour * 60;
                        const offsetMin = evt.startTotalMin - firstHourTotalMin;
                        const topOffset = (offsetMin / 60) * 64;
                        
                        const durationMin = evt.endTotalMin - evt.startTotalMin;
                        const height = Math.max(40, (durationMin / 60) * 64);
                        
                        // Tính left và width dựa trên column
                        const widthPercent = (100 / evt.totalColumns);
                        const leftPercent = (evt.columnIdx * widthPercent);
                        
                        return (
                          <div
                            key={evt.id}
                            onClick={canEdit ? (e => { e.stopPropagation(); openEdit(evt); }) : undefined}
                            className={`absolute p-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-current border-opacity-30 pointer-events-auto overflow-hidden ${colorInfo.bg} ${colorInfo.text}`}
                            style={{
                              top: `${topOffset}px`,
                              height: `${height}px`,
                              minHeight: '40px',
                              left: `${leftPercent}%`,
                              right: `${100 - (leftPercent + widthPercent)}%`,
                              margin: '2px'
                            }}
                            title={evt.tieuDe}
                          >
                            <div className="text-[10px] font-bold leading-tight line-clamp-2">{evt.tieuDe}</div>
                            <div className="text-[9px] opacity-70 mt-0.5">{formatDisplayTime(evt.gioBatDau)}–{formatDisplayTime(evt.gioKetThuc)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
                      if (canCreate) {
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
                        return (
                          <div 
                            key={evt.id}
                            className={`text-[11px] px-2 py-1 rounded-md transition-all duration-150 cursor-pointer hover:shadow-sm border border-current border-opacity-30 group/evt ${colorInfo.bg} ${colorInfo.text}`}
                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                            title={evt.tieuDe}>
                            <div className="flex items-start gap-1">
                              {timeDisplay && (
                                <span className="font-bold whitespace-nowrap flex-shrink-0">{timeDisplay}</span>
                              )}
                              <span className="font-medium flex-1 group-hover/evt:underline">{evt.tieuDe}</span>
                            </div>
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
                    {canCreate && dayEvents.length === 0 && (
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
      ) : viewMode === 'permission' ? (
        <div className="card-lg p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">Phân quyền lịch công tác</h3>
            
            {permissionResult.message && (
              <div className={`text-sm rounded-xl px-3 py-2 mt-3 ${permissionResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {permissionResult.message}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <th className="table-th">Quân hàm + Họ và tên</th>
                  <th className="table-th">Chức vụ</th>
                  <th className="table-th">Đơn vị</th>
                  <th className="table-th">Quyền tạo</th>
                  <th className="table-th">Quyền duyệt</th>
                </tr>
              </thead>
              <tbody>
                {permissionRows.map((item) => {
                  const loadingCreate = permissionLoadingId === `${item.id}:create`;
                  const loadingApprove = permissionLoadingId === `${item.id}:approve`;
                  const hasCreateByRole = Boolean(item.canCreateWorkSchedulesByRole);
                  const hasApproveByRole = Boolean(item.canApproveWorkSchedulesByRole);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="table-td font-semibold text-slate-800">{item.hoTenDayDu || item.hoTen}</td>
                      <td className="table-td text-slate-600">{item.chucVu || 'Chưa cập nhật'}</td>
                      <td className="table-td text-slate-600">{item.donVi || 'Chưa cập nhật'}</td>
                      <td className="table-td">
                        {hasCreateByRole ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Theo vai trò</span>
                        ) : (
                          <button
                            type="button"
                            disabled={loadingCreate || loadingApprove}
                            onClick={() => handleToggleWorkSchedulePermission(item, 'create')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${(item.canCreateWorkSchedulesByPermission ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-600 text-white hover:bg-emerald-700')} disabled:opacity-50`}
                          >
                            {loadingCreate
                              ? 'Đang lưu...'
                              : item.canCreateWorkSchedulesByPermission
                                ? 'Thu hồi'
                                : 'Cấp quyền'}
                          </button>
                        )}
                      </td>
                      <td className="table-td">
                        {hasApproveByRole ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Theo vai trò</span>
                        ) : (
                          <button
                            type="button"
                            disabled={loadingApprove || loadingCreate}
                            onClick={() => handleToggleWorkSchedulePermission(item, 'approve')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${(item.canApproveWorkSchedulesByPermission ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-600 text-white hover:bg-emerald-700')} disabled:opacity-50`}
                          >
                            {loadingApprove
                              ? 'Đang lưu...'
                              : item.canApproveWorkSchedulesByPermission
                                ? 'Thu hồi'
                                : 'Cấp quyền'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {permissionCandidates.length > PERMISSION_PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-white">
              <button
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                onClick={() => setPermissionPage((p) => Math.max(1, p - 1))}
                disabled={permissionPageSafe <= 1}
              >
                Trước
              </button>
              <span className="text-sm text-slate-500">Trang {permissionPageSafe}/{permissionTotalPages}</span>
              <button
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                onClick={() => setPermissionPage((p) => Math.min(permissionTotalPages, p + 1))}
                disabled={permissionPageSafe >= permissionTotalPages}
              >
                Sau
              </button>
            </div>
          )}
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
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Từ giờ (7:00-18:00)</label>
                  <input type="time" className="input-field" value={form.gioBatDau} min="07:00" max="18:00" onChange={e => setForm({...form, gioBatDau: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đến giờ (7:00-18:00)</label>
                  <input type="time" className="input-field" value={form.gioKetThuc} min="07:00" max="18:00" onChange={e => setForm({...form, gioKetThuc: e.target.value})} />
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
              <div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Người phụ trách <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.nguoiPhuTrachId || ''} onChange={e => setForm({...form, nguoiPhuTrachId: e.target.value})}>
                    <option value="">-- Chọn --</option>
                    {officerOptions.map(cb => <option key={cb.id} value={cb.id}>{[cb.capBac, cb.hoTen].filter(Boolean).join(' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Thành phần tham gia <span className="text-red-500">*</span></label>
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto bg-slate-50/40">
                  {participantUnits.map((unit) => {
                    const checked = (form.thanhPhanThamGia || []).includes(unit);
                    const isBoardUnit = unit === 'Ban Giám đốc';
                    return (
                      <div key={unit} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...(form.thanhPhanThamGia || []), unit]
                                : (form.thanhPhanThamGia || []).filter((x) => x !== unit);
                              setForm({ ...form, thanhPhanThamGia: next, bgdMemberIds: isBoardUnit && !e.target.checked ? [] : form.bgdMemberIds });
                              if (isBoardUnit && e.target.checked) {
                                setShowBgdPicker(true);
                              }
                            }}
                          />
                          <span>{unit}</span>
                        </label>

                        {isBoardUnit && checked && (
                          <div className="ml-6 space-y-2">
                            <button
                              type="button"
                              onClick={() => setShowBgdPicker(true)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              Chọn thành viên Ban Giám đốc ({(form.bgdMemberIds || []).length}/4)
                            </button>
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold">Thành viên Ban Giám đốc tham gia:</span>{' '}
                              {(() => {
                                const selectedNames = getBgdMemberNames(form.bgdMemberIds || []);
                                return selectedNames.length ? selectedNames.join(', ') : 'Chưa chọn';
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
              <button onClick={handleConfirmBgdSelection} className="btn-primary">OK</button>
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
