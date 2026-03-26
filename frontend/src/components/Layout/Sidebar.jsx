import React, { useState } from 'react';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList,
  Search, Printer, Settings, ChevronRight,
  MessageSquareQuote, FileText, CalendarCheck,
  LogOut, ChevronLeft
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'canbo', label: 'Quản lý cán bộ', icon: Users, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'lichcongtac', label: 'Lập lịch công tác', icon: CalendarDays, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'lichtrucan', label: 'Lập lịch trực ban', icon: ClipboardList, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'lichcuatoi', label: 'Lịch của tôi', icon: CalendarCheck, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'tracuu', label: 'Tra cứu lịch', icon: Search, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'xuat', label: 'Xuất / In lịch', icon: Printer, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'ykien', label: 'Ý kiến trực ban', icon: MessageSquareQuote, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'quytrinh', label: 'Quy trình chức năng', icon: FileText, badge: null, roles: ['Quản trị viên', 'Quản lý', 'Cán bộ'] },
  { id: 'taikhoan', label: 'Quản trị tài khoản', icon: Settings, badge: null, roles: ['Quản trị viên', 'Quản lý'] },
];

const Sidebar = ({ activePage, onNavigate, user, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const visibleMenus = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className={`relative flex flex-col h-screen bg-gradient-to-b from-[#0d1f3c] to-[#0a1628] border-r border-white/8 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[240px]'} flex-shrink-0`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/8 ${collapsed ? 'justify-center px-0' : ''}`}>
        <img src="/src/assets/logo.png" alt="School Logo" className="w-9 h-9 rounded-xl flex-shrink-0 shadow-lg" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-[11px] leading-tight whitespace-nowrap">HVKT &amp; CN AN NINH</div>
            <div className="text-blue-300/70 text-[10px] whitespace-nowrap">Hệ thống lịch công tác</div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[68px] w-6 h-6 bg-white rounded-full border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all z-10">
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-0.5">
        {!collapsed && (
          <div className="px-2 mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Chức năng chính</span>
          </div>
        )}
        {visibleMenus.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/25 text-white' : 'bg-blue-500/20 text-blue-300'}`}>
                      {item.badge}
                    </span>
                  )}
                  {isActive && <div className="w-1 h-1 bg-white rounded-full flex-shrink-0" />}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User info bottom */}
      <div className={`border-t border-white/8 p-3 ${collapsed ? 'px-2' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/6 transition-colors group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.avatar || 'NM'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.name || 'Quản trị viên'}</div>
              <div className="text-blue-300/60 text-[10px] truncate">{user?.role || 'Admin'}</div>
            </div>
            <button onClick={onLogout} title="Đăng xuất"
              className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.avatar || 'NM'}
            </div>
            <button onClick={onLogout} title="Đăng xuất"
              className="text-slate-500 hover:text-red-400 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
