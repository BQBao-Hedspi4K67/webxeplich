import React, { useCallback, useEffect, useState } from 'react';
import Login from './pages/Login';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './components/Dashboard/Dashboard';
import QuanLyCanBo from './components/CanBo/QuanLyCanBo';
import LapLichCongTac from './components/LichCongTac/LapLichCongTac';
import LapLichTrucBan from './components/LichTrucBan/LapLichTrucBan';
import LichCuaToi from './components/LichCuaToi/LichCuaToi';
import TraCuuLich from './components/TraCuu/TraCuuLich';
import XuatLich from './components/XuatLich/XuatLich';
import QuanLyNgayLe from './components/NgayLe/QuanLyNgayLe';
import QuanLyPhongBan from './components/PhongBan/QuanLyPhongBan';
import YKienPhanHoi from './components/YKien/YKienPhanHoi';
import BangQuyTrinh from './components/QuyTrinh/BangQuyTrinh';
import { DEPARTMENTS, SCHOOLS } from './data/uiConstants';
import apiClient from './services/api';

const BACKEND_TO_UI_ROLE = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  officer: 'Cán bộ',
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

const UNIT_OPTIONS = ['Ban Giám đốc', ...DEPARTMENTS, ...SCHOOLS];

const WORK_TYPE_FALLBACK_LABEL = {
  hop: 'Họp',
  hoiThao: 'Hội thảo',
  tiepkhach: 'Tiếp khách',
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

const ROLE_PERMISSIONS = {
  'Quản trị viên': [
    { perm: 'Quản lý cán bộ',       granted: true  },
    { perm: 'Lập lịch công tác',     granted: true  },
    { perm: 'Lập lịch trực ban',     granted: true  },
    { perm: 'Phê duyệt lịch',         granted: true  },
    { perm: 'Xuất / In lịch',         granted: true  },
    { perm: 'Quản trị tài khoản',     granted: true  },
  ],
  'Quản lý': [
    { perm: 'Xem danh sách cán bộ',   granted: true  },
    { perm: 'Lập lịch công tác',     granted: true  },
    { perm: 'Lập lịch trực ban',     granted: true  },
    { perm: 'Phê duyệt lịch',         granted: true  },
    { perm: 'Xuất / In lịch',         granted: true  },
    { perm: 'Quản trị tài khoản',     granted: true },
  ],
  'Cán bộ': [
    { perm: 'Xem danh sách cán bộ',   granted: true  },
    { perm: 'Xem lịch công tác',      granted: true  },
    { perm: 'Xem lịch trực ban',      granted: true  },
    { perm: 'Phê duyệt lịch',         granted: false },
    { perm: 'Xuất / In lịch',         granted: true  },
    { perm: 'Quản trị tài khoản',     granted: false },
  ],
};

const ROLE_BADGE = {
  'Quản trị viên': 'bg-purple-100 text-purple-700',
  'Quản lý':       'bg-blue-100 text-blue-700',
  'Cán bộ':        'bg-emerald-100 text-emerald-700',
};

const TaiKhoan = ({ user, reloadData, departmentData = [] }) => {
  const canProvisionUser = ['Quản trị viên', 'Quản lý'].includes(user?.role);
  const accountDepartmentOptions = (departmentData || []).length
    ? departmentData.map((d) => ({ id: d.id, name: d.name }))
    : UNIT_OPTIONS.map((name, idx) => ({ id: idx + 1, name }));
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    position: '',
    departmentId: '',
    department: '',
    role: 'officer',
    status: 'active',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState({ type: '', message: '' });

  const info = {
    avatar: user?.avatar || 'NA',
    hoTen: user?.name || 'Chưa có dữ liệu',
    chucVu: user?.position || 'Chưa cập nhật',
    donVi: user?.department || 'Chưa cập nhật',
    email: user?.email || 'Chưa cập nhật',
    username: user?.username || 'unknown',
  };
  const perms = ROLE_PERMISSIONS[user?.role] || ROLE_PERMISSIONS['Cán bộ'];
  const badgeClass = ROLE_BADGE[user?.role] || 'bg-slate-100 text-slate-600';

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateResult({ type: '', message: '' });

    if (!createForm.username || !createForm.password || !createForm.fullName || !createForm.departmentId) {
      setCreateResult({
        type: 'error',
        message: 'Vui lòng nhập đầy đủ: tên đăng nhập, mật khẩu, họ tên, đơn vị.',
      });
      return;
    }

    try {
      setCreateLoading(true);
      await apiClient.auth.createUser({
        username: createForm.username.trim(),
        password: createForm.password,
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim() || null,
        phone: createForm.phone.trim() || null,
        position: createForm.position.trim() || null,
        departmentId: Number(createForm.departmentId),
        department: createForm.department,
        role: createForm.role,
        status: createForm.status,
      });

      if (reloadData) await reloadData();

      setCreateResult({
        type: 'success',
        message: 'Tạo tài khoản mới thành công.',
      });
      setCreateForm({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phone: '',
        position: '',
        departmentId: '',
        department: '',
        role: 'officer',
        status: 'active',
      });
    } catch (err) {
      setCreateResult({
        type: 'error',
        message: err?.message || 'Không thể tạo tài khoản mới.',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Quản trị tài khoản</h2>
        <p className="text-sm text-slate-500 mt-0.5">Quản lý thông tin tài khoản và phân quyền hệ thống</p>
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
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Tên đăng nhập', value: info.username },
            { label: 'Vai trò', value: user?.role },
            { label: 'Đơn vị', value: info.donVi },
            { label: 'Email', value: info.email },
          ].map((f, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl">
              <div className="text-xs text-slate-400 mb-0.5">{f.label}</div>
              <div className="text-sm font-semibold text-slate-800">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h4 className="text-sm font-bold text-slate-700 mb-3">Phân quyền hệ thống</h4>
        <div className="space-y-2">
          {perms.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-700">{p.perm}</span>
              <span className={p.granted ? 'badge bg-emerald-100 text-emerald-700' : 'badge bg-slate-100 text-slate-400'}>
                {p.granted ? 'Được phép' : 'Không cho phép'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {canProvisionUser && (
        <div className="card">
          <h4 className="text-sm font-bold text-slate-700 mb-1">Tạo tài khoản nội bộ</h4>
          <p className="text-xs text-slate-500 mb-4">Cán bộ, quản lý mới được cấp tài khoản bởi Ban Giám đốc hoặc Quản lý hiện có.</p>
          <form className="space-y-3" onSubmit={handleCreateUser}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên đăng nhập <span className="text-red-500">*</span></label>
                <input
                  className="input-field"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="vd: quanly_moi"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mật khẩu <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  className="input-field"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Nhập mật khẩu tạm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Họ và tên <span className="text-red-500">*</span></label>
                <input
                  className="input-field"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="user@domain.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại</label>
                <input
                  className="input-field"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="VD: 0901234567"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chức vụ</label>
                <input
                  className="input-field"
                  value={createForm.position}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, position: e.target.value }))}
                  placeholder="VD: Cán bộ phụ trách"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đơn vị <span className="text-red-500">*</span></label>
                <select
                  className="input-field"
                  value={createForm.departmentId}
                  onChange={(e) => {
                    const selected = accountDepartmentOptions.find((x) => String(x.id) === e.target.value);
                    setCreateForm((prev) => ({
                      ...prev,
                      departmentId: e.target.value,
                      department: selected?.name || '',
                    }));
                  }}
                >
                  <option value="">-- Chọn đơn vị --</option>
                  {accountDepartmentOptions.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vai trò</label>
                <select
                  className="input-field"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="officer">Cán bộ</option>
                  <option value="manager">Quản lý</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Trạng thái</label>
                <select
                  className="input-field"
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Tạm khóa</option>
                </select>
              </div>
            </div>

            {createResult.message && (
              <div className={`text-sm rounded-xl px-3 py-2 ${createResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {createResult.message}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={createLoading} className="btn-primary">
                {createLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
const PAGE_COMPONENTS = {
  dashboard: Dashboard,
  canbo: QuanLyCanBo,
  lichcongtac: LapLichCongTac,
  lichtrucan: LapLichTrucBan,
  lichcuatoi: LichCuaToi,
  tracuu: TraCuuLich,
  xuat: XuatLich,
  ngayle: QuanLyNgayLe,
  phongban: QuanLyPhongBan,
  ykien: YKienPhanHoi,
  quytrinh: BangQuyTrinh,
  taikhoan: TaiKhoan,
};

const PAGE_ACCESS = {
  'Quản trị viên': ['dashboard', 'canbo', 'lichcongtac', 'lichtrucan', 'lichcuatoi', 'tracuu', 'xuat', 'ngayle', 'phongban', 'ykien', 'quytrinh', 'taikhoan'],
  'Quản lý': ['dashboard', 'canbo', 'lichcongtac', 'lichtrucan', 'lichcuatoi', 'tracuu', 'xuat', 'ngayle', 'ykien', 'quytrinh', 'taikhoan'],
  'Cán bộ': ['dashboard', 'lichcongtac', 'lichtrucan', 'lichcuatoi', 'tracuu', 'xuat', 'ykien', 'quytrinh'],
};

function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
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
      const [officersRes, workRes, dutyRes, leaveRes, notificationsRes, dashboardRes, exportHistoryRes, holidaysRes, departmentsRes] = await Promise.all([
        apiClient.officers.list(1, 200),
        apiClient.workSchedules.list(1, 500),
        apiClient.dutySchedules.list(1, 500),
        apiClient.leaveRequests.list(1, 500),
        apiClient.notifications.list(30),
        apiClient.dashboard.getOverview(),
        apiClient.exports.history(20),
        apiClient.holidays.list(),
        apiClient.departments.list(),
      ]);

      const mappedOfficers = (officersRes?.data || [])
        .map((o) => ({
          id: o.id,
          hoTen: o.officerName || o.fullName,
          capBac: o.officerTitle || '',
          hoTenDayDu: o.fullName,
          chucVu: o.position || '',
          donViId: o.departmentId || null,
          donVi: o.department || '',
          soDienThoai: o.phone || '',
          email: o.email || '',
          vaiTro: OFFICER_ROLE_TO_UI[o.role] || 'Cán bộ',
          trangThai: o.status || 'active',
          denNgayHoc: o.studyUntil || '',
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
  }, []);

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
          role: BACKEND_TO_UI_ROLE[profile.role] || 'Cán bộ',
          backendRole: profile.role,
          avatar: profile.avatar,
          position: profile.position || '',
          department: profile.department || '',
          departmentId: profile.departmentId || null,
        });

        const loaded = await loadData();
        const officerId = resolveOfficerId(profile, loaded?.mappedOfficers || []);
        const officerProfile = resolveOfficerProfile(profile, loaded?.mappedOfficers || []);

        setUser((prev) => ({
          ...prev,
          id: officerId || prev.id,
          position: officerProfile?.chucVu || prev.position,
          department: officerProfile?.donVi || prev.department,
        }));
      } catch (e) {
        apiClient.clearAuthToken();
      }
    };

    restoreSession();
  }, [loadData]);

  const handleLogin = async (userData) => {
    setUser({
      id: String(userData.officerId || userData.id),
      userId: userData.id,
      username: userData.username,
      name: userData.fullName,
      email: userData.email,
      role: BACKEND_TO_UI_ROLE[userData.role] || 'Cán bộ',
      backendRole: userData.role,
      avatar: userData.avatar,
      position: userData.position || '',
      department: userData.department || '',
      departmentId: userData.departmentId || null,
    });
    setActivePage('dashboard');
    const loaded = await loadData();
    const officerId = resolveOfficerId(userData, loaded?.mappedOfficers || []);
    const officerProfile = resolveOfficerProfile(userData, loaded?.mappedOfficers || []);

    setUser((prev) => ({
      ...prev,
      id: officerId || prev.id,
      position: officerProfile?.chucVu || prev.position,
      department: officerProfile?.donVi || prev.department,
    }));
  };

  const handleLogout = () => {
    apiClient.clearAuthToken();
    setUser(null);
    setActivePage('dashboard');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const allowedPages = PAGE_ACCESS[user.role] || ['dashboard'];
  const safeActivePage = allowedPages.includes(activePage) ? activePage : 'dashboard';
  const navigateSafe = (page) => {
    if (allowedPages.includes(page)) setActivePage(page);
  };

  const PageComponent = PAGE_COMPONENTS[safeActivePage] || Dashboard;

  const pageProps = {
    user,
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
    reloadData: loadData,
  };

  return (
    <MainLayout
      activePage={safeActivePage}
      onNavigate={navigateSafe}
      user={user}
      onLogout={handleLogout}
      notifications={thongBaoData}
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
