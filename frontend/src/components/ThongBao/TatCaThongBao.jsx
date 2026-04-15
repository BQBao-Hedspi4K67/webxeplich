import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';

const TatCaThongBao = ({ thongBaoData = [], onMarkNotificationRead, onMarkAllNotificationsRead }) => {
  const notifications = Array.isArray(thongBaoData) ? thongBaoData : [];
  const unreadCount = notifications.filter((n) => !n.daDoc).length;

  const loaiColor = {
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };

  const loaiLabel = {
    success: 'Thành công',
    warning: 'Cảnh báo',
    info: 'Thông tin',
  };

  const handleMarkRead = async (id, daDoc) => {
    if (daDoc || !onMarkNotificationRead) return;
    await onMarkNotificationRead(id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="card-lg flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tất cả thông báo</h2>
          <p className="text-sm text-slate-500 mt-1">
            {notifications.length} thông báo • {unreadCount} chưa đọc
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllNotificationsRead}
            className="btn-secondary"
          >
            <CheckCheck size={16} /> Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <Bell size={22} className="mx-auto mb-2" />
          Chưa có thông báo nào.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleMarkRead(n.id, n.daDoc)}
              className={`card-lg w-full text-left transition-all hover:shadow-md ${!n.daDoc ? 'border-blue-200 bg-blue-50/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 px-2 py-1 rounded-full text-xs font-semibold ${loaiColor[n.loai] || 'bg-slate-100 text-slate-700'}`}>
                  {loaiLabel[n.loai] || 'Thông báo'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm text-slate-800 ${!n.daDoc ? 'font-bold' : 'font-semibold'}`}>{n.tieuDe}</h3>
                    {!n.daDoc && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.noiDung}</p>
                  <p className="text-xs text-slate-400 mt-2">{n.thoiGian}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TatCaThongBao;
