import React, { useEffect, useMemo, useState } from 'react';
import { Send, CheckCircle2, Clock3, AlertCircle, MessageSquare } from 'lucide-react';
import apiClient from '../../services/api';

const statusUI = {
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700', icon: Clock3 },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Từ chối', cls: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const ADMIN_DEPARTMENT = 'Phòng hành chính tổng hợp';

const YKienPhanHoi = ({ user, lichTrucBanData = [], yKienData = [], lichCongTacData = [], reloadData, canReviewLeaveRequests }) => {
  const [danhSach, setDanhSach] = useState(yKienData);
  const [noiDung, setNoiDung] = useState('');
  const [ngayNghi, setNgayNghi] = useState('');
  const [selectedDutyId, setSelectedDutyId] = useState('');
  const [phanHoiMap, setPhanHoiMap] = useState({});

  const isAdminLike = user?.role === 'Quản trị viên' || user?.isDelegatedAdmin;
  const hasWorkScheduleApprove = Boolean(
    user?.canApproveWorkSchedules ||
    user?.canApproveWorkSchedulesByRole ||
    user?.canApproveWorkSchedulesByPermission ||
    user?.backendRole === 'admin' ||
    user?.backendRole === 'superadmin' ||
    user?.isDelegatedAdmin
  );
  const [approvalTab, setApprovalTab] = useState(() => {
    if (isAdminLike && !canReviewLeaveRequests && hasWorkScheduleApprove) {
      return 'work';
    }
    return 'leave';
  }); // 'leave' | 'work'

  useEffect(() => {
    setDanhSach(yKienData);
  }, [yKienData]);

  const canReview = Boolean(canReviewLeaveRequests);
  const isCanBo = user?.role === 'Cán bộ';
  const canCreateLeaveRequest = isCanBo || (user?.role === 'Quản lý' && !canReviewLeaveRequests);
  const today = new Date().toISOString().slice(0, 10);

  const myItems = useMemo(() => {
    if (!user?.id) return [];
    return danhSach
      .filter((x) => x.canBoId === user.id && String(x.ngayNghi || '') >= today)
      .sort((a, b) => (a.ngayNghi < b.ngayNghi ? 1 : -1));
  }, [danhSach, user, today]);

  const myDutyItems = useMemo(() => {
    if (!user?.id) return [];
    return lichTrucBanData
      .filter((x) => x.canBoId === user.id && x.kieuTruc === 'canbo' && String(x.ngay || '') >= today)
      .sort((a, b) => (a.ngay > b.ngay ? 1 : -1));
  }, [lichTrucBanData, user, today]);

  const visibleLeaveItems = (canReview ? danhSach : myItems).filter((x) => String(x.ngayNghi || '') >= today);

  const handleGui = async () => {
    if (!noiDung.trim() || !user?.id || !ngayNghi || !selectedDutyId) return;

    await apiClient.leaveRequests.submit({
      officerId: user.id,
      dutyScheduleId: selectedDutyId,
      leaveDate: ngayNghi,
      reason: noiDung.trim(),
    });

    setNoiDung('');
    setNgayNghi('');
    setSelectedDutyId('');
    if (reloadData) await reloadData();
  };

  const xuLyYKien = async (id, trangThai) => {
    const phanHoi = (phanHoiMap[id] || '').trim();
    const target = danhSach.find((x) => x.id === id);
    if (!target?.opinionId) return;

    if (trangThai === 'approved') {
      await apiClient.leaveRequests.approve(target.opinionId, phanHoi);
    } else {
      await apiClient.leaveRequests.reject(target.opinionId, phanHoi);
    }

    if (reloadData) await reloadData();
    setPhanHoiMap(prev => ({ ...prev, [id]: '' }));
  };

  const handleApproveWorkSchedule = async (scheduleId) => {
    if (!scheduleId) return;
    try {
      await apiClient.workSchedules.approve(scheduleId, 'approved');
      if (reloadData) await reloadData();
    } catch (err) {
      alert(err?.message || 'Không thể duyệt Lịch sự kiện.');
    }
  };

  const handleRejectWorkSchedule = async (scheduleId) => {
    if (!scheduleId) return;
    const confirmed = window.confirm('Không duyệt lịch này? Lịch sẽ bị xóa khỏi hệ thống.');
    if (!confirmed) return;

    try {
      await apiClient.workSchedules.approve(scheduleId, 'rejected');
      if (reloadData) await reloadData();
    } catch (err) {
      alert(err?.message || 'Không thể từ chối Lịch sự kiện.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Phê duyệt</h2>
      </div>


      <div className="flex gap-2 mb-4">
        {!(isAdminLike && !canReviewLeaveRequests) && (
          <button
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${approvalTab === 'leave' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setApprovalTab('leave')}
          >
            Đơn xin nghỉ
          </button>
        )}
        {hasWorkScheduleApprove && (
          <button
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${approvalTab === 'work' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setApprovalTab('work')}
          >
            Phê duyệt Lịch sự kiện
          </button>
        )}
      </div>

      {approvalTab === 'leave' && (
        <>
          {canCreateLeaveRequest && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-800">Tạo đơn xin nghỉ</h3>
                <span className="badge bg-blue-100 text-blue-700">Gửi quản lý duyệt</span>
              </div>
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chọn ngày trực để xin nghỉ</label>
                {myDutyItems.length === 0 ? (
                  <div className="text-sm text-slate-400">Bạn chưa có lịch trực cán bộ để xin nghỉ.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {myDutyItems.map((item) => {
                      const active = selectedDutyId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedDutyId(item.id);
                            setNgayNghi(item.ngay);
                          }}
                          className={`text-left px-3 py-2 rounded-xl border transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                        >
                          <div className="text-sm font-semibold text-slate-800">Ngày trực: {item.ngay}</div>
                          <div className="text-xs text-slate-500">Vị trí: {item.viTri || '-'}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedDutyId && (
                <div className="mb-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Đã chọn xin nghỉ trực ngày: <span className="font-bold">{ngayNghi}</span>
                </div>
              )}
              <textarea
                rows={3}
                value={noiDung}
                onChange={e => setNoiDung(e.target.value)}
                className="input-field resize-none"
                placeholder="Nhập lý do xin nghỉ..."
              />
              <div className="mt-3 flex justify-end">
                <button onClick={handleGui} disabled={!selectedDutyId || !ngayNghi || !noiDung.trim()} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send size={14} /> Gửi đơn
                </button>
              </div>
            </div>
          )}

          <div className="card-lg p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Danh sách đơn xin nghỉ</h3>
              <span className="text-xs text-slate-500">{visibleLeaveItems.length} mục</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    {['Mã', 'Họ và tên', 'Ngày nghỉ', 'Lý do', 'Trạng thái', 'Phản hồi duyệt', ''].map(h => (
                      <th key={h} className="table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLeaveItems.map(item => {
                    const ui = statusUI[item.trangThai];
                    const Icon = ui.icon;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                        <td className="table-td font-mono text-xs">{item.id}</td>
                        <td className="table-td text-sm font-medium text-slate-700">{item.tenCanBo}</td>
                        <td className="table-td text-sm text-slate-600">{item.ngayNghi}</td>
                        <td className="table-td text-sm text-slate-600 max-w-[360px]">{item.noiDung}</td>
                        <td className="table-td">
                          <span className={'badge ' + ui.cls}><Icon size={12} className="mr-1" />{ui.label}</span>
                        </td>
                        <td className="table-td text-sm text-slate-600">
                          {item.phanHoiAdmin || <span className="text-slate-400">Chưa phản hồi</span>}
                        </td>
                        <td className="table-td">
                          {canReview && item.trangThai === 'pending' && (
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
                  {visibleLeaveItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <MessageSquare size={30} className="mx-auto mb-2 opacity-40" />
                        Chưa có đơn xin nghỉ nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {approvalTab === 'work' && hasWorkScheduleApprove && (
        <div className="card-lg p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Phê duyệt Lịch sự kiện</h3>
            <span className="text-xs text-slate-500">{
              (lichCongTacData?.filter?.(w => w.trangThaiDuyet === 'pending')?.length) || 0
            } lịch chờ duyệt</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  {['Mã lịch', 'Nội dung', 'Ngày', 'Đơn vị', 'Người tạo', ''].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lichCongTacData?.filter?.(w => w.trangThaiDuyet === 'pending')?.map((item) => {
                  const isSelfApprove = String(item.nguoiTaoOfficerId || '') === String(user.id || '');
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                      <td className="table-td font-mono text-xs">{item.id}</td>
                      <td className="table-td text-sm text-slate-700 font-medium">{item.tieuDe || '-'}</td>
                      <td className="table-td text-sm text-slate-600">{item.ngay || '-'}</td>
                      <td className="table-td text-sm text-slate-600">{item.donVi || '-'}</td>
                      <td className="table-td text-sm text-slate-600">{item.nguoiTao || '-'}</td>
                      <td className="table-td">
                        {!isSelfApprove && (
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveWorkSchedule(item.id)} className="btn-primary !py-1.5 !px-3 text-xs">Duyệt</button>
                            <button onClick={() => handleRejectWorkSchedule(item.id)} className="btn-danger !py-1.5 !px-3 text-xs">Từ chối</button>
                          </div>
                        )}
                        {isSelfApprove && (
                          <span className="text-xs text-slate-400">Không cần duyệt</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(lichCongTacData?.filter?.(w => w.trangThaiDuyet === 'pending')?.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">Hiện không có Lịch sự kiện chờ duyệt.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default YKienPhanHoi;
