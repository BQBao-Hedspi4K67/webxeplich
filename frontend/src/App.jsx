import React, { useCallback, useEffect, useState } from 'react';
import LandingLogin from './pages/LandingLogin';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './components/Dashboard/Dashboard';
import QuanLyCanBo from './components/CanBo/QuanLyCanBo';
import LichTongHop from './components/LichTongHop/LichTongHop';
import LichCuaToi from './components/LichCuaToi/LichCuaToi';
import QuanLyNgayLe from './components/NgayLe/QuanLyNgayLe';
import QuanLyPhongBan from './components/PhongBan/QuanLyPhongBan';
import BangQuyTrinh from './components/QuyTrinh/BangQuyTrinh';
import TatCaThongBao from './components/ThongBao/TatCaThongBao';
import YKienPhanHoi from './components/YKien/YKienPhanHoi';
import apiClient from './services/api';

const BACKEND_TO_UI_ROLE = {
  superadmin: 'Quản trị viên',
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  officer: 'Cán bộ',
};

const SUPERADMIN_PAGES = ['canbo', 'ngayle', 'phongban', 'taikhoan'];

const PAGE_TO_PATH = {
  dashboard: '/dashboard',
  thongbao: '/thongbao',
  canbo: '/canbo',
  lichcongtac: '/lichcongtac',
  lichcuatoi: '/lichcuatoi',
  ngayle: '/ngayle',
  phongban: '/phongban',
  ykien: '/ykien',
  taikhoan: '/taikhoan',
};

const PATH_TO_PAGE = Object.entries(PAGE_TO_PATH).reduce((acc, [page, path]) => {
  acc[path] = page;
  return acc;
}, { '/': 'dashboard' });

const getPageFromPath = (pathname = '/') => PATH_TO_PAGE[pathname] || 'dashboard';
const pushPagePath = (page) => {
  if (typeof window === 'undefined') return;
  const nextPath = PAGE_TO_PATH[page] || '/dashboard';
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath);
  }
};

const OFFICER_ROLE_TO_UI = {
  leader: 'Lãnh đạo',
  manager: 'Quản lý',
  officer: 'Cán bộ',
};

const OFFICER_UI_ROLE_ORDER = {
  'Lãnh đạo': 1,
  'Quản lý': 2,
  'Cán bộ': 3,
};

const WORK_TYPE_FALLBACK_LABEL = {
  hop: 'Họp',
  hoiThao: 'Hội thảo',
  tiepkhach: 'Tiếp khách',
  congtac: 'Công tác',
  khaoSat: 'Khảo sát',
  dienTap: 'Diễn tập',
  sinhHoat: 'Sinh hoạt',
  baoCao: 'Báo cáo',
  khaiGiang: 'Khai giảng',
};

const toDateOnly = (value) => {
  if (!value) return '';
  const s = String(value).trim();

  // Keep literal DATE values unchanged.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Convert ISO timestamp (e.g. 2026-03-08T17:00:00.000Z) to local date.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toTimeOnly = (value) => {
  if (!value) return '';
  return String(value).slice(0, 5);
};

const normalizeScheduleStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'done' || s === 'completed') return 'completed';
  if (s === 'active') return 'active';
  return 'upcoming';
};

const buildDisplayName = (militaryRank = '', fullName = '') => {
  const rank = String(militaryRank || '').trim();
  const name = String(fullName || '').trim();
  if (!rank) return name;
  if (!name) return rank;
  const lowerRank = rank.toLowerCase();
  let normalizedName = name;
  while (normalizedName.toLowerCase().startsWith(`${lowerRank} `)) {
    normalizedName = normalizedName.slice(rank.length).trim();
  }
  if (!normalizedName) return rank;
  return `${rank} ${normalizedName}`;
};

const resolveOfficerId = (profile, officers = []) => {
  if (!profile) return '';

  const email = (profile.email || '').toLowerCase().trim();
  const fullName = (profile.fullName || '').trim().toLowerCase();

  if (email) {
    const byEmail = officers.find((o) => (o.email || '').toLowerCase().trim() === email);
    if (byEmail?.id) return byEmail.id;
  }

  if (fullName) {
    const byName = officers.find((o) =>
      (o.hoTenDayDu || o.hoTen || '').trim().toLowerCase() === fullName
    );
    if (byName?.id) return byName.id;
  }

  return String(profile.id || '');
};

const resolveOfficerProfile = (profile, officers = []) => {
  if (!profile) return null;

  const email = (profile.email || '').toLowerCase().trim();
  const fullName = (profile.fullName || '').trim().toLowerCase();

  if (email) {
    const byEmail = officers.find((o) => (o.email || '').toLowerCase().trim() === email);
    if (byEmail) return byEmail;
  }

  if (fullName) {
    const byName = officers.find((o) =>
      (o.hoTenDayDu || o.hoTen || '').trim().toLowerCase() === fullName
    );
    if (byName) return byName;
  }

  return null;
};

const ROLE_BADGE = {
  'Quản trị viên': 'bg-purple-100 text-purple-700',
  'Quản lý':       'bg-blue-100 text-blue-700',
  'Cán bộ':        'bg-emerald-100 text-emerald-700',
};

const TaiKhoan = ({ user, onUserContactUpdated }) => {
  const [contactForm, setContactForm] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [savedContact, setSavedContact] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [contactResult, setContactResult] = useState({ type: '', message: '' });
  const [passwordResult, setPasswordResult] = useState({ type: '', message: '' });

  useEffect(() => {
    setContactForm({
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setSavedContact({
      email: user?.email || '',
      phone: user?.phone || '',
    });
  }, [user?.email, user?.phone]);

  const info = {
    avatar: user?.avatar || 'NA',
    hoTen: user?.name || 'Chưa có dữ liệu',
    chucVu: user?.position || 'Chưa cập nhật',
    donVi: user?.department || 'Chưa cập nhật',
    email: savedContact.email || 'Chưa cập nhật',
    phone: savedContact.phone || 'Chưa cập nhật',
    username: user?.username || 'unknown',
  };
  const badgeClass = ROLE_BADGE[user?.role] || 'bg-slate-100 text-slate-600';

  const handleUpdateMyContact = async (e) => {
    e.preventDefault();
    setContactResult({ type: '', message: '' });

    try {
      setContactLoading(true);
      await apiClient.auth.updateMyContact({
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
      });

      setSavedContact({
        email: contactForm.email.trim(),
        phone: contactForm.phone.trim(),
      });

      if (onUserContactUpdated) {
        onUserContactUpdated({
          email: contactForm.email.trim(),
          phone: contactForm.phone.trim(),
        });
      }

      setContactResult({
        type: 'success',
        message: 'Đã lưu thông tin liên hệ thành công.',
      });
    } catch (err) {
      setContactResult({
        type: 'error',
        message: err?.message || 'Không thể cập nhật thông tin liên hệ.',
      });
    } finally {
      setContactLoading(false);
    }
  };

  const handleChangeMyPassword = async (e) => {
    e.preventDefault();
    setPasswordResult({ type: '', message: '' });

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      setPasswordResult({
        type: 'error',
        message: 'Vui lòng nhập đầy đủ thông tin mật khẩu.',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordResult({
        type: 'error',
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordResult({
        type: 'error',
        message: 'Mật khẩu xác nhận không khớp.',
      });
      return;
    }

    try {
      setPasswordLoading(true);
      await apiClient.auth.changeMyPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setPasswordResult({
        type: 'success',
        message: 'Đổi mật khẩu thành công.',
      });
    } catch (err) {
      setPasswordResult({
        type: 'error',
        message: err?.message || 'Không thể đổi mật khẩu.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Thông tin tài khoản</h2>
      </div>
      <div className="card">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
            {info.avatar}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{info.hoTen}</h3>
            <p className="text-sm text-blue-600 font-medium">{info.chucVu}</p>
            <span className={'badge mt-1 ' + badgeClass}>&#x25CF; {user?.role}</span>
          </div>
        </div>
        <form className="space-y-3" onSubmit={handleUpdateMyContact}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên đăng nhập</label>
              <input className="input-field bg-slate-100" value={info.username} readOnly />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vai trò</label>
              <input className="input-field bg-slate-100" value={user?.role || ''} readOnly />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đơn vị</label>
              <input className="input-field bg-slate-100" value={info.donVi || ''} readOnly />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
              <input
                type="email"
                className="input-field"
                value={contactForm.email}
                onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@domain.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại</label>
              <input
                className="input-field"
                value={contactForm.phone}
                onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="VD: 0901234567"
              />
            </div>
          </div>

          {contactResult.message && (
            <div className={`text-sm rounded-xl px-3 py-2 ${contactResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {contactResult.message}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={contactLoading} className="btn-primary">
              {contactLoading ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      </div>
      <div className="card">
        <h4 className="text-sm font-bold text-slate-700 mb-1">Đổi mật khẩu</h4>
        <p className="text-xs text-slate-500 mb-4">Người dùng có thể tự đổi mật khẩu bất kỳ lúc nào.</p>
        <form className="space-y-3" onSubmit={handleChangeMyPassword}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu hiện tại</label>
              <input
                type="password"
                className="input-field"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Nhập mật khẩu hiện tại"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu mới</label>
              <input
                type="password"
                className="input-field"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                className="input-field"
                value={passwordForm.confirmNewPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>
          </div>

          {passwordResult.message && (
            <div className={`text-sm rounded-xl px-3 py-2 ${passwordResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {passwordResult.message}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={passwordLoading} className="btn-primary">
              {passwordLoading ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
const PAGE_COMPONENTS = {
  dashboard: Dashboard,
  thongbao: TatCaThongBao,
  canbo: QuanLyCanBo,
  lichcongtac: LichTongHop,
  lichcuatoi: LichCuaToi,
  ngayle: QuanLyNgayLe,
  phongban: QuanLyPhongBan,
  ykien: YKienPhanHoi,
  taikhoan: TaiKhoan,
};

const PAGE_ACCESS = {
  'Quản trị viên': ['dashboard', 'thongbao', 'canbo', 'lichcongtac', 'lichcuatoi', 'ykien', 'taikhoan'],
  'Quản lý': ['dashboard', 'thongbao', 'canbo', 'lichcongtac', 'lichcuatoi', 'ykien', 'taikhoan'],
  'Cán bộ': ['dashboard', 'thongbao', 'canbo', 'lichcongtac', 'lichcuatoi', 'ykien', 'taikhoan'],
};

const resolveAllowedPages = (currentUser) => {
  if (currentUser?.backendRole === 'superadmin') {
    return SUPERADMIN_PAGES;
  }
  if (currentUser?.isDelegatedAdmin) {
    return PAGE_ACCESS['Quản trị viên'] || ['dashboard'];
  }
  if (currentUser?.isDelegatedManager) {
    return PAGE_ACCESS['Quản lý'] || ['dashboard'];
  }
  return PAGE_ACCESS[currentUser?.role] || ['dashboard'];
};

function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState(() => getPageFromPath(typeof window !== 'undefined' ? window.location.pathname : '/'));
  const [loadingData, setLoadingData] = useState(false);
  const [canBoData, setCanBoData] = useState([]);
  const [lichCongTacData, setLichCongTacData] = useState([]);
  const [lichTrucBanData, setLichTrucBanData] = useState([]);
  const [yKienData, setYKienData] = useState([]);
  const [thongBaoData, setThongBaoData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [holidayData, setHolidayData] = useState([]);
  const [thongKeTheoThang, setThongKeTheoThang] = useState([]);
  const [hoatDongGanDay, setHoatDongGanDay] = useState([]);
  const [xuatLichHistory, setXuatLichHistory] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      
      // For managers, don't use accessScope='system' to allow backend filtering by department
      const officersFilter = user?.role === 'manager' ? {} : { accessScope: 'system' };
      
      const [officersRes, workRes, dutyRes, leaveRes, notificationsRes, dashboardRes, exportHistoryRes, holidaysRes, departmentsRes] = await Promise.all([
        apiClient.officers.list(1, 200, officersFilter),
        apiClient.workSchedules.list(1, 500),
        apiClient.dutySchedules.list(1, 500),
        apiClient.leaveRequests.list(1, 500),
        apiClient.notifications.list('all'),
        apiClient.dashboard.getOverview(),
        apiClient.exports.history(20),
        apiClient.holidays.list(),
        apiClient.departments.list(),
      ]);

      const mappedOfficers = (officersRes?.data || [])
        .map((o) => ({
          id: o.id,
          hoTen: buildDisplayName(o.officerTitle, o.fullName || o.officerName),
          capBac: o.officerTitle || '',
          hoTenDayDu: buildDisplayName(o.officerTitle, o.fullName || o.officerName),
          chucVu: o.position || '',
          donViId: o.departmentId || null,
          donVi: o.department || '',
          soDienThoai: o.phone || '',
          email: o.email || '',
          vaiTro: OFFICER_ROLE_TO_UI[o.role] || 'Cán bộ',
          trangThai: o.status || 'active',
          denNgayHoc: o.studyUntil || '',
          tuNgayCongTac: o.businessTripStartDate || '',
          denNgayCongTac: o.businessTripEndDate || '',
          canManageDutySchedules: Boolean(o.canManageDutySchedules),
          canManageDutySchedulesByDepartment: Boolean(o.canManageDutySchedulesByDepartment),
          canManageDutySchedulesByPermission: Boolean(o.canManageDutySchedulesByPermission),
          canCreateWorkSchedules: Boolean(o.canCreateWorkSchedules),
          canApproveWorkSchedules: Boolean(o.canApproveWorkSchedules),
          canCreateWorkSchedulesByRole: Boolean(o.canCreateWorkSchedulesByRole),
          canApproveWorkSchedulesByRole: Boolean(o.canApproveWorkSchedulesByRole),
          canCreateWorkSchedulesByPermission: Boolean(o.canCreateWorkSchedulesByPermission),
          canApproveWorkSchedulesByPermission: Boolean(o.canApproveWorkSchedulesByPermission),
          canGrantDutySchedulePermissions:
            o.canGrantDutySchedulePermissions === undefined
              ? undefined
              : Boolean(o.canGrantDutySchedulePermissions),
          avatar: (o.fullName || '')
            .split(' ')
            .filter(Boolean)
            .slice(-2)
            .map((x) => x[0])
            .join('')
            .toUpperCase() || 'CB',
        }))
        .sort((a, b) => {
          const roleDiff = (OFFICER_UI_ROLE_ORDER[a.vaiTro] || 99) - (OFFICER_UI_ROLE_ORDER[b.vaiTro] || 99);
          if (roleDiff !== 0) return roleDiff;
          return String(a.id).localeCompare(String(b.id));
        });

      const mappedWork = (workRes?.data || []).map((w) => ({
        id: w.id,
        tieuDe: w.title,
        ngay: toDateOnly(w.date),
        gioBatDau: toTimeOnly(w.startTime),
        gioKetThuc: toTimeOnly(w.endTime),
        diaDiem: w.location || '',
        nguoiPhuTrach: w.responsibleOfficerName || '',
        nguoiPhuTrachId: w.responsibleOfficerId || '',
        canBo1: w.officer1Name || '',
        canBo1Id: w.officer1Id || '',
        canBo2: w.officer2Name || '',
        canBo2Id: w.officer2Id || '',
        canBoTrucChiHuy: w.commanderOfficerName || '',
        canBoTrucChiHuyId: w.commanderOfficerId || '',
        donVi: w.departmentName || w.department || '',
        donViId: w.departmentId || null,
        nguoiTao: w.createdByOfficerName || w.createdByUserName || '',
        nguoiTaoUserId: w.createdByUserId || null,
        nguoiTaoOfficerId: w.createdByOfficerId || '',
        nguoiTaoDonViId: w.createdByDepartmentId || null,
        nguoiTaoDonVi: w.createdByDepartmentName || '',
        trangThaiDuyet: w.approvalStatus || 'approved',
        nguoiDuyet: w.approvedByName || '',
        duyetLuc: w.approvedAt || '',
        participants: (() => {
          if (!w.participants) return { units: [], boardMembers: [] };
          if (typeof w.participants === 'string') {
            try {
              return JSON.parse(w.participants);
            } catch {
              return { units: [], boardMembers: [] };
            }
          }
          return w.participants;
        })(),
        loai: w.type || 'hop',
        loaiLabel: WORK_TYPE_FALLBACK_LABEL[w.type] || w.type,
        tuanSo: w.weekNo,
        ghiChu: w.notes || '',
      }));

      const mappedDuty = (dutyRes?.data || []).map((d) => ({
        id: d.id,
        kieuTruc: d.dutyType === 'director_weekly' ? 'giamdoc' : 'canbo',
        loaiTruc: d.dutyType,
        canBoId: d.officerId,
        tenCanBo: d.officerName || d.officerId,
        ngay: toDateOnly(d.date),
        denNgay: toDateOnly(d.endDate),
        ca: d.shift || (d.dutyType === 'director_weekly' ? 'tuan' : 'nguyenday'),
        gioBatDau: toTimeOnly(d.startTime),
        gioKetThuc: toTimeOnly(d.endTime),
        viTri: d.location || '',
        vaiTroTruc: d.dutyRole || 'officer',
        slotNo: Number(d.slotNo || 1),
        nhomPhanCong: d.assignmentGroup || '',
        donVi: d.department || '',
        donViId: d.departmentId || null,
        ghiChu: d.notes || '',
      }));

      const mappedOpinions = (leaveRes?.data || []).map((o) => ({
        id: `YK${String(o.id).padStart(3, '0')}`,
        opinionId: o.id,
        canBoId: o.officerId,
        dutyScheduleId: o.dutyScheduleId || '',
        tenCanBo: o.officerName || o.officerId,
        ngayNghi: toDateOnly(o.leaveDate),
        noiDung: o.reason,
        trangThai: o.status,
        phanHoiAdmin: o.adminFeedback || '',
        createdAt: toTimeOnly(o.createdAt),
      }));

      const monthlyStats = dashboardRes?.data?.monthlyStats || [];
      const recentActivities = dashboardRes?.data?.recentActivities || [];
      const notifications = notificationsRes?.data || [];
      const exportHistory = exportHistoryRes?.data || [];
      const mappedHolidays = (holidaysRes?.data || []).map((h) => ({
        id: h.id,
        ngay: toDateOnly(h.holidayDate),
        ten: h.holidayName,
        loai: h.holidayType,
      }));
      const mappedDepartments = (departmentsRes?.data || []).map((d) => ({
        id: d.id,
        name: d.name,
        abbreviation: d.abbreviation || '',
        departmentType: d.departmentType,
        headOfficerId: d.headOfficerId || null,
        headOfficerName: d.headOfficerName || '',
        managerCount: Number(d.managerCount || 0),
        officerCount: Number(d.officerCount || 0),
      }));

      setCanBoData(mappedOfficers);
      setLichCongTacData(mappedWork);
      setLichTrucBanData(mappedDuty);
      setYKienData(mappedOpinions);
      setThongBaoData(notifications);
      setDepartmentData(mappedDepartments);
      setHolidayData(mappedHolidays);
      setThongKeTheoThang(monthlyStats);
      setHoatDongGanDay(recentActivities);
      setXuatLichHistory(exportHistory);

      return {
        mappedOfficers,
        mappedWork,
        mappedDuty,
        mappedOpinions,
      };
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setActivePage(getPageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (activePage) {
      sessionStorage.setItem('activePage', activePage);
    }
  }, [activePage]);

  useEffect(() => {
    const token = apiClient.getAuthToken();
    if (!token) return;

    const restoreSession = async () => {
      try {
        const res = await apiClient.auth.getProfile();
        const profile = res?.data;
        if (!profile) return;

        setUser({
          id: String(profile.officerId || profile.id),
          userId: profile.id,
          username: profile.username,
          name: profile.fullName,
          email: profile.email,
          phone: profile.phone || '',
          role: BACKEND_TO_UI_ROLE[profile.effectiveRole || profile.backendRole || profile.role] || 'Cán bộ',
          baseRole: BACKEND_TO_UI_ROLE[profile.role] || 'Cán bộ',
          backendRole: profile.backendRole || profile.effectiveRole || profile.role,
          effectiveBackendRole: profile.effectiveRole || profile.backendRole || profile.role,
          isDelegatedAdmin: Boolean(profile.isDelegatedAdmin),
          isDelegatedManager: Boolean(profile.isDelegatedManager),
          avatar: profile.avatar,
          position: profile.position || '',
          department: profile.department || '',
          departmentId: profile.departmentId || null,
          canManageDutySchedules: Boolean(profile.canManageDutySchedules),
          canManageDutySchedulesByDepartment: Boolean(profile.canManageDutySchedulesByDepartment),
          canManageDutySchedulesByPermission: Boolean(profile.canManageDutySchedulesByPermission),
          canGrantDutySchedulePermissions: Boolean(profile.canGrantDutySchedulePermissions),
          canCreateWorkSchedules: Boolean(profile.canCreateWorkSchedules),
          canApproveWorkSchedules: Boolean(profile.canApproveWorkSchedules),
          canCreateWorkSchedulesByRole: Boolean(profile.canCreateWorkSchedulesByRole),
          canApproveWorkSchedulesByRole: Boolean(profile.canApproveWorkSchedulesByRole),
          canCreateWorkSchedulesByPermission: Boolean(profile.canCreateWorkSchedulesByPermission),
          canApproveWorkSchedulesByPermission: Boolean(profile.canApproveWorkSchedulesByPermission),
          canGrantWorkSchedulePermissions: Boolean(profile.canGrantWorkSchedulePermissions),
        });

        const loaded = await loadData();
        const officerId = resolveOfficerId(profile, loaded?.mappedOfficers || []);
        const officerProfile = resolveOfficerProfile(profile, loaded?.mappedOfficers || []);

        setUser((prev) => ({
          ...prev,
          id: officerId || prev.id,
          position: officerProfile?.chucVu || prev.position,
          department: officerProfile?.donVi || prev.department,
          canManageDutySchedules: Boolean(officerProfile?.canManageDutySchedules ?? prev.canManageDutySchedules),
          canManageDutySchedulesByDepartment: Boolean(officerProfile?.canManageDutySchedulesByDepartment ?? prev.canManageDutySchedulesByDepartment),
          canManageDutySchedulesByPermission: Boolean(officerProfile?.canManageDutySchedulesByPermission ?? prev.canManageDutySchedulesByPermission),
          canGrantDutySchedulePermissions: Boolean(officerProfile?.canGrantDutySchedulePermissions ?? prev.canGrantDutySchedulePermissions),
          canCreateWorkSchedules: Boolean(officerProfile?.canCreateWorkSchedules ?? prev.canCreateWorkSchedules),
          canApproveWorkSchedules: Boolean(officerProfile?.canApproveWorkSchedules ?? prev.canApproveWorkSchedules),
          canCreateWorkSchedulesByRole: Boolean(officerProfile?.canCreateWorkSchedulesByRole ?? prev.canCreateWorkSchedulesByRole),
          canApproveWorkSchedulesByRole: Boolean(officerProfile?.canApproveWorkSchedulesByRole ?? prev.canApproveWorkSchedulesByRole),
          canCreateWorkSchedulesByPermission: Boolean(officerProfile?.canCreateWorkSchedulesByPermission ?? prev.canCreateWorkSchedulesByPermission),
          canApproveWorkSchedulesByPermission: Boolean(officerProfile?.canApproveWorkSchedulesByPermission ?? prev.canApproveWorkSchedulesByPermission),
        }));
      } catch (e) {
        apiClient.clearAuthToken();
      }
    };

    restoreSession();
  }, []);

  const handleLogin = async (userData) => {
    setUser({
      id: String(userData.officerId || userData.id),
      userId: userData.id,
      username: userData.username,
      name: userData.fullName,
      email: userData.email,
      phone: userData.phone || '',
      role: BACKEND_TO_UI_ROLE[userData.effectiveRole || userData.backendRole || userData.role] || 'Cán bộ',
      baseRole: BACKEND_TO_UI_ROLE[userData.role] || 'Cán bộ',
      backendRole: userData.backendRole || userData.effectiveRole || userData.role,
      effectiveBackendRole: userData.effectiveRole || userData.backendRole || userData.role,
      isDelegatedAdmin: Boolean(userData.isDelegatedAdmin),
      isDelegatedManager: Boolean(userData.isDelegatedManager),
      avatar: userData.avatar,
      position: userData.position || '',
      department: userData.department || '',
      departmentId: userData.departmentId || null,
      canManageDutySchedules: Boolean(userData.canManageDutySchedules),
      canManageDutySchedulesByDepartment: Boolean(userData.canManageDutySchedulesByDepartment),
      canManageDutySchedulesByPermission: Boolean(userData.canManageDutySchedulesByPermission),
      canGrantDutySchedulePermissions: Boolean(userData.canGrantDutySchedulePermissions),
      canCreateWorkSchedules: Boolean(userData.canCreateWorkSchedules),
      canApproveWorkSchedules: Boolean(userData.canApproveWorkSchedules),
      canCreateWorkSchedulesByRole: Boolean(userData.canCreateWorkSchedulesByRole),
      canApproveWorkSchedulesByRole: Boolean(userData.canApproveWorkSchedulesByRole),
      canCreateWorkSchedulesByPermission: Boolean(userData.canCreateWorkSchedulesByPermission),
      canApproveWorkSchedulesByPermission: Boolean(userData.canApproveWorkSchedulesByPermission),
      canGrantWorkSchedulePermissions: Boolean(userData.canGrantWorkSchedulePermissions),
    });
    setActivePage('dashboard');
    pushPagePath('dashboard');
    const loaded = await loadData();
    const officerId = resolveOfficerId(userData, loaded?.mappedOfficers || []);
    const officerProfile = resolveOfficerProfile(userData, loaded?.mappedOfficers || []);

    setUser((prev) => ({
      ...prev,
      id: officerId || prev.id,
      position: officerProfile?.chucVu || prev.position,
      department: officerProfile?.donVi || prev.department,
      canManageDutySchedules: Boolean(officerProfile?.canManageDutySchedules ?? prev.canManageDutySchedules),
      canManageDutySchedulesByDepartment: Boolean(officerProfile?.canManageDutySchedulesByDepartment ?? prev.canManageDutySchedulesByDepartment),
      canManageDutySchedulesByPermission: Boolean(officerProfile?.canManageDutySchedulesByPermission ?? prev.canManageDutySchedulesByPermission),
      canGrantDutySchedulePermissions: Boolean(officerProfile?.canGrantDutySchedulePermissions ?? prev.canGrantDutySchedulePermissions),
      canCreateWorkSchedules: Boolean(officerProfile?.canCreateWorkSchedules ?? prev.canCreateWorkSchedules),
      canApproveWorkSchedules: Boolean(officerProfile?.canApproveWorkSchedules ?? prev.canApproveWorkSchedules),
      canCreateWorkSchedulesByRole: Boolean(officerProfile?.canCreateWorkSchedulesByRole ?? prev.canCreateWorkSchedulesByRole),
      canApproveWorkSchedulesByRole: Boolean(officerProfile?.canApproveWorkSchedulesByRole ?? prev.canApproveWorkSchedulesByRole),
      canCreateWorkSchedulesByPermission: Boolean(officerProfile?.canCreateWorkSchedulesByPermission ?? prev.canCreateWorkSchedulesByPermission),
      canApproveWorkSchedulesByPermission: Boolean(officerProfile?.canApproveWorkSchedulesByPermission ?? prev.canApproveWorkSchedulesByPermission),
    }));
  };

  const handleLogout = () => {
    apiClient.clearAuthToken();
    setUser(null);
    setActivePage('dashboard');
    pushPagePath('dashboard');
  };

  const allowedPages = resolveAllowedPages(user);
  const defaultPage = allowedPages[0] || 'dashboard';
  const safeActivePage = allowedPages.includes(activePage) ? activePage : defaultPage;
  const navigateSafe = (page) => {
    if (allowedPages.includes(page)) {
      setActivePage(page);
      pushPagePath(page);
    }
  };

  const PageComponent = PAGE_COMPONENTS[safeActivePage] || PAGE_COMPONENTS[defaultPage] || Dashboard;

  useEffect(() => {
    if (user && safeActivePage) {
      pushPagePath(safeActivePage);
    }
  }, [safeActivePage, user]);
  if (!user) {
    return <LandingLogin onLogin={handleLogin} />;
  }

  const canReviewLeaveRequests = Boolean(
    user?.role === 'Quản lý'
    && String(user?.department || '').trim() === 'Phòng hành chính tổng hợp'
  );
  const canReviewWorkSchedules = Boolean(
    user?.canApproveWorkSchedules
    || user?.canApproveWorkSchedulesByRole
    || user?.canApproveWorkSchedulesByPermission
    || user?.backendRole === 'admin'
    || user?.backendRole === 'superadmin'
    || user?.isDelegatedAdmin
  );
  const pendingLeaveCount = canReviewLeaveRequests
    ? yKienData.filter((x) => x.trangThai === 'pending').length
    : 0;
  const pendingWorkCount = canReviewWorkSchedules
    ? lichCongTacData.filter((x) => x.trangThaiDuyet === 'pending').length
    : 0;
  const approvalPendingCount = pendingLeaveCount + pendingWorkCount;

  const pageProps = {
    user,
    onUserContactUpdated: ({ username, email, phone }) => {
      setUser((prev) => ({
        ...prev,
        username: username ?? prev.username,
        email: email ?? '',
        phone: phone ?? '',
      }));
    },
    onNavigate: navigateSafe,
    canBoData,
    departmentData,
    lichCongTacData,
    lichTrucBanData,
    yKienData,
    thongBaoData,
    holidayData,
    thongKeTheoThang,
    hoatDongGanDay,
    xuatLichHistory,
    onMarkNotificationRead: async (id) => {
      await apiClient.notifications.markRead(id);
      await loadData();
    },
    onMarkAllNotificationsRead: async () => {
      await apiClient.notifications.markAllRead();
      await loadData();
    },
    reloadData: loadData,
    approvalPendingCount,
    canReviewLeaveRequests,
    // Pass lichCongTacData to YKienPhanHoi for work schedule approval tab
    ...(safeActivePage === 'ykien' ? { lichCongTacData } : {}),
  };

  return (
    <MainLayout
      activePage={safeActivePage}
      onNavigate={navigateSafe}
      allowedPages={allowedPages}
      user={user}
      onLogout={handleLogout}
      notifications={thongBaoData}
      approvalPendingCount={approvalPendingCount}
      onMarkNotificationRead={async (id) => {
        await apiClient.notifications.markRead(id);
        await loadData();
      }}
      onMarkAllNotificationsRead={async () => {
        await apiClient.notifications.markAllRead();
        await loadData();
      }}
    >
      {loadingData ? (
        <div className="card text-center py-10 text-slate-500">Đang tải dữ liệu từ backend...</div>
      ) : (
        <PageComponent {...pageProps} />
      )}
    </MainLayout>
  );
}

export default App;
