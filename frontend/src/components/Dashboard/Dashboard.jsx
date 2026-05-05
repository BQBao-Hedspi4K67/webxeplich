import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import WeekGridSchedule from '../WeekGridSchedule/WeekGridSchedule';
import { LOAI_LICH_COLORS } from '../../data/uiConstants';
import apiClient from '../../services/api';

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDDMM = (date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

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
  night: 'Danh sách trực',
  morning: 'Sáng\n(08:00-16:00)',
  afternoon: 'Chiều\n(16:00-24:00)',
};

const buildSlotLabel = (item) => {
  if (item.viTri === 'Nhà hiệu bộ' && item.vaiTroTruc === 'commander') return 'TB - Chỉ huy';
  if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 1) return 'TB - Cán bộ 1';
  if (item.viTri === 'Nhà hiệu bộ' && Number(item.slotNo || 1) === 2) return 'TB - Cán bộ 2';
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

  const groupedSchedules = {
    night: [...scheduleItems].filter((evt) => getSessionBucket(evt.gioBatDau) === 'night').sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || ''))),
    morning: [...scheduleItems].filter((evt) => getSessionBucket(evt.gioBatDau) === 'morning').sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || ''))),
    afternoon: [...scheduleItems].filter((evt) => getSessionBucket(evt.gioBatDau) === 'afternoon').sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || ''))),
  };

  const rows = [];

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

const initialForm = {
  tieuDe: '',
  ngay: formatLocalDate(new Date()),
  gioBatDau: '08:00',
  gioKetThuc: '10:00',
  diaDiem: '',
  nguoiPhuTrachId: '',
  thanhPhanThamGia: [],
  bgdMemberIds: [],
  loai: 'hop',
  ghiChu: '',
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

const Dashboard = ({
  user,
  onNavigate,
  canBoData = [],
  departmentData = [],
  lichCongTacData = [],
  lichTrucBanData = [],
  holidayData = [],
  reloadData,
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDutyDetail, setSelectedDutyDetail] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);

  const HOLIDAYS = holidayData.reduce((acc, h) => {
    if (h?.ngay) acc[h.ngay] = h.ten;
    return acc;
  }, {});

  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const d_str = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${d_str}`;
  };

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

  // Prepare weekly data for all duties and schedules
  const weekDuties = lichTrucBanData.filter((l) => {
    if (l.kieuTruc === 'canbo') {
      return weekDates.includes(l.ngay);
    }
    const start = l.ngay;
    const end = l.denNgay || l.ngay;
    return l.kieuTruc === 'giamdoc' && start <= weekDates[6] && end >= weekDates[0];
  });
  
  const weekSchedules = lichCongTacData.filter((l) => weekDates.includes(l.ngay));

  const participantUnits = (departmentData || []).length
    ? Array.from(new Set((departmentData || []).map((d) => d.name).filter(Boolean)))
    : Array.from(new Set((canBoData || []).map((cb) => cb.donVi).filter(Boolean)));

  const officerOptions = (canBoData || []).filter((item) => !item.trangThai || item.trangThai === 'active');

  const handleGridEventClick = (event) => {
    if (event.eventType === 'duty') {
      setSelectedDutyDetail(event);
      return;
    }

    const participants = event.participants || {};
    setForm({
      ...event,
      nguoiPhuTrachId: event.nguoiPhuTrachId || event.canBoTrucChiHuyId || '',
      thanhPhanThamGia: Array.isArray(participants.units) ? participants.units : [],
      bgdMemberIds: Array.isArray(participants.boardMembers) ? participants.boardMembers : [],
    });
    setEditId(event.id);
    setIsReadOnlyModal(!canUserEditSchedule(user, event));
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (isReadOnlyModal || !editId) return;
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
      weekNo: getIsoWeekNo(`${form.ngay}T00:00:00`),
      notes: form.ghiChu || '',
    };

    try {
      await apiClient.workSchedules.update(editId, payload);
      if (reloadData) await reloadData();
      setShowScheduleModal(false);
    } catch (err) {
      alert(err?.message || 'Không thể lưu Lịch sự kiện.');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!editId || !canUserDeleteSchedule(user, form)) return;
    const ok = window.confirm(`Bạn có chắc muốn xóa lịch "${form.tieuDe || ''}"?`);
    if (!ok) return;

    try {
      await apiClient.workSchedules.delete(editId);
      if (reloadData) await reloadData();
      setShowScheduleModal(false);
    } catch (err) {
      alert(err?.message || 'Không thể xóa Lịch sự kiện.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Lịch công tác</h3>

          </div>
          <button onClick={() => onNavigate('lichcongtac')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Mở lịch chi tiết <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              onClick={() => setWeekOffset((offset) => offset - 1)}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all"
            >
              &lt;
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-800">{weekLabel}</div>

            </div>
            <button
              onClick={() => setWeekOffset((offset) => offset + 1)}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all"
            >
              &gt;
            </button>
          </div>

          <WeekGridSchedule
            weekDates={weekDates}
            duties={weekDuties}
            schedules={weekSchedules}
            holidays={HOLIDAYS}
            onSelectEvent={handleGridEventClick}
          />
        </div>
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {isReadOnlyModal ? 'Chi tiết Lịch sự kiện' : 'Chỉnh sửa Lịch sự kiện'}
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nội dung công tác <span className="text-red-500">*</span></label>
                <input disabled={isReadOnlyModal} className="input-field" value={form.tieuDe || ''} onChange={e => setForm({ ...form, tieuDe: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày <span className="text-red-500">*</span></label>
                  <input disabled={isReadOnlyModal} type="date" className="input-field" value={form.ngay || ''} onChange={e => setForm({ ...form, ngay: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Từ giờ</label>
                  <input disabled={isReadOnlyModal} type="time" className="input-field" value={form.gioBatDau || ''} onChange={e => setForm({ ...form, gioBatDau: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đến giờ</label>
                  <input disabled={isReadOnlyModal} type="time" className="input-field" value={form.gioKetThuc || ''} onChange={e => setForm({ ...form, gioKetThuc: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Địa điểm</label>
                <input disabled={isReadOnlyModal} className="input-field" value={form.diaDiem || ''} onChange={e => setForm({ ...form, diaDiem: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại lịch</label>
                <select disabled={isReadOnlyModal} className="input-field" value={form.loai || 'hop'} onChange={e => setForm({ ...form, loai: e.target.value })}>
                  {Object.entries(LOAI_LICH_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Người phụ trách <span className="text-red-500">*</span></label>
                <select disabled={isReadOnlyModal} className="input-field" value={form.nguoiPhuTrachId || ''} onChange={e => setForm({ ...form, nguoiPhuTrachId: e.target.value })}>
                  <option value="">-- Chọn --</option>
                  {officerOptions.map(cb => <option key={cb.id} value={cb.id}>{buildDisplayName(cb.capBac, cb.hoTen)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Thành phần tham gia <span className="text-red-500">*</span></label>
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto bg-slate-50/40">
                  {participantUnits.map((unit) => {
                    const checked = (form.thanhPhanThamGia || []).includes(unit);
                    return (
                      <label key={unit} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          disabled={isReadOnlyModal}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...(form.thanhPhanThamGia || []), unit]
                              : (form.thanhPhanThamGia || []).filter((x) => x !== unit);
                            setForm({ ...form, thanhPhanThamGia: next });
                          }}
                        />
                        <span>{unit}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ghi chú</label>
                <textarea disabled={isReadOnlyModal} rows={2} className="input-field resize-none" value={form.ghiChu || ''} onChange={e => setForm({ ...form, ghiChu: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              {editId && canUserDeleteSchedule(user, form) && !isReadOnlyModal && (
                <button onClick={handleDeleteSchedule} className="btn-danger justify-center">Xóa</button>
              )}
              <button onClick={() => setShowScheduleModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              {!isReadOnlyModal && (
                <button onClick={handleSaveSchedule} className="btn-primary flex-1 justify-center">Lưu</button>
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
                    {duty.kieuTruc === 'giamdoc' ? 'Trực ban Giám đốc' : `${duty.viTri || 'Trực ban'}`}
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
    </div>
  );
};

export default Dashboard;
