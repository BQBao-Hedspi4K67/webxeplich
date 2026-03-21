import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2, UserPlus, ShieldCheck, Users, Star } from 'lucide-react';
import { TRANG_THAI_TRUC, WEEK_DAYS } from '../../data/uiConstants';
import apiClient from '../../services/api';

const toDateOnly = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
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

const initialForm = {
  kieuTruc: 'canbo',
  canBoId: '',
  tenCanBo: '',
  ngay: toDateOnly(new Date()),
  denNgay: toDateOnly(new Date()),
  trangThai: 'upcoming',
  viTri: 'Trực ban cổng chính',
  ghiChu: '',
};

const toBackendDutyStatus = (status) => (
  status === 'completed' ? 'done' : status
);

const normalizeDutyStatus = (status) => (
  status === 'done' ? 'completed' : (status || 'upcoming')
);

const LapLichTrucBan = ({ user, lichTrucBanData = [], canBoData = [], reloadData }) => {
  const canEdit = user?.role !== 'Cán bộ';
  const [data, setData] = useState(lichTrucBanData);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mode, setMode] = useState('canbo');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    setData(lichTrucBanData);
  }, [lichTrucBanData]);

  const weekStart = getWeekStart(weekOffset);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return toDateOnly(d);
  }), [weekStart]);
  const weekLabel = `Tuần ${formatDDMM(weekDates[0])}-${formatDDMM(weekDates[6])}`;

  const canboWeekData = useMemo(() => (
    data.filter((t) => t.kieuTruc === 'canbo' && weekDates.includes(t.ngay))
  ), [data, weekDates]);

  const giamdocWeek = useMemo(() => (
    data.filter((t) => {
      if (t.kieuTruc !== 'giamdoc') return false;
      const start = t.ngay;
      const end = t.denNgay || t.ngay;
      return start <= weekDates[6] && end >= weekDates[0];
    })
  ), [data, weekDates]);

  const stats = {
    giamDocWeeks: data.filter((t) => t.kieuTruc === 'giamdoc').length,
    canBoToday: data.filter((t) => t.kieuTruc === 'canbo' && t.ngay === toDateOnly(new Date())).length,
    pending: data.filter((t) => t.trangThai === 'upcoming').length,
    done: data.filter((t) => t.trangThai === 'completed').length,
  };

  const openAddCanBo = (ngay) => {
    setForm({ ...initialForm, kieuTruc: 'canbo', ngay, viTri: 'Trực ban cổng chính', trangThai: 'upcoming' });
    setEditId(null);
    setShowModal(true);
  };

  const openAddGiamDoc = () => {
    setForm({
      ...initialForm,
      kieuTruc: 'giamdoc',
      ngay: weekDates[0],
      denNgay: weekDates[6],
      viTri: 'Trực ban Giám đốc',
      trangThai: 'upcoming',
    });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({ ...item, trangThai: normalizeDutyStatus(item.trangThai) });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.canBoId || !form.ngay) return;

    const payload = {
      officerId: form.canBoId,
      dutyType: form.kieuTruc === 'giamdoc' ? 'director_weekly' : 'officer_daily',
      date: form.ngay,
      endDate: form.kieuTruc === 'giamdoc' ? (form.denNgay || form.ngay) : null,
      shift: form.kieuTruc === 'giamdoc' ? 'tuan' : 'nguyenday',
      location: form.viTri || '',
      status: toBackendDutyStatus(form.trangThai || 'upcoming'),
      notes: form.ghiChu || '',
    };

    try {
      if (editId) {
        await apiClient.dutySchedules.update(editId, payload);
      } else {
        await apiClient.dutySchedules.create(payload);
      }
      if (reloadData) await reloadData();
      setShowModal(false);
    } catch (err) {
      alert(err?.message || 'Không thể lưu lịch trực ban.');
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

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lập lịch trực ban</h2>
          <p className="text-sm text-slate-500 mt-0.5">Trực ban Giám đốc theo tuần, cán bộ trực nguyên ngày.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode('canbo')} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'canbo' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Trực cán bộ
          </button>
          <button onClick={() => setMode('giamdoc')} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'giamdoc' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Trực ban Giám đốc
          </button>
          {canEdit && mode === 'canbo' && (
            <button onClick={() => openAddCanBo(toDateOnly(new Date()))} className="btn-primary"><Plus size={16} /> Gán trực cán bộ</button>
          )}
          {canEdit && mode === 'giamdoc' && (
            <button onClick={openAddGiamDoc} className="btn-primary"><Plus size={16} /> Gán trực giám đốc</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tuần trực giám đốc', value: stats.giamDocWeeks, color: 'text-violet-600', bg: 'bg-violet-50', icon: Star },
          { label: 'Cán bộ trực hôm nay', value: stats.canBoToday, color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
          { label: 'Lịch sắp trực', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50', icon: ShieldCheck },
          { label: 'Đã hoàn thành', value: stats.done, color: 'text-slate-600', bg: 'bg-slate-100', icon: ShieldCheck },
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
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"><ChevronLeft size={16} /></button>
          <span className="px-3 text-sm font-semibold text-slate-700 min-w-[170px] text-center">{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"><ChevronRight size={16} /></button>
        </div>
      </div>

      {mode === 'canbo' ? (
        <div className="card-lg p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="table-th">Ngày</th>
                  <th className="table-th">Cán bộ trực (nguyên ngày)</th>
                  <th className="table-th">Vị trí</th>
                  <th className="table-th">Trạng thái</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date, i) => {
                  const dayItems = canboWeekData.filter((x) => x.ngay === date);
                  return (
                    <tr key={date} className="hover:bg-slate-50/70">
                      <td className="table-td">
                        <div className="font-semibold text-slate-700">{WEEK_DAYS[i]}</div>
                        <div className="text-xs text-slate-400">{formatDDMM(date)}</div>
                      </td>
                      <td className="table-td">
                        {dayItems.length > 0 ? (
                          <div className="space-y-2">
                            {dayItems.map((item) => (
                              <div key={item.id} className="h-12 p-2 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="text-sm font-semibold text-slate-800 line-clamp-1">{item.tenCanBo}</div>
                                <div className="text-xs text-slate-400 font-mono">{item.canBoId}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">Chưa phân công</span>
                        )}
                      </td>
                      <td className="table-td text-sm text-slate-600">
                        {dayItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {dayItems.map((item) => (
                              <div key={item.id} className="h-12 flex items-center">{item.viTri || '-'}</div>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="table-td">
                        {dayItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {dayItems.map((item) => {
                              const tt = TRANG_THAI_TRUC[item.trangThai] || TRANG_THAI_TRUC.upcoming;
                              return <div key={item.id} className="h-12 flex items-center"><span className={`badge ${tt.bg} ${tt.text}`}>{tt.label}</span></div>;
                            })}
                          </div>
                        ) : <span className="badge bg-slate-100 text-slate-500">Trống</span>}
                      </td>
                      <td className="table-td">
                        {canEdit && (
                          <div className="space-y-1.5">
                            {dayItems.map((item) => (
                              <div key={item.id} className="h-12 flex items-center gap-1">
                                <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><Edit2 size={13} /></button>
                                <button onClick={() => setDeleteConfirm(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={13} /></button>
                              </div>
                            ))}
                            <button onClick={() => openAddCanBo(date)} className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1">
                              <UserPlus size={12} /> Thêm cán bộ
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          {giamdocWeek.length > 0 ? (
            <div className="space-y-3">
              {giamdocWeek.map((item) => {
                const tt = TRANG_THAI_TRUC[item.trangThai] || TRANG_THAI_TRUC.upcoming;
                return (
                  <div key={item.id} className="border border-violet-200 bg-violet-50/40 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-violet-800">Trực ban Giám đốc - {formatDDMM(item.ngay)} đến {formatDDMM(item.denNgay || item.ngay)}</h3>
                        <p className="text-sm text-violet-700 mt-1">{item.tenCanBo} ({item.canBoId})</p>
                        <p className="text-xs text-slate-500 mt-1">{item.ngay} đến {item.denNgay || item.ngay}</p>
                        <p className="text-xs text-slate-500">{item.viTri}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${tt.bg} ${tt.text}`}>{tt.label}</span>
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(item)} className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={14} /></button>
                            <button onClick={() => setDeleteConfirm(item)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <ShieldCheck size={30} className="mx-auto mb-2 opacity-40" />
              Chưa có phân công trực ban giám đốc cho {weekLabel}.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{editId ? 'Cập nhật trực ban' : 'Phân công trực ban'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại trực</label>
                <select className="input-field" value={form.kieuTruc} onChange={(e) => setForm({ ...form, kieuTruc: e.target.value })} disabled={Boolean(editId)}>
                  <option value="canbo">Trực cán bộ (nguyên ngày)</option>
                  <option value="giamdoc">Trực ban Giám đốc (theo tuần)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cán bộ trực</label>
                <select className="input-field" value={form.canBoId} onChange={(e) => setForm({ ...form, canBoId: e.target.value })}>
                  <option value="">-- Chọn cán bộ --</option>
                  {canBoData.filter((c) => c.trangThai === 'active').map((cb) => (
                    <option key={cb.id} value={cb.id}>{cb.hoTen} - {cb.donVi}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày bắt đầu</label>
                  <input type="date" className="input-field" value={form.ngay} onChange={(e) => setForm({ ...form, ngay: e.target.value })} />
                </div>
                {form.kieuTruc === 'giamdoc' ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày kết thúc</label>
                    <input type="date" className="input-field" value={form.denNgay || form.ngay} onChange={(e) => setForm({ ...form, denNgay: e.target.value })} />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày kết thúc</label>
                    <input type="date" className="input-field" value={form.ngay} disabled />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Trạng thái</label>
                <select className="input-field" value={form.trangThai || 'upcoming'} onChange={(e) => setForm({ ...form, trangThai: e.target.value })}>
                  <option value="upcoming">Sắp diễn ra</option>
                  <option value="active">Đang diễn ra</option>
                  <option value="completed">Đã diễn ra</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vị trí</label>
                <input className="input-field" value={form.viTri} onChange={(e) => setForm({ ...form, viTri: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ghi chú</label>
                <textarea rows={2} className="input-field resize-none" value={form.ghiChu || ''} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">{editId ? 'Lưu thay đổi' : 'Phân công'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="font-bold text-slate-800 mb-2">Xóa lịch trực?</h3>
            <p className="text-sm text-slate-500 mb-5">Bạn có chắc muốn xóa lịch trực của <span className="font-semibold text-slate-700">"{deleteConfirm.tenCanBo}"</span>?</p>
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
