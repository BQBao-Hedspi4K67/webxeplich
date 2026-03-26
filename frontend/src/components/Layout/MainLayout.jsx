import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import schoolLogo from '../../assets/logo.png';

const MainLayout = ({
  activePage,
  onNavigate,
  user,
  onLogout,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  children,
}) => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 relative">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `url(${schoolLogo})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '240px 240px',
          backgroundPosition: 'center',
        }}
      />
      <Sidebar activePage={activePage} onNavigate={onNavigate} user={user} onLogout={onLogout} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
        <Topbar
          activePage={activePage}
          user={user}
          onLogout={onLogout}
          onNavigate={onNavigate}
          notificationsData={notifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
