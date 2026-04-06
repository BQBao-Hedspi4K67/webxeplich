import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2, ShieldCheck, Users, Star, Shuffle } from 'lucide-react';
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
  return cb.vaiTro === 'Quản lý' || /(PT\s*Kh[oó]a|Ph[oó]\s*tr[uư][oở]ng\s*kh[oó]a|Tr[uư][oở]ng\s*ph[oò]ng)/i.test(position);
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

const LapLichTrucBan = ({ user, lichTrucBanData = [], canBoData = [], holidayData = [], reloadData }) => {
  const canEdit = user?.backendRole === 'admin' || user?.role === 'admin' || user?.role === 'Quản trị viên';

  const [data, setData] = useState(lichTrucBanData);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mode, setMode] = useState('canbo');
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayForm, setDayForm] = useState(emptyDayForm(toDateOnly(new Date()), 'officer_daily'));
  const [editItem, setEditItem] = useState(null);
  const [singleOfficerId, setSingleOfficerId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  useEffect(() => {
    setData(lichTrucBanData);
  }, [lichTrucBanData]);

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
    () => holidayEntries.map((h) => toDateOnly(h.ngay)).filter(Boolean),
    [holidayEntries]
  );

  const holidayDatesSet = useMemo(() => new Set(holidayDates), [holidayDates]);

  const weekLabel = `Tuần ${formatDDMM(weekDates[0])}-${formatDDMM(weekDates[6])}`;

  const officerWeekData = useMemo(
    () => data.filter((x) => x.loaiTruc === 'officer_daily' && weekDates.includes(x.ngay)),
    [data, weekDates]
  );

  const holidayDutyData = useMemo(
    () => data.filter((x) => x.loaiTruc === 'holiday_daily' && holidayDatesSet.has(x.ngay)),
    [data, holidayDatesSet]
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

  const activeOfficers = useMemo(() => canBoData.filter((x) => x.trangThai === 'active'), [canBoData]);
  const hbOfficerOptions = useMemo(() => activeOfficers.filter((x) => x.vaiTro === 'Cán bộ'), [activeOfficers]);
  const commanderOptions = useMemo(() => activeOfficers.filter(commanderEligible), [activeOfficers]);
  const driverOptions = useMemo(() => activeOfficers.filter((x) => x.donVi === 'Đội lái xe' && x.vaiTro === 'Cán bộ'), [activeOfficers]);
  const medicOptions = useMemo(() => activeOfficers.filter((x) => x.donVi === 'Đội bệnh xá' && x.vaiTro === 'Cán bộ'), [activeOfficers]);

  const stats = {
    giamDocWeeks: data.filter((x) => x.loaiTruc === 'director_weekly').length,
    canBoToday: data.filter((x) => (x.loaiTruc === 'officer_daily' || x.loaiTruc === 'holiday_daily') && x.ngay === toDateOnly(new Date())).length,
    canBoTrongTuan: officerWeekData.length,
    trucLeTrongTuan: holidayDutyData.length,
  };

  const renderDutyCell = (slot, emptyText = 'Chưa phân công') => (
    slot ? (
      <button
        onClick={() => openEditSingle(slot)}
        className="text-left w-full h-12 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100"
      >
        <div className="text-sm font-semibold text-slate-800 line-clamp-1">{slot.tenCanBo}</div>
        <div className="text-xs text-slate-400 font-mono">{slot.canBoId}</div>
      </button>
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
    if (item.viTri === LOCATION.DIRECTOR) return commanderOptions;
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
    try {
      await apiClient.dutySchedules.update(editItem.id, {
        officerId: singleOfficerId,
      });
      if (reloadData) await reloadData();
      setEditItem(null);
      setSingleOfficerId('');
    } catch (err) {
      alert(err?.message || 'Không thể cập nhật lịch trực.');
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
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr>
                <th className="table-th">Ngày</th>
                <th className="table-th">HB - Cán bộ 1</th>
                <th className="table-th">HB - Cán bộ 2</th>
                <th className="table-th">HB - Chỉ huy</th>
                <th className="table-th">Lái xe</th>
                <th className="table-th">Bệnh xá</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {weekDates.map((date, idx) => {
                const holidayName = holidayMap[date] || '';
                const isHoliday = Boolean(holidayName);
                const dayItems = sourceRows.filter((x) => x.ngay === date);
                const slot1 = getSlot(dayItems, LOCATION.HB, 'officer', 1);
                const slot2 = getSlot(dayItems, LOCATION.HB, 'officer', 2);
                const slotCommander = getSlot(dayItems, LOCATION.HB, 'commander', 1);
                const slotDriver = getSlot(dayItems, LOCATION.DRIVER, 'officer', 1);
                const slotMedic = getSlot(dayItems, LOCATION.MEDIC, 'officer', 1);

                const blocked = dutyType === 'officer_daily' && isHoliday;

                return (
                  <tr key={`${dutyType}-${date}`} className="hover:bg-slate-50/70">
                    <td className="table-td">
                      <div className="font-semibold text-slate-700">{WEEK_DAYS[idx]}</div>
                      <div className="text-xs text-slate-400">{formatDDMM(date)}</div>
                      {holidayName && <div className="text-[11px] text-red-600 font-semibold mt-1">{holidayName}</div>}
                    </td>
                    <td className="table-td">{renderDutyCell(slot1)}</td>
                    <td className="table-td">{renderDutyCell(slot2)}</td>
                    <td className="table-td">{renderDutyCell(slotCommander)}</td>
                    <td className="table-td">{renderDutyCell(slotDriver)}</td>
                    <td className="table-td">{renderDutyCell(slotMedic)}</td>
                    <td className="table-td">
                      {canEdit && !blocked && (
                        <button
                          onClick={() => openDayAssign(date, dutyType)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          Thiết lập ngày
                        </button>
                      )}
                      {blocked && (
                        <span className="text-xs text-amber-600 font-semibold">Ngày lễ - dùng tab Trực lễ</span>
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
        {holidayDates.map((date) => {
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
                  <p className="text-xs text-slate-500 mt-1">Chỉ hiển thị các ngày lễ thật sự, không bao gồm chào cờ đầu tuần.</p>
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

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium">Chỉ Giám đốc mới có quyền phân công lịch trực ban.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lập lịch trực ban</h2>
          <p className="text-sm text-slate-500 mt-0.5">Nhà hiệu bộ: 2 cán bộ + 1 chỉ huy, Lái xe: 1 cán bộ, Bệnh xá: 1 cán bộ.</p>
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
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tuần trực giám đốc', value: stats.giamDocWeeks, color: 'text-violet-600', bg: 'bg-violet-50', icon: Star },
          { label: 'Cán bộ trực hôm nay', value: stats.canBoToday, color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
          { label: 'Lịch cán bộ tuần này', value: stats.canBoTrongTuan, color: 'text-amber-600', bg: 'bg-amber-50', icon: ShieldCheck },
          { label: 'Trực lễ tuần này', value: stats.trucLeTrongTuan, color: 'text-red-600', bg: 'bg-red-50', icon: ShieldCheck },
        ].map((s, i) => (
          <div key={i} className="card py-3.5 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {mode !== 'trucle' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <span className="px-3 text-sm font-semibold text-slate-700 min-w-[170px] text-center">{weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight size={16} /></button>
          </div>
        )}

        {canEdit && mode !== 'giamdoc' && (
          <button onClick={handleAutoAssign} disabled={isAutoAssigning} className="btn-secondary">
            <Shuffle size={16} /> {isAutoAssigning ? 'Đang xếp...' : (mode === 'trucle' ? 'Tự động xếp ngày lễ' : 'Tự động xếp tuần này')}
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

      {mode === 'canbo' && renderDayTable(officerWeekData, 'officer_daily')}
      {mode === 'trucle' && renderHolidayList()}

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
