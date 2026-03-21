import React, { useEffect, useMemo, useState } from 'react';
import { Send, CheckCircle2, Clock3, AlertCircle, MessageSquare } from 'lucide-react';
import apiClient from '../../services/api';

const TODAY = new Date().toISOString().slice(0, 10);

const statusUI = {
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700', icon: Clock3 },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Từ chối', cls: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const YKienPhanHoi = ({ user, lichTrucBanData = [], yKienData = [], reloadData }) => {
  const [danhSach, setDanhSach] = useState(yKienData);
  const [noiDung, setNoiDung] = useState('');
  const [phanHoiMap, setPhanHoiMap] = useState({});

  useEffect(() => {
    setDanhSach(yKienData);
  }, [yKienData]);

  const isAdmin = user?.role === 'Quản trị viên';
  const isCanBo = user?.role === 'Cán bộ';

  const dutyToday = useMemo(() => {
    if (!user?.id) return false;
    return lichTrucBanData.some(t => t.kieuTruc === 'canbo' && t.canBoId === user.id && t.ngay === TODAY);
  }, [user, lichTrucBanData]);

  const myItems = useMemo(() => {
    if (!user?.id) return [];
    return danhSach.filter(x => x.canBoId === user.id).sort((a, b) => (a.ngayTruc < b.ngayTruc ? 1 : -1));
  }, [danhSach, user]);

  const handleGui = async () => {
    if (!noiDung.trim() || !user?.id || !dutyToday) return;

    await apiClient.opinions.submit({
      officerId: user.id,
      dutyDate: TODAY,
      content: noiDung.trim(),
    });

    setNoiDung('');
    if (reloadData) await reloadData();
  };

  const xuLyYKien = async (id, trangThai) => {
    const phanHoi = (phanHoiMap[id] || '').trim();
    const target = danhSach.find((x) => x.id === id);
    if (!target?.opinionId) return;

    if (trangThai === 'approved') {
      await apiClient.opinions.approve(target.opinionId, phanHoi);
    } else {
      await apiClient.opinions.reject(target.opinionId, phanHoi);
    }

    if (reloadData) await reloadData();
    setPhanHoiMap(prev => ({ ...prev, [id]: '' }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Ý kiến trực ban</h2>
        <p className="text-sm text-slate-500 mt-0.5">Cán bộ trực có thể gửi ý kiến đột xuất để admin phê duyệt.</p>
      </div>

      {isCanBo && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-800">Gửi ý kiến hôm nay</h3>
            <span className={dutyToday ? 'badge bg-emerald-100 text-emerald-700' : 'badge bg-slate-100 text-slate-500'}>
              {dutyToday ? 'Bạn đang trực hôm nay' : 'Không trong ca trực hôm nay'}
            </span>
          </div>
          <textarea
            rows={3}
            value={noiDung}
            onChange={e => setNoiDung(e.target.value)}
            className="input-field resize-none"
            placeholder="Nhập nội dung đề xuất/ý kiến đột xuất..."
            disabled={!dutyToday}
          />
          <div className="mt-3 flex justify-end">
            <button onClick={handleGui} disabled={!dutyToday || !noiDung.trim()} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              <Send size={14} /> Gửi admin phê duyệt
            </button>
          </div>
        </div>
      )}

      <div className="card-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Danh sách ý kiến</h3>
          <span className="text-xs text-slate-500">{isAdmin ? danhSach.length : myItems.length} mục</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                {['Mã', 'Cán bộ', 'Ngày trực', 'Nội dung', 'Trạng thái', 'Phản hồi admin', ''].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isAdmin ? danhSach : myItems).map(item => {
                const ui = statusUI[item.trangThai];
                const Icon = ui.icon;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                    <td className="table-td font-mono text-xs">{item.id}</td>
                    <td className="table-td text-sm font-medium text-slate-700">{item.tenCanBo}</td>
                    <td className="table-td text-sm text-slate-600">{item.ngayTruc}</td>
                    <td className="table-td text-sm text-slate-600 max-w-[360px]">{item.noiDung}</td>
                    <td className="table-td">
                      <span className={'badge ' + ui.cls}><Icon size={12} className="mr-1" />{ui.label}</span>
                    </td>
                    <td className="table-td text-sm text-slate-600">
                      {item.phanHoiAdmin || <span className="text-slate-400">Chưa phản hồi</span>}
                    </td>
                    <td className="table-td">
                      {isAdmin && item.trangThai === 'pending' && (
                        <div className="space-y-2 min-w-[220px]">
                          <textarea
                            rows={2}
                            className="input-field resize-none"
                            placeholder="Ghi phản hồi..."
                            value={phanHoiMap[item.id] || ''}
                            onChange={e => setPhanHoiMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => xuLyYKien(item.id, 'approved')} className="btn-primary !py-1.5 !px-3 text-xs">Duyệt</button>
                            <button onClick={() => xuLyYKien(item.id, 'rejected')} className="btn-danger !py-1.5 !px-3 text-xs">Từ chối</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(isAdmin ? danhSach : myItems).length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <MessageSquare size={30} className="mx-auto mb-2 opacity-40" />
                    Chưa có ý kiến nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default YKienPhanHoi;
