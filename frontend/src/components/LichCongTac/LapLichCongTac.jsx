import React, { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, MapPin, User, Clock, X, Edit2, Filter, CalendarDays, Trash2, Printer } from 'lucide-react';
import { LOAI_LICH_COLORS, WEEK_DAYS } from '../../data/uiConstants';
import apiClient from '../../services/api';
import WeekGridSchedule from '../WeekGridSchedule/WeekGridSchedule';

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

const formatDateWithDay = (date) => {
  const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
  const formatted = date.toLocaleDateString('vi-VN', options);
  // Capitalize first letter of day name
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const getIsoWeekNo = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
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

const formatDisplayTime = (timeValue) => {
  const time = String(timeValue || '');
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  return time === '00:00' ? '12:00' : time;
};

const buildDisplayName = (militaryRank = '', fullName = '') => {
  const rank = String(militaryRank || '').trim();
  const name = String(fullName || '').trim();
  if (!rank) return name;
  if (!name) return rank;
  const lowerRank = rank.toLowerCase();
  const lowerName = name.toLowerCase();
  if (lowerName === lowerRank || lowerName.startsWith(`${lowerRank} `)) {
    return name;
  }
  return `${rank} ${name}`;
};

const getSessionBucket = (timeValue) => {
  const hour = Number.parseInt(String(timeValue || '00:00').split(':')[0], 10);
  if (Number.isNaN(hour) || hour < 8) return 'night';
  if (hour < 16) return 'morning';
  return 'afternoon';
};

const SESSION_LABELS = {
  night: 'Đêm\n(00:00-08:00)',
  morning: 'Sáng\n(08:00-16:00)',
  afternoon: 'Chiều\n(16:00-24:00)',
};

const initialForm = {
  tieuDe: '', ngay: toDateOnly(new Date()), gioBatDau: '08:00', gioKetThuc: '10:00',
  diaDiem: '', nguoiPhuTrachId: '',
  thanhPhanThamGia: [], bgdMemberIds: [], loai: 'hop', ghiChu: ''
};

const canUserEditSchedule = (user, item) => {
  const canApprove = Boolean(
    user?.canApproveWorkSchedules
    || user?.backendRole === 'admin'
    || user?.backendRole === 'superadmin'
  );
  const isCreator = String(item?.nguoiTaoOfficerId || '') === String(user?.id || '')
    || String(item?.nguoiTaoUserId || '') === String(user?.userId || '');
  return canApprove || isCreator;
};

const canUserDeleteSchedule = (user, item) => {
  const canApprove = Boolean(
    user?.canApproveWorkSchedules
    || user?.backendRole === 'admin'
    || user?.backendRole === 'superadmin'
  );
  const isCreator = String(item?.nguoiTaoOfficerId || '') === String(user?.id || '')
    || String(item?.nguoiTaoUserId || '') === String(user?.userId || '');
  return canApprove || isCreator;
};

const LapLichCongTac = ({ user, lichCongTacData = [], canBoData = [], departmentData = [], holidayData = [], dutyScheduleData = [], reloadData, onOpenExport }) => {
  const canCreate = Boolean(
    user?.canCreateWorkSchedules
    || user?.backendRole === 'admin'
    || user?.backendRole === 'superadmin'
    || user?.backendRole === 'manager'
  );
  const canExportPrint = Boolean(
    onOpenExport
    && (!user?.backendRole || ['admin', 'manager', 'officer', 'superadmin', 'leader'].includes(user.backendRole))
  );
  const canEdit = ['Quản trị viên', 'Quản lý'].includes(user?.role);

  const [data, setData] = useState(lichCongTacData);
  const [officerOptions, setOfficerOptions] = useState(canBoData || []);
  const [dutyData, setDutyData] = useState(dutyScheduleData || []);
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('lapLichCongTacViewMode') || 'week'); // 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(() => Number(sessionStorage.getItem('lapLichCongTacWeekOffset')) || 0);
  const [monthOffset, setMonthOffset] = useState(() => Number(sessionStorage.getItem('lapLichCongTacMonthOffset')) || 0);
  const [showModal, setShowModal] = useState(false);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [selectedDutyDetail, setSelectedDutyDetail] = useState(null);

  useEffect(() => {
    sessionStorage.setItem('lapLichCongTacViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    sessionStorage.setItem('lapLichCongTacWeekOffset', String(weekOffset));
  }, [weekOffset]);

  useEffect(() => {
    sessionStorage.setItem('lapLichCongTacMonthOffset', String(monthOffset));
  }, [monthOffset]);
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

  useEffect(() => {
    setOfficerOptions(canBoData || []);
  }, [canBoData]);

  const isDutyInDateRange = (duty, dateStr) => {
    const startDate = toDateOnly(duty?.ngay || duty?.date);
    const endDate = toDateOnly(duty?.denNgay || duty?.endDate || duty?.ngay || duty?.date);
    if (!startDate || !endDate) return false;
    return startDate <= dateStr && endDate >= dateStr;
  };


  useEffect(() => {
    const loadDutySchedules = async () => {
      try {
        const weekStart = getWeekStart(weekOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const res = await apiClient.dutySchedules.list(1, 500, {
          startDate: toDateOnly(weekStart),
          endDate: toDateOnly(weekEnd),
        });
        if (res?.data) {
          setDutyData((res.data || []).map((d) => ({
            id: d.id,
            kieuTruc: d.dutyType === 'director_weekly' ? 'giamdoc' : 'canbo',
            tenCanBo: d.officerName || d.officerId || '',
            ngay: toDateOnly(d.date),
            denNgay: toDateOnly(d.endDate),
            ca: d.shift || (d.dutyType === 'director_weekly' ? 'tuan' : 'nguyenday'),
            gioBatDau: d.startTime || '00:00',
            gioKetThuc: d.endTime || '00:00',
            viTri: d.location || '',
            dutyRole: d.dutyRole || 'officer',
            slotNo: Number(d.slotNo || 1),
            vaiTroTruc: d.dutyRole || 'officer',
            nhomPhanCong: d.assignmentGroup || '',
            donVi: d.department || '',
            donViId: d.departmentId || null,
            ghiChu: d.notes || '',
          })));
        }
      } catch (err) {
        console.error('Error loading duty schedules:', err);
      }
    };
    
    loadDutySchedules();
  }, [weekOffset]);

  useEffect(() => {
    const loadOfficerOptions = async () => {
      try {
        const res = await apiClient.officers.list(1, 500, { status: 'active', accessScope: 'system' });
        const mapped = (res?.data || []).map((o) => ({
          id: o.id,
          hoTen: buildDisplayName(o.officerTitle, o.officerName || o.fullName || o.id),
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
      .map((cb) => buildDisplayName(cb.capBac, cb.hoTen));
  };

  const handleConfirmBgdSelection = () => {
    setShowBgdPicker(false);
  };

  const getEventsForDate = (dateIdx) => {
    const targetDate = toDateOnly(weekDates[dateIdx]);
    return weekData.filter((l) => l.ngay === targetDate);
  };

  const openAdd = (day) => {
    setForm({ ...initialForm, ngay: toDateOnly(weekDates[day] || new Date()) });
    setEditId(null);
    setIsReadOnlyModal(false);
    setShowModal(true);
  };

  const openEdit = (item, forceReadOnly = false) => {
    const canEditThisEvent = canUserEditSchedule(user, item);
    const participants = item.participants || {};
    setForm({
      ...item,
      nguoiPhuTrachId: item.nguoiPhuTrachId || item.canBoTrucChiHuyId || '',
      thanhPhanThamGia: Array.isArray(participants.units) ? participants.units : [],
      bgdMemberIds: Array.isArray(participants.boardMembers) ? participants.boardMembers : [],
    });
    setEditId(item.id);
    setIsReadOnlyModal(forceReadOnly || !canEditThisEvent);
    setShowModal(true);
  };

  const handleGridEventClick = (event) => {
    if (event.eventType === 'schedule') {
      openEdit(event, false);
      return;
    }
    if (event.eventType === 'duty') {
      setSelectedDutyDetail(event);
    }
  };

  const handleSave = async () => {
    if (isReadOnlyModal) return;
    if (!form.tieuDe || !form.ngay) return;
    if (!form.nguoiPhuTrachId) {
      alert('Vui lòng chọn người phụ trách.');
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
      alert(err?.message || 'Không thể lưu Lịch sự kiện.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch sự kiện</h2>
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
          {(canCreate || canExportPrint) && (
            <div className="flex items-center gap-2">
              {canExportPrint && (
                <button
                  type="button"
                  onClick={() => onOpenExport?.()}
                  className="btn-secondary"
                  title="Xuất / In lịch"
                >
                  <Printer size={16} /> Xuất / In lịch
                </button>
              )}
              {canCreate && (
                <button onClick={() => openAdd(3)} className="btn-primary">
                  <Plus size={16} /> Thêm lịch
                </button>
              )}
            </div>
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
        <div className="card-lg p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Lịch tuần</h3>
          </div>
          <div className="p-4">
            <WeekGridSchedule
              weekDates={weekDates}
              duties={dutyData}
              schedules={weekData}
              holidays={HOLIDAYS}
              onSelectEvent={handleGridEventClick}
            />
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
                const isFirstMondayOfMonth = d.getDay() === 1 && d.getDate() <= 7;
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
                      {isFirstMondayOfMonth && (
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
                        const start = evt.gioBatDau ? String(evt.gioBatDau).slice(0, 5) : '';
                        const end = evt.gioKetThuc ? String(evt.gioKetThuc).slice(0, 5) : '';
                        const timeDisplay = start && end ? `${start}-${end}` : (start || end || '');
                        const isPending = evt.trangThaiDuyet === 'pending';
                        return (
                          <div 
                            key={evt.id}
                            className={`text-[11px] px-2 py-1 rounded-md transition-all duration-150 cursor-pointer hover:shadow-sm border border-current border-opacity-30 group/evt ${colorInfo.bg} ${colorInfo.text} ${isPending ? 'opacity-65 border-dashed' : ''}`}
                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                            title={evt.tieuDe}>
                            <div className="flex items-start gap-1">
                              {timeDisplay && (
                                <span className="font-bold whitespace-nowrap flex-shrink-0">{timeDisplay}</span>
                              )}
                              <span className="font-medium flex-1 group-hover/evt:underline">{evt.tieuDe}</span>
                            </div>
                            {isPending && <div className="text-[9px] font-bold mt-0.5 text-amber-700">Chưa duyệt</div>}
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
      ) : null}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {isReadOnlyModal ? 'Chi tiết Lịch sự kiện' : (editId ? 'Chỉnh sửa Lịch sự kiện' : 'Thêm Lịch sự kiện')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nội dung công tác <span className="text-red-500">*</span></label>
                <input disabled={isReadOnlyModal} className="input-field" placeholder="Nhập nội dung công tác..." value={form.tieuDe} onChange={e => setForm({...form, tieuDe: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày <span className="text-red-500">*</span></label>
                  <input disabled={isReadOnlyModal} type="date" className="input-field" value={form.ngay} onChange={e => setForm({...form, ngay: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Từ giờ</label>
                  <input disabled={isReadOnlyModal} type="time" className="input-field" value={form.gioBatDau} onChange={e => setForm({...form, gioBatDau: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đến giờ</label>
                  <input disabled={isReadOnlyModal} type="time" className="input-field" value={form.gioKetThuc} onChange={e => setForm({...form, gioKetThuc: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Địa điểm</label>
                <input disabled={isReadOnlyModal} className="input-field" placeholder="VD: Phòng họp A - Tầng 2" value={form.diaDiem} onChange={e => setForm({...form, diaDiem: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại lịch</label>
                <select disabled={isReadOnlyModal} className="input-field" value={form.loai} onChange={e => setForm({...form, loai: e.target.value})}>
                  {Object.entries(LOAI_LICH_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Người phụ trách <span className="text-red-500">*</span></label>
                  <select disabled={isReadOnlyModal} className="input-field" value={form.nguoiPhuTrachId || ''} onChange={e => setForm({...form, nguoiPhuTrachId: e.target.value})}>
                    <option value="">-- Chọn --</option>
                    {officerOptions.map(cb => <option key={cb.id} value={cb.id}>{buildDisplayName(cb.capBac, cb.hoTen)}</option>)}
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
                            disabled={isReadOnlyModal}
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
                              disabled={isReadOnlyModal}
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
                <textarea disabled={isReadOnlyModal} rows={2} className="input-field resize-none" placeholder="Ghi chú thêm..." value={form.ghiChu} onChange={e => setForm({...form, ghiChu: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              {editId && canUserDeleteSchedule(user, form) && (
                <button
                  onClick={() => {
                    setShowModal(false);
                    setDeleteConfirm({ id: editId, tieuDe: form.tieuDe || '' });
                  }}
                  className="btn-danger justify-center"
                >
                  Xóa
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              {!isReadOnlyModal && (
                <button onClick={handleSave} className="btn-primary flex-1 justify-center">{editId ? 'Lưu' : 'Thêm lịch'}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDutyDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Chi tiết Lịch trực</h3>
              <button onClick={() => setSelectedDutyDetail(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {selectedDutyDetail.items?.map((duty, idx) => (
                <div key={`${duty.id || idx}-${idx}`} className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                  <div className="font-semibold text-slate-900 mb-3 text-sm">
                    {duty.kieuTruc === 'giamdoc' ? '🎖️ Trực ban Giám đốc' : `📍 ${duty.viTri || 'Trực ban'}`}
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-slate-600">Cán bộ:</span>
                      <span className="text-slate-900 text-right">{duty.tenCanBo || 'Chưa phân công'}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-slate-600">Thời gian:</span>
                      <span className="text-slate-900 text-right">
                        {duty.gioBatDau && duty.gioKetThuc ? `${duty.gioBatDau} - ${duty.gioKetThuc}` : '00:00 - 24:00'}
                      </span>
                    </div>
                    {duty.ngay && (
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-slate-600">Ngày:</span>
                        <span className="text-slate-900 text-right">{duty.ngay}</span>
                      </div>
                    )}
                    
                  </div>
                </div>
              ))}
              {!selectedDutyDetail.items?.length && <div className="text-center text-slate-500 py-4">Không có dữ liệu lịch trực.</div>}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setSelectedDutyDetail(null)} className="btn-secondary w-full justify-center">Đóng</button>
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
                    <span>{buildDisplayName(cb.capBac, cb.hoTen)}</span>
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
            <h3 className="font-bold text-slate-800 mb-2">Xóa Lịch sự kiện?</h3>
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
                    alert(err?.message || 'Không thể xóa Lịch sự kiện.');
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
