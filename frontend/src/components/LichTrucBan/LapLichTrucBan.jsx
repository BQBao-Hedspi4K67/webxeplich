import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Edit2, Eye, Trash2, Shuffle } from 'lucide-react';
import { WEEK_DAYS } from '../../data/uiConstants';
import apiClient from '../../services/api';
import { confirmDialog } from '../../utils/notify';

const LOCATION = {
  HB: 'Nhà hiệu bộ',
  DRIVER: 'Lái xe',
  MEDIC: 'Bệnh xá',
  DIRECTOR: 'Trực ban Giám đốc',
};

const toDateOnly = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

const formatDDMM = (value) => {
  const s = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [, m, d] = s.split('-');
    return `${d}/${m}`;
  }
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const commanderEligible = (cb) => {
  if (!cb) return false;
  const position = String(cb.chucVu || '');
  return cb.vaiTro === 'Quản lý' || /(PT\s*Kh[oó]a|Ph[oó]\s*tr[uư][oở]ng\s*kh[oó]a|Tr[uư][oở]ng\s*ph[oò]ng|Trưởng\s*đội)/i.test(position);
};

const directorEligible = (cb) => {
  if (!cb) return false;
  return cb.vaiTro === 'Lãnh đạo' || String(cb.donVi || '').trim() === 'Ban Giám đốc';
};

const emptyDayForm = (date, dutyType) => ({
  date,
  dutyType,
  hbOfficer1: '',
  hbOfficer2: '',
  hbCommander: '',
  driver: '',
  medic: '',
  notes: '',
});

const MODE_STORAGE_KEY = 'lap-lich-truc-ban-mode';
const WEEK_OFFSET_STORAGE_KEY = 'lap-lich-truc-ban-week-offset';

const LapLichTrucBan = ({ user, lichTrucBanData = [], canBoData = [], holidayData = [], reloadData }) => {
  const canEdit = Boolean(user?.canManageDutySchedules) || user?.backendRole === 'admin' || user?.backendRole === 'superadmin' || user?.role === 'admin' || user?.role === 'Quản trị viên';
  const canGrantPermission =
    Boolean(user?.canGrantDutySchedulePermissions)
    || user?.backendRole === 'admin'
    || user?.backendRole === 'superadmin'
    || user?.role === 'Quản trị viên'
    || String(user?.department || '').trim() === 'Phòng hành chính tổng hợp';

  const [data, setData] = useState(lichTrucBanData);
  const [weekOffset, setWeekOffset] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const savedWeekOffset = Number(window.localStorage.getItem(WEEK_OFFSET_STORAGE_KEY));
    return Number.isFinite(savedWeekOffset) ? savedWeekOffset : 0;
  });
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'canbo';
    const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
    return ['canbo', 'trucle', 'giamdoc', 'thongke'].includes(savedMode) ? savedMode : 'canbo';
  });
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayForm, setDayForm] = useState(emptyDayForm(toDateOnly(new Date()), 'officer_daily'));
  const [editItem, setEditItem] = useState(null);
  const [singleOfficerId, setSingleOfficerId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isWeekAutoScheduled, setIsWeekAutoScheduled] = useState(false);
  const [isLoadingScheduleStatus, setIsLoadingScheduleStatus] = useState(false);
  const [permissionLoadingId, setPermissionLoadingId] = useState('');
  const [permissionResult, setPermissionResult] = useState({ type: '', message: '' });
  const [thongKePage, setThongKePage] = useState(1);
  const [phanQuyenPage, setPhanQuyenPage] = useState(1);
  const [selectedHolidayGroup, setSelectedHolidayGroup] = useState('all');

  const THONGKE_PAGE_SIZE = 8;
  const PHANQUYEN_PAGE_SIZE = 8;

  useEffect(() => {
    setData(lichTrucBanData);
  }, [lichTrucBanData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WEEK_OFFSET_STORAGE_KEY, String(weekOffset));
    }
  }, [weekOffset]);

  useEffect(() => {
    const checkAutoScheduledStatus = async () => {
      // Nếu là holiday mode, không check (cho phép xếp lại bao nhiêu lần tùy ý)
      if (!canEdit || mode === 'trucle' || mode === 'giamdoc') {
        setIsWeekAutoScheduled(false);
        return;
      }
      
      setIsLoadingScheduleStatus(true);
      try {
        // Tính weekStartDate trực tiếp từ weekOffset
        const weekStart = getWeekStart(weekOffset);
        const weekStartDate = toDateOnly(weekStart);
        
        const res = await apiClient.dutySchedules.checkAutoScheduled(weekStartDate, 'officer_daily');
        if (res?.data?.isScheduled) {
          setIsWeekAutoScheduled(true);
        } else {
          setIsWeekAutoScheduled(false);
        }
      } catch (err) {
        console.error('Lỗi kiểm tra auto schedule:', err);
        setIsWeekAutoScheduled(false);
      } finally {
        setIsLoadingScheduleStatus(false);
      }
    };

    checkAutoScheduledStatus();
  }, [weekOffset, mode, canEdit]);

  const weekStart = getWeekStart(weekOffset);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return toDateOnly(d);
    }),
    [weekStart]
  );

  const holidayEntries = useMemo(
    () => (holidayData || [])
      .filter((h) => String(h.loai || 'holiday') === 'holiday')
      .sort((a, b) => String(a.ngay).localeCompare(String(b.ngay))),
    [holidayData]
  );

  const holidayMap = useMemo(
    () => holidayEntries.reduce((acc, h) => {
      acc[toDateOnly(h.ngay)] = h.ten;
      return acc;
    }, {}),
    [holidayEntries]
  );

  const holidayDates = useMemo(
    () => Array.from(new Set(holidayEntries.map((h) => toDateOnly(h.ngay)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b)),
    [holidayEntries]
  );

  const holidayDatesSet = useMemo(() => new Set(holidayDates), [holidayDates]);

  const holidayGroups = useMemo(() => {
    const groups = {};

    holidayEntries.forEach((holiday) => {
      const date = toDateOnly(holiday.ngay);
      if (!date) return;

      const groupName = String(holiday.ten || '').trim() || `Ngày lễ ${date}`;
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(date);
    });

    return Object.entries(groups)
      .map(([name, dates]) => {
        const uniqueDates = Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
        return {
          key: name,
          label: name,
          dates: uniqueDates,
          startDate: uniqueDates[0],
          endDate: uniqueDates[uniqueDates.length - 1],
        };
      })
      .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
  }, [holidayEntries]);

  const visibleHolidayDates = useMemo(() => {
    if (selectedHolidayGroup === 'all') return holidayDates;

    const selectedGroup = holidayGroups.find((group) => group.key === selectedHolidayGroup);
    return selectedGroup?.dates || [];
  }, [holidayDates, holidayGroups, selectedHolidayGroup]);

  const weekLabel = `Tuần ${formatDDMM(weekDates[0])}-${formatDDMM(weekDates[6])}`;

  const officerWeekData = useMemo(
    () => data.filter((x) => x.loaiTruc === 'officer_daily' && weekDates.includes(x.ngay)),
    [data, weekDates]
  );

  const holidayDutyData = useMemo(
    () => data.filter((x) => x.loaiTruc === 'holiday_daily' && holidayDatesSet.has(x.ngay)),
    [data, holidayDatesSet]
  );

  const officerWeekDisplayData = useMemo(
    () => [...officerWeekData, ...holidayDutyData],
    [officerWeekData, holidayDutyData]
  );

  const directorWeekData = useMemo(
    () => data.filter((x) => {
      if (x.loaiTruc !== 'director_weekly') return false;
      const start = x.ngay;
      const end = x.denNgay || x.ngay;
      return start <= weekDates[6] && end >= weekDates[0];
    }),
    [data, weekDates]
  );

  // Thống kê trực của từng cán bộ
  const dutyStats = useMemo(() => {
    const stats = {};
    
    // Tạo object thống kê cho từng officer
    canBoData.forEach(cb => {
      stats[cb.id] = {
        id: cb.id,
        hoTen: cb.hoTen,
        vaiTro: cb.vaiTro,
        donVi: cb.donVi,
        ngayThuong: 0,
        cuoiTuan: 0,
        ngayLe: 0,
      };
    });

    // Đếm từ dữ liệu duty schedules
    data.forEach(x => {
      if (!stats[x.canBoId]) {
        stats[x.canBoId] = {
          id: x.canBoId,
          hoTen: '?',
          vaiTro: '',
          donVi: '',
          ngayThuong: 0,
          cuoiTuan: 0,
          ngayLe: 0,
        };
      }

      if (x.loaiTruc === 'holiday_daily') {
        stats[x.canBoId].ngayLe++;
      } else if (x.loaiTruc === 'officer_daily') {
        const dateObj = new Date(`${x.ngay}T00:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          stats[x.canBoId].cuoiTuan++;
        } else {
          stats[x.canBoId].ngayThuong++;
        }
      }
    });

    return Object.values(stats)
      .filter(s => s.ngayThuong > 0 || s.cuoiTuan > 0 || s.ngayLe > 0)
      .sort((a, b) => {
        const totalA = a.ngayThuong + a.cuoiTuan + a.ngayLe;
        const totalB = b.ngayThuong + b.cuoiTuan + b.ngayLe;
        return totalB - totalA;
      });
  }, [data, canBoData]);

  const thongKeTotalPages = Math.max(1, Math.ceil(dutyStats.length / THONGKE_PAGE_SIZE));
  const thongKePageSafe = Math.min(thongKePage, thongKeTotalPages);
  const thongKeRows = useMemo(() => {
    const start = (thongKePageSafe - 1) * THONGKE_PAGE_SIZE;
    return dutyStats.slice(start, start + THONGKE_PAGE_SIZE);
  }, [dutyStats, thongKePageSafe]);

  const phanQuyenCandidates = useMemo(
    () => canBoData.filter((item) => item.trangThai === 'active' && item.id !== user?.id),
    [canBoData, user?.id]
  );
  const phanQuyenTotalPages = Math.max(1, Math.ceil(phanQuyenCandidates.length / PHANQUYEN_PAGE_SIZE));
  const phanQuyenPageSafe = Math.min(phanQuyenPage, phanQuyenTotalPages);
  const phanQuyenRows = useMemo(() => {
    const start = (phanQuyenPageSafe - 1) * PHANQUYEN_PAGE_SIZE;
    return phanQuyenCandidates.slice(start, start + PHANQUYEN_PAGE_SIZE);
  }, [phanQuyenCandidates, phanQuyenPageSafe]);

  useEffect(() => {
    if (thongKePage > thongKeTotalPages) setThongKePage(thongKeTotalPages);
  }, [thongKePage, thongKeTotalPages]);

  useEffect(() => {
    if (phanQuyenPage > phanQuyenTotalPages) setPhanQuyenPage(phanQuyenTotalPages);
  }, [phanQuyenPage, phanQuyenTotalPages]);

  useEffect(() => {
    if (!holidayDates.length) {
      setSelectedHolidayGroup('all');
      return;
    }

    if (selectedHolidayGroup !== 'all' && !holidayGroups.some((group) => group.key === selectedHolidayGroup)) {
      setSelectedHolidayGroup('all');
    }
  }, [holidayDates, holidayGroups, selectedHolidayGroup]);

  const activeOfficers = useMemo(() => canBoData.filter((x) => x.trangThai === 'active'), [canBoData]);
  const hbOfficerOptions = useMemo(() => activeOfficers.filter((x) => x.vaiTro === 'Cán bộ'), [activeOfficers]);
  const commanderOptions = useMemo(() => activeOfficers.filter(commanderEligible), [activeOfficers]);
  const directorOptions = useMemo(() => activeOfficers.filter(directorEligible), [activeOfficers]);
  const driverOptions = useMemo(() => activeOfficers.filter((x) => x.donVi === 'Đội lái xe' && x.vaiTro === 'Cán bộ'), [activeOfficers]);
  const medicOptions = useMemo(() => activeOfficers.filter((x) => x.donVi === 'Đội bệnh xá' && x.vaiTro === 'Cán bộ'), [activeOfficers]);

  const renderDutyCell = (slot, emptyText = 'Chưa phân công') => (
    slot ? (
      <div className="relative group">
        <button
          onClick={() => openEditSingle(slot)}
          className="text-left w-full h-12 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center gap-2"
          title="Chi tiết"
          aria-label="Chi tiết"
        >
          <Eye size={14} className="text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 line-clamp-1 whitespace-nowrap">{slot.tenCanBo}</div>
            <div className="text-xs text-slate-400 font-mono">{slot.canBoId}</div>
          </div>
        </button>
        {/* Nút bút chỉnh sửa */}
        <button
          onClick={() => openEditSingle(slot)}
          className="absolute top-1 right-1 p-1 rounded-full bg-white border border-slate-200 shadow hover:bg-blue-50 hover:text-blue-600 text-slate-400 group-hover:visible invisible"
          title="Đổi người trực"
        >
          <Edit2 size={13} />
        </button>
      </div>
    ) : <span className="text-slate-400 text-sm">{emptyText}</span>
  );

  const getSlot = (items, location, dutyRole, slotNo) => items.find(
    (x) => x.viTri === location && String(x.vaiTroTruc || 'officer') === dutyRole && Number(x.slotNo || 1) === slotNo
  );

  const openDayAssign = (date, dutyType) => {
    const source = dutyType === 'holiday_daily' ? holidayDutyData : officerWeekData;
    const dayItems = source.filter((x) => x.ngay === date);
    const form = {
      date,
      dutyType,
      hbOfficer1: getSlot(dayItems, LOCATION.HB, 'officer', 1)?.canBoId || '',
      hbOfficer2: getSlot(dayItems, LOCATION.HB, 'officer', 2)?.canBoId || '',
      hbCommander: getSlot(dayItems, LOCATION.HB, 'commander', 1)?.canBoId || '',
      driver: getSlot(dayItems, LOCATION.DRIVER, 'officer', 1)?.canBoId || '',
      medic: getSlot(dayItems, LOCATION.MEDIC, 'officer', 1)?.canBoId || '',
      notes: dayItems[0]?.ghiChu || '',
    };
    setEditItem(null);
    setSingleOfficerId('');
    setDayForm(form);
    setShowDayModal(true);
  };

  const openEditSingle = (item) => {
    setEditItem(item);
    setSingleOfficerId(item.canBoId);
    setShowDayModal(false);
  };

  const getOptionsForSlot = (item) => {
    if (!item) return activeOfficers;
    if (item.viTri === LOCATION.HB && (item.vaiTroTruc || 'officer') === 'commander') return commanderOptions;
    if (item.viTri === LOCATION.DRIVER) return driverOptions;
    if (item.viTri === LOCATION.MEDIC) return medicOptions;
    if (item.viTri === LOCATION.DIRECTOR) return directorOptions;
    return hbOfficerOptions;
  };

  const handleSaveDay = async () => {
    const payload = [
      { location: LOCATION.HB, dutyRole: 'officer', slotNo: 1, officerId: dayForm.hbOfficer1 },
      { location: LOCATION.HB, dutyRole: 'officer', slotNo: 2, officerId: dayForm.hbOfficer2 },
      { location: LOCATION.HB, dutyRole: 'commander', slotNo: 1, officerId: dayForm.hbCommander },
      { location: LOCATION.DRIVER, dutyRole: 'officer', slotNo: 1, officerId: dayForm.driver },
      { location: LOCATION.MEDIC, dutyRole: 'officer', slotNo: 1, officerId: dayForm.medic },
    ];

    if (payload.some((x) => !x.officerId)) {
      alert('Vui lòng chọn đủ 5 vị trí trực.');
      return;
    }

    try {
      // Xóa hết lịch trực cũ của ngày này trước khi tạo mới
      const oldItems = data.filter(x => x.ngay === dayForm.date && x.loaiTruc === dayForm.dutyType);
      for (const item of oldItems) {
        await apiClient.dutySchedules.delete(item.id);
      }
      await apiClient.dutySchedules.create({
        dutyType: dayForm.dutyType,
        date: dayForm.date,
        shift: 'nguyenday',
        notes: dayForm.notes || '',
        bulkAssignments: payload,
      });
      if (reloadData) await reloadData();
      setShowDayModal(false);
    } catch (err) {
      alert(err?.message || 'Không thể lưu lịch trực ban.');
    }
  };

  const handleSaveSingle = async () => {
    if (!editItem || !singleOfficerId) return;

    if ((editItem.viTri || LOCATION.DIRECTOR) === LOCATION.DIRECTOR && !directorOptions.some((x) => x.id === singleOfficerId)) {
      alert('Trực ban Giám đốc chỉ được gán cho cán bộ Ban Giám đốc.');
      return;
    }

    // Nếu không đổi người trực thì không gọi API update
    if (editItem.canBoId === singleOfficerId) {
      setEditItem(null);
      setSingleOfficerId('');
      return;
    }

    try {
      await apiClient.dutySchedules.update(editItem.id, {
        officerId: singleOfficerId,
        date: editItem.ngay,
        location: editItem.viTri,
        dutyRole: editItem.vaiTroTruc,
        slotNo: editItem.slotNo,
        dutyType: editItem.loaiTruc,
      });
      if (reloadData) await reloadData();
      setEditItem(null);
      setSingleOfficerId('');
    } catch (err) {
      // Nếu lỗi 409 (trùng cán bộ trực), hiển thị rõ thông báo từ backend
      if (err?.response?.status === 409 && err?.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert(err?.message || 'Không thể cập nhật lịch trực.');
      }
    }
  };

  const deleteItem = async (item) => {
    try {
      await apiClient.dutySchedules.delete(item.id);
      if (reloadData) await reloadData();
      setDeleteConfirm(null);
    } catch (err) {
      alert(err?.message || 'Không thể xóa lịch trực ban.');
    }
  };

  const handleToggleDutySchedulePermission = async (officer) => {
    if (!officer?.id) return;
    setPermissionResult({ type: '', message: '' });

    try {
      setPermissionLoadingId(officer.id);
      await apiClient.officers.updateDutySchedulePermission(officer.id, !officer.canManageDutySchedulesByPermission);
      if (reloadData) await reloadData();
      setPermissionResult({
        type: 'success',
        message: `${!officer.canManageDutySchedulesByPermission ? 'Đã cấp' : 'Đã thu hồi'} quyền lịch trực cho ${officer.hoTenDayDu || officer.hoTen}.`,
      });
    } catch (err) {
      setPermissionResult({
        type: 'error',
        message: err?.message || 'Không thể cập nhật quyền lịch trực.',
      });
    } finally {
      setPermissionLoadingId('');
    }
  };

  const handleAutoAssign = async () => {
    if (!canEdit) return;

    const isHolidayMode = mode === 'trucle';
    const holidayStart = holidayDates[0] || weekDates[0];
    const holidayEnd = holidayDates[holidayDates.length - 1] || weekDates[6];
    const confirmed = await confirmDialog({
      title: 'Xác nhận tự động xếp lịch',
      text: isHolidayMode
        ? `Tự động xếp Trực lễ cho giai đoạn ${formatDDMM(holidayStart)}-${formatDDMM(holidayEnd)}?`
        : `Tự động xếp trực cán bộ cho tuần ${formatDDMM(weekDates[0])}-${formatDDMM(weekDates[6])}?`,
      confirmText: 'Xếp lịch',
      cancelText: 'Hủy',
    });
    if (!confirmed) return;

    try {
      setIsAutoAssigning(true);
      const res = isHolidayMode
        ? await apiClient.dutySchedules.autoAssignHoliday({ fromDate: holidayStart, toDate: holidayEnd })
        : await apiClient.dutySchedules.autoAssignWeek(weekDates[0]);
      if (reloadData) await reloadData();
      
      // Mark this week/period as auto-scheduled
      if (!isHolidayMode) {
        setIsWeekAutoScheduled(true);
      }
      
      alert(res?.message || 'Đã tự động xếp lịch.');
    } catch (err) {
      alert(err?.message || 'Không thể tự động xếp lịch.');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const renderDayTable = (sourceRows, dutyType) => {
    return (
      <div className="card-lg p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="table-th px-2 py-2.5">Ngày</th>
                <th className="table-th px-2 py-2.5">HB - Cán bộ 1</th>
                <th className="table-th px-2 py-2.5">HB - Cán bộ 2</th>
                <th className="table-th px-2 py-2.5">HB - Chỉ huy</th>
                <th className="table-th px-2 py-2.5">Lái xe</th>
                <th className="table-th px-2 py-2.5">Bệnh xá</th>
                <th className="table-th px-2 py-2.5 sticky right-0 z-20 bg-slate-50 text-center w-[76px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {weekDates.map((date, idx) => {
                const holidayName = holidayMap[date] || '';
                const isHoliday = Boolean(holidayName);
                const dayItems = sourceRows.filter((x) => {
                  if (x.ngay !== date) return false;
                  if (isHoliday) return x.loaiTruc === 'holiday_daily';
                  return x.loaiTruc === 'officer_daily';
                });
                const slot1 = getSlot(dayItems, LOCATION.HB, 'officer', 1);
                const slot2 = getSlot(dayItems, LOCATION.HB, 'officer', 2);
                const slotCommander = getSlot(dayItems, LOCATION.HB, 'commander', 1);
                const slotDriver = getSlot(dayItems, LOCATION.DRIVER, 'officer', 1);
                const slotMedic = getSlot(dayItems, LOCATION.MEDIC, 'officer', 1);

                const blocked = dutyType === 'officer_daily' && isHoliday;
                const assignDutyType = blocked ? 'holiday_daily' : dutyType;

                return (
                  <tr key={`${dutyType}-${date}`} className="group hover:bg-slate-50/70">
                    <td className="table-td px-2 py-2">
                      <div className="font-semibold text-slate-700 whitespace-nowrap inline-block">{WEEK_DAYS[idx]}</div>
                      <div className="text-xs text-slate-400 whitespace-nowrap inline ml-2">{formatDDMM(date)}</div>
                      {holidayName && <div className="text-[11px] text-red-600 font-semibold mt-1">{holidayName}</div>}
                    </td>
                    <td className="table-td px-2 py-2">{renderDutyCell(slot1)}</td>
                    <td className="table-td px-2 py-2">{renderDutyCell(slot2)}</td>
                    <td className="table-td px-2 py-2">{renderDutyCell(slotCommander)}</td>
                    <td className="table-td px-2 py-2">{renderDutyCell(slotDriver)}</td>
                    <td className="table-td px-2 py-2">{renderDutyCell(slotMedic)}</td>
                    <td className="table-td px-2 py-2 sticky right-0 z-10 bg-white group-hover:bg-slate-50/95 text-center">
                      {canEdit && (
                        <button
                          onClick={() => openDayAssign(date, assignDutyType)}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${blocked
                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                          }`}
                          title={blocked ? 'Sửa trực lễ' : 'Thiết lập ngày'}
                          aria-label={blocked ? 'Sửa trực lễ' : 'Thiết lập ngày'}
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      {blocked && dayItems.length === 0 && (
                        <span className="text-xs text-amber-600 font-semibold">Chưa có trực lễ</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHolidayList = () => {
    if (!holidayDates.length) {
      return (
        <div className="card text-center py-10 text-slate-400">
          Chưa có ngày lễ nào trong dữ liệu.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="card-lg p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Chọn ngày lễ</label>
            <select
              className="input-field md:max-w-md"
              value={selectedHolidayGroup}
              onChange={(e) => setSelectedHolidayGroup(e.target.value)}
            >
              <option value="all">Tất cả ngày lễ</option>
              {holidayGroups.map((group) => (
                <option key={`holiday-filter-${group.key}`} value={group.key}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibleHolidayDates.map((date) => {
          const holidayName = holidayMap[date] || 'Ngày lễ';
          const dayItems = holidayDutyData.filter((x) => x.ngay === date);
          const slot1 = getSlot(dayItems, LOCATION.HB, 'officer', 1);
          const slot2 = getSlot(dayItems, LOCATION.HB, 'officer', 2);
          const slotCommander = getSlot(dayItems, LOCATION.HB, 'commander', 1);
          const slotDriver = getSlot(dayItems, LOCATION.DRIVER, 'officer', 1);
          const slotMedic = getSlot(dayItems, LOCATION.MEDIC, 'officer', 1);

          return (
            <div key={`holiday-${date}`} className="card-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-red-600">{holidayName}</div>
                  <h3 className="text-lg font-bold text-slate-800">{formatDDMM(date)}</h3>
                  
                </div>
                {canEdit && (
                  <button
                    onClick={() => openDayAssign(date, 'holiday_daily')}
                    className="btn-secondary"
                  >
                    Thiết lập ngày
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">HB - Cán bộ 1</div>
                  {renderDutyCell(slot1)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">HB - Cán bộ 2</div>
                  {renderDutyCell(slot2)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">HB - Chỉ huy</div>
                  {renderDutyCell(slotCommander)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">Lái xe</div>
                  {renderDutyCell(slotDriver)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">Bệnh xá</div>
                  {renderDutyCell(slotMedic)}
                </div>
              </div>

              {dayItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Chưa có phân công trực lễ cho ngày này.
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderThongKe = () => {
    return (
      <div className="card-lg p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                <th className="table-th">Họ và tên</th>
                <th className="table-th">Chức vụ</th>
                <th className="table-th">Đơn vị</th>
                <th className="table-th text-center">Ngày thường</th>
                <th className="table-th text-center">Cuối tuần</th>
                <th className="table-th text-center">Ngày lễ</th>
                <th className="table-th text-center font-bold">Tổng cộng</th>
              </tr>
            </thead>
            <tbody>
              {dutyStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center py-8 text-slate-400">
                    Chưa có dữ liệu thống kê
                  </td>
                </tr>
              ) : (
                thongKeRows.map((stat, idx) => {
                  const total = stat.ngayThuong + stat.cuoiTuan + stat.ngayLe;
                  return (
                    <tr key={stat.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                            {stat.hoTen.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{stat.hoTen}</div>
                            <div className="text-xs text-slate-400">{stat.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-slate-600">{stat.vaiTro}</span>
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-slate-600">{stat.donVi}</span>
                      </td>
                      <td className="table-td text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
                          {stat.ngayThuong}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 text-sm font-bold text-orange-700">
                          {stat.cuoiTuan}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-sm font-bold text-red-700">
                          {stat.ngayLe}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-sm font-bold text-blue-700">
                          {total}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {dutyStats.length > THONGKE_PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-white">
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
              onClick={() => setThongKePage((p) => Math.max(1, p - 1))}
              disabled={thongKePageSafe <= 1}
            >
              Trước
            </button>
            <span className="text-sm text-slate-500">Trang {thongKePageSafe}/{thongKeTotalPages}</span>
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
              onClick={() => setThongKePage((p) => Math.min(thongKeTotalPages, p + 1))}
              disabled={thongKePageSafe >= thongKeTotalPages}
            >
              Sau
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPhanQuyen = () => {
    if (!canGrantPermission) {
      return (
        <div className="card text-center py-10 text-slate-400">
          Bạn không có quyền cấp quyền lập/sửa lịch trực.
        </div>
      );
    }

    return (
      <div className="card-lg p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Cấp quyền tạo/sửa lịch trực</h3>
          
          {permissionResult.message && (
            <div className={`text-sm rounded-xl px-3 py-2 mt-3 ${permissionResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {permissionResult.message}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr>
                <th className="table-th">Họ và tên</th>
                <th className="table-th">Chức vụ</th>
                <th className="table-th">Đơn vị</th>
                <th className="table-th">Loại quyền</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {phanQuyenRows.map((item) => {
                  const hasDepartmentAccess = Boolean(item.canManageDutySchedulesByDepartment);
                  const hasGrantedAccess = Boolean(item.canManageDutySchedulesByPermission);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="table-td font-semibold text-slate-800">{item.hoTenDayDu || item.hoTen}</td>
                      <td className="table-td text-slate-600">{item.chucVu || 'Chưa cập nhật'}</td>
                      <td className="table-td text-slate-600">{item.donVi || 'Chưa cập nhật'}</td>
                      <td className="table-td">
                        {hasDepartmentAccess ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Theo đơn vị</span>
                        ) : hasGrantedAccess ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700">Được cấp riêng</span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-500">Chưa cấp</span>
                        )}
                      </td>
                      <td className="table-td">
                        <button
                          type="button"
                          disabled={permissionLoadingId === item.id || hasDepartmentAccess}
                          onClick={() => handleToggleDutySchedulePermission(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${hasDepartmentAccess ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : hasGrantedAccess ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                        >
                          {permissionLoadingId === item.id
                            ? 'Đang lưu...'
                            : hasDepartmentAccess
                              ? 'Quyền theo đơn vị'
                              : hasGrantedAccess
                                ? 'Thu hồi quyền'
                                : 'Cấp quyền'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {phanQuyenCandidates.length > PHANQUYEN_PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-white">
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
              onClick={() => setPhanQuyenPage((p) => Math.max(1, p - 1))}
              disabled={phanQuyenPageSafe <= 1}
            >
              Trước
            </button>
            <span className="text-sm text-slate-500">Trang {phanQuyenPageSafe}/{phanQuyenTotalPages}</span>
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
              onClick={() => setPhanQuyenPage((p) => Math.min(phanQuyenTotalPages, p + 1))}
              disabled={phanQuyenPageSafe >= phanQuyenTotalPages}
            >
              Sau
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">


      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lập lịch trực ban</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode('canbo')} className={`px-3 py-2 rounded-xl text-sm font-medium ${mode === 'canbo' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Trực cán bộ
          </button>
          <button onClick={() => setMode('trucle')} className={`px-3 py-2 rounded-xl text-sm font-medium ${mode === 'trucle' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Trực lễ
          </button>
          <button onClick={() => setMode('giamdoc')} className={`px-3 py-2 rounded-xl text-sm font-medium ${mode === 'giamdoc' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Trực ban Giám đốc
          </button>
          <button onClick={() => setMode('thongke')} className={`px-3 py-2 rounded-xl text-sm font-medium ${mode === 'thongke' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Thống kê
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {mode !== 'trucle' && mode !== 'thongke' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <span className="px-3 text-sm font-semibold text-slate-700 min-w-[170px] text-center">{weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight size={16} /></button>
          </div>
        )}

        {canEdit && mode !== 'giamdoc' && mode !== 'thongke' && (
          <button 
            onClick={handleAutoAssign} 
            disabled={isAutoAssigning || isWeekAutoScheduled || isLoadingScheduleStatus}
            title={isWeekAutoScheduled ? 'Tuần này đã được tự động xếp lịch rồi' : ''}
            className={`btn-secondary ${isWeekAutoScheduled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Shuffle size={16} /> {isAutoAssigning ? 'Đang xếp...' : isWeekAutoScheduled ? 'Đã xếp (không được xếp lại)' : (mode === 'trucle' ? 'Tự động xếp ngày lễ' : 'Tự động xếp tuần này')}
          </button>
        )}

        {canEdit && mode === 'giamdoc' && (
          <button
            onClick={() => {
              setEditItem({ loaiTruc: 'director_weekly', ngay: weekDates[0], denNgay: weekDates[6], viTri: LOCATION.DIRECTOR, canBoId: '' });
              setSingleOfficerId('');
            }}
            className="btn-primary"
          >
            <Plus size={16} /> Gán trực giám đốc
          </button>
        )}
      </div>

      {mode === 'canbo' && renderDayTable(officerWeekDisplayData, 'officer_daily')}
      {mode === 'trucle' && renderHolidayList()}
      {mode === 'thongke' && renderThongKe()}

      {mode === 'giamdoc' && (
        <div className="card">
          {directorWeekData.length > 0 ? (
            <div className="space-y-3">
              {directorWeekData.map((item) => (
                <div key={item.id} className="border border-violet-200 bg-violet-50/40 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-violet-800">Trực ban Giám đốc - {formatDDMM(item.ngay)} đến {formatDDMM(item.denNgay || item.ngay)}</h3>
                      <p className="text-sm text-violet-700 mt-1">{item.tenCanBo} ({item.canBoId})</p>
                      <p className="text-xs text-slate-500 mt-1">Đơn vị: {item.donVi || '-'}</p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditItem(item); setSingleOfficerId(item.canBoId || ''); }} className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(item)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">Chưa có phân công trực ban giám đốc cho {weekLabel}.</div>
          )}
        </div>
      )}

      {showDayModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Thiết lập trực ngày {dayForm.date}</h3>
              <button onClick={() => setShowDayModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nhà hiệu bộ - Cán bộ 1</label>
                <select className="input-field" value={dayForm.hbOfficer1} onChange={(e) => setDayForm((p) => ({ ...p, hbOfficer1: e.target.value }))}>
                  <option value="">-- Chọn cán bộ --</option>
                  {hbOfficerOptions.map((cb) => <option key={cb.id} value={cb.id}>{cb.hoTen} - {cb.donVi}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nhà hiệu bộ - Cán bộ 2</label>
                <select className="input-field" value={dayForm.hbOfficer2} onChange={(e) => setDayForm((p) => ({ ...p, hbOfficer2: e.target.value }))}>
                  <option value="">-- Chọn cán bộ --</option>
                  {hbOfficerOptions.map((cb) => <option key={cb.id} value={cb.id}>{cb.hoTen} - {cb.donVi}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nhà hiệu bộ - Chỉ huy (PT Khóa/Trưởng phòng)</label>
                <select className="input-field" value={dayForm.hbCommander} onChange={(e) => setDayForm((p) => ({ ...p, hbCommander: e.target.value }))}>
                  <option value="">-- Chọn chỉ huy --</option>
                  {commanderOptions.map((cb) => <option key={cb.id} value={cb.id}>{cb.hoTen} - {cb.chucVu}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lái xe</label>
                <select className="input-field" value={dayForm.driver} onChange={(e) => setDayForm((p) => ({ ...p, driver: e.target.value }))}>
                  <option value="">-- Chọn cán bộ đội lái xe --</option>
                  {driverOptions.map((cb) => <option key={cb.id} value={cb.id}>{cb.hoTen}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Bệnh xá</label>
                <select className="input-field" value={dayForm.medic} onChange={(e) => setDayForm((p) => ({ ...p, medic: e.target.value }))}>
                  <option value="">-- Chọn cán bộ đội bệnh xá --</option>
                  {medicOptions.map((cb) => <option key={cb.id} value={cb.id}>{cb.hoTen}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowDayModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleSaveDay} className="btn-primary flex-1 justify-center">Lưu phân công</button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Cập nhật phân công</h3>
              <button onClick={() => { setEditItem(null); setSingleOfficerId(''); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-sm text-slate-600">
                {editItem.viTri || LOCATION.DIRECTOR} - {editItem.ngay}
              </div>
              <select className="input-field" value={singleOfficerId} onChange={(e) => setSingleOfficerId(e.target.value)}>
                <option value="">-- Chọn cán bộ --</option>
                {getOptionsForSlot(editItem).map((cb) => (
                  <option key={cb.id} value={cb.id}>{cb.hoTen} - {cb.chucVu || cb.donVi}</option>
                ))}
              </select>
              {(editItem.viTri || LOCATION.DIRECTOR) === LOCATION.DIRECTOR && (
                <p className="text-xs text-slate-500 mt-2">Chỉ hiển thị cán bộ Ban Giám đốc.</p>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setEditItem(null); setSingleOfficerId(''); }} className="btn-secondary flex-1 justify-center">Hủy</button>
              {editItem.id && (
                <button onClick={() => setDeleteConfirm(editItem)} className="btn-danger flex-1 justify-center">Xóa lịch</button>
              )}
              <button
                onClick={async () => {
                  if (!singleOfficerId) return;
                  if (!editItem.id) {
                    try {
                      await apiClient.dutySchedules.create({
                        dutyType: 'director_weekly',
                        officerId: singleOfficerId,
                        date: editItem.ngay,
                        endDate: editItem.denNgay || editItem.ngay,
                        shift: 'tuan',
                        location: LOCATION.DIRECTOR,
                        dutyRole: 'commander',
                        slotNo: 1,
                      });
                      if (reloadData) await reloadData();
                      setEditItem(null);
                      setSingleOfficerId('');
                    } catch (err) {
                      alert(err?.message || 'Không thể tạo lịch trực giám đốc.');
                    }
                    return;
                  }
                  await handleSaveSingle();
                }}
                className="btn-primary flex-1 justify-center"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="font-bold text-slate-800 mb-2">Xóa lịch trực?</h3>
            <p className="text-sm text-slate-500 mb-5">Bạn có chắc muốn xóa lịch trực của <span className="font-semibold text-slate-700">{deleteConfirm.tenCanBo || deleteConfirm.canBoId || ''}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={() => deleteItem(deleteConfirm)} className="btn-danger flex-1 justify-center">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LapLichTrucBan;
