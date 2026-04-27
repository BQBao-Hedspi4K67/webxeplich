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

const LapLichCongTac = ({ user, lichCongTacData = [], canBoData = [], departmentData = [], holidayData = [], dutyScheduleData = [], reloadData }) => {
  const canCreate = Boolean(
    user?.canCreateWorkSchedules
    || user?.backendRole === 'admin'
    || user?.backendRole === 'superadmin'
    || user?.backendRole === 'manager'
  );
  const canEdit = ['Quản trị viên', 'Quản lý'].includes(user?.role);

  const [data, setData] = useState(lichCongTacData);
  const [officerOptions, setOfficerOptions] = useState(canBoData || []);
  const [dutyData, setDutyData] = useState(dutyScheduleData || []);
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('lapLichCongTacViewMode') || 'month'); // 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(() => Number(sessionStorage.getItem('lapLichCongTacWeekOffset')) || 0);
  const [monthOffset, setMonthOffset] = useState(() => Number(sessionStorage.getItem('lapLichCongTacMonthOffset')) || 0);
  const [showModal, setShowModal] = useState(false);

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
          {canCreate && (
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
        <div className="card-lg p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Lịch tuần</h3>
            {canCreate && (
              <button onClick={() => openAdd(0)} className="btn-primary !py-1.5 !px-3 text-sm">
                <Plus size={14} /> Thêm lịch
              </button>
            )}
          </div>
          
          {/* Weekly table layout - Day | Session | Time | Details */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="px-4 py-3 text-left font-bold text-slate-700 bg-slate-100 w-1/6">Ngày/Tháng/Năm</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 bg-slate-100 w-1/8">Buổi</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 bg-slate-100 w-1/8">Giờ</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 bg-slate-100 flex-1">Chi tiết nội dung</th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((dayDate, dayIdx) => {
                  const dateStr = toDateOnly(dayDate);
                  const holiday = HOLIDAYS[dateStr];
                  const isWeekend = dayIdx === 5 || dayIdx === 6;
                  
                  // Get schedules for this day
                  const daySchedules = weekData.filter(l => l.ngay === dateStr);
                  
                  // Separate morning and afternoon schedules
                  const morningSchedules = daySchedules.filter(l => {
                    const hour = parseInt(String(l.gioBatDau || '00:00').split(':')[0]);
                    return hour < 12;
                  });
                  const afternoonSchedules = daySchedules.filter(l => {
                    const hour = parseInt(String(l.gioBatDau || '00:00').split(':')[0]);
                    return hour >= 12;
                  });
                  
                  // Get duty schedules for this day
                  const dayDuties = dutyData.filter(duty => {
                    const dutyDate = duty.date || duty.ngay;
                    return dutyDate === dateStr;
                  });

                  // Build rows for this day
                  const dayRows = [];
                  
                  // Morning session with duties
                  dayRows.push({
                    isFirstRow: true,
                    session: 'Sáng',
                    time: '00:00',
                    content: dayDuties,
                    schedules: [],
                    isDutyRow: true,
                  });
                  
                  // Morning work schedules
                  morningSchedules.forEach((sch, idx) => {
                    dayRows.push({
                      isFirstRow: false,
                      session: idx > 0 ? '' : '',
                      time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
                      schedules: [sch],
                      content: [],
                      isDutyRow: false,
                    });
                  });
                  
                  // Afternoon session
                  dayRows.push({
                    isFirstRow: false,
                    session: 'Chiều',
                    time: '',
                    content: [],
                    schedules: [],
                    isDutyRow: false,
                  });
                  
                  // Afternoon work schedules
                  afternoonSchedules.forEach((sch, idx) => {
                    dayRows.push({
                      isFirstRow: false,
                      session: '',
                      time: `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}`,
                      schedules: [sch],
                      content: [],
                      isDutyRow: false,
                    });
                  });

                  return dayRows.map((row, rowIdx) => (
                    <tr key={`${dateStr}-${rowIdx}`} className={`border-b border-slate-200 ${isWeekend ? 'bg-slate-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors`}>
                      {/* Day column - only on first row of the day */}
                      {rowIdx === 0 && (
                        <td rowSpan={dayRows.length} className={`px-4 py-3 align-top font-bold text-sm ${isWeekend ? 'bg-slate-100' : 'bg-white'} border-r border-slate-200`}>
                          <div className="text-slate-800">{formatDateWithDay(dayDate)}</div>
                          {holiday && <div className="text-xs text-red-600 font-semibold mt-1">{holiday}</div>}
                        </td>
                      )}
                      
                      {/* Session column */}
                      <td className="px-4 py-2 align-top text-center font-semibold text-slate-700 border-r border-slate-200">
                        {row.session || '—'}
                      </td>
                      
                      {/* Time column */}
                      <td className="px-4 py-2 align-top text-slate-600 text-xs font-semibold border-r border-slate-200 min-w-[80px]">
                        {row.time || '—'}
                      </td>
                      
                      {/* Content column */}
                      <td className="px-4 py-2 align-top text-slate-700">
                        {row.isDutyRow ? (
                          <div className="space-y-1 text-sm leading-6">
                            {(() => {
                              const sortedDutyItems = [...row.content].sort((a, b) => {
                                const slotA = Number(a.slotNo || 1);
                                const slotB = Number(b.slotNo || 1);
                                if (a.kieuTruc !== b.kieuTruc) return a.kieuTruc === 'giamdoc' ? -1 : 1;
                                if (a.viTri !== b.viTri) {
                                  const order = { 'Nhà hiệu bộ': 1, 'Lái xe': 2, 'Bệnh xá': 3, 'Trực ban Giám đốc': 0 };
                                  return (order[a.viTri] || 99) - (order[b.viTri] || 99);
                                }
                                return slotA - slotB;
                              });

                              const directorDuty = sortedDutyItems.find((d) => d.kieuTruc === 'giamdoc');
                              const canboDuties = sortedDutyItems.filter((d) => d.kieuTruc === 'canbo');

                              const slotLabel = (item) => {
                                if (item.viTri === 'Nhà hiệu bộ' && item.dutyRole === 'commander') return 'HB - Chỉ huy';
                                if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 1) return 'HB - Cán bộ 1';
                                if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 2) return 'HB - Cán bộ 2';
                                return item.viTri || 'Trực ban';
                              };

                              return (
                                <div>
                                  <div className="font-semibold text-slate-900">Trực ban Giám đốc: {directorDuty?.tenCanBo || 'Chưa phân công'}</div>
                                  <div className="mt-1 font-semibold text-slate-900">Trực ban cán bộ:</div>
                                  {canboDuties.length > 0 ? (
                                    <div className="pl-4">
                                      {canboDuties.map((item) => (
                                        <div key={`${item.viTri}-${item.dutyRole}-${item.slotNo}`}>
                                          {slotLabel(item)}: {item.tenCanBo || 'Chưa phân công'}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="pl-4 text-slate-500">Chưa phân công</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : row.schedules.length > 0 ? (
                          <div className="space-y-1 text-sm leading-6">
                            {row.schedules.map((sch) => {
                              const timeLabel = sch.gioBatDau || sch.gioKetThuc ? `${formatDisplayTime(sch.gioBatDau)} - ${formatDisplayTime(sch.gioKetThuc)}` : '';
                              const details = [sch.tieuDe, sch.diaDiem, sch.donVi].filter(Boolean).join(' - ');
                              return (
                                <div key={sch.id} className="text-slate-700">
                                  {timeLabel ? `${timeLabel} | ${details}` : details}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-slate-400">—</div>
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
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
                        const timeDisplay = evt.gioBatDau ? `${evt.gioBatDau.slice(0, 5)}` : '';
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
