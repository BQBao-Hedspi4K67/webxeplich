import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, ChevronDown, Settings, LogOut, User, X } from 'lucide-react';

const pageTitles = {
  dashboard: 'Dashboard',
  canbo: 'Quản lý cán bộ',
  lichcongtac: 'Lập lịch công tác tuần',
  lichtrucan: 'Lập lịch trực ban',
  tracuu: 'Tra cứu lịch',
  xuat: 'Xuất / In lịch',
  ykien: 'Ý kiến trực ban',
  quytrinh: 'Quy trình chức năng',
  taikhoan: 'Quản trị tài khoản',
};

const Topbar = ({ activePage, user, onLogout, onNavigate, notificationsData = [], onMarkRead, onMarkAllRead }) => {
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [notifications, setNotifications] = useState(notificationsData);
  const notifRef = useRef();
  const userRef = useRef();

  const unread = notifications.filter(n => !n.daDoc).length;
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setNotifications(notificationsData);
  }, [notificationsData]);

  const markAllRead = async () => {
    if (onMarkAllRead) {
      await onMarkAllRead();
    }
  };

  const markOneRead = async (id, alreadyRead) => {
    if (alreadyRead || !onMarkRead) return;
    await onMarkRead(id);
  };

  const loaiColors = { success: 'bg-emerald-100 text-emerald-600', warning: 'bg-amber-100 text-amber-600', info: 'bg-blue-100 text-blue-600' };
  const loaiIcons = { success: '✓', warning: '!', info: 'i' };

  return (
    <header className="h-[60px] bg-white border-b border-slate-100 flex items-center px-5 gap-4 flex-shrink-0 z-20">
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-bold text-slate-800 truncate">{pageTitles[activePage] || 'Dashboard'}</h1>
        <p className="text-[11px] text-slate-400 truncate hidden sm:block">{today}</p>
      </div>

      {/* Search bar */}
      <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-52 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-300 transition-all group">
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input type="text" placeholder="Tìm kiếm nhanh..."
          className="bg-transparent text-sm text-slate-700 placeholder-slate-400 flex-1 min-w-0 outline-none" />
        <kbd className="text-[10px] text-slate-300 border border-slate-200 px-1.5 py-0.5 rounded font-mono hidden group-focus-within:hidden">⌘K</kbd>
      </div>

      {/* Notification */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setShowNotif(!showNotif); setShowUser(false); }}
          className="relative w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {showNotif && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-card-lg border border-slate-100 overflow-hidden z-50 animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
                {unread > 0 && <p className="text-xs text-slate-400">{unread} chưa đọc</p>}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Đánh dấu đọc</button>
                )}
                <button onClick={() => setShowNotif(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markOneRead(n.id, n.daDoc)}
                  className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${!n.daDoc ? 'bg-blue-50/50' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ${loaiColors[n.loai]}`}>
                    {loaiIcons[n.loai]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold text-slate-800 leading-tight ${!n.daDoc ? 'font-bold' : ''}`}>{n.tieuDe}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.noiDung}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{n.thoiGian}</p>
                  </div>
                  {!n.daDoc && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center">
                Xem tất cả thông báo →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => { setShowUser(!showUser); setShowNotif(false); }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
            {user?.avatar || 'NM'}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-800 leading-tight max-w-[100px] truncate">{user?.name?.split(' ').slice(-2).join(' ') || 'Admin'}</div>
            <div className="text-[10px] text-slate-400">{user?.role || 'Quản trị viên'}</div>
          </div>
          <ChevronDown size={13} className="text-slate-400" />
        </button>

        {showUser && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-card-lg border border-slate-100 overflow-hidden z-50 animate-fade-in">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-800 truncate">{user?.name || 'Quản trị viên'}</div>
              <div className="text-xs text-slate-400">{user?.role}</div>
            </div>
            <div className="py-1.5">
              {[
                { icon: User, label: 'Thông tin tài khoản', page: 'taikhoan' },
                { icon: Settings, label: 'Cài đặt hệ thống', page: 'taikhoan' },
              ].filter(item => ['Quản trị viên', 'Quản lý'].includes(user?.role)).map((item, i) => (
                <button key={i} onClick={() => { onNavigate(item.page); setShowUser(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors">
                  <item.icon size={14} className="text-slate-400" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 py-1.5">
              <button onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={14} />
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
