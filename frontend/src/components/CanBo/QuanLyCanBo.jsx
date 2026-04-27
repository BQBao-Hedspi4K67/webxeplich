import React, { useEffect, useState, useRef } from 'react';
import { Search, Filter, Edit2, Trash2, Eye, X, UserCheck, Users, Phone, Mail, Building2, ChevronLeft, ChevronRight, ChevronDown, Plus, Shield } from 'lucide-react';
import apiClient from '../../services/api';
import { DEPARTMENTS, SCHOOLS } from '../../data/uiConstants';

const ROLES_COLORS = {
  'Lãnh đạo': { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Quản lý': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Cán bộ': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500', 'bg-teal-500', 'bg-amber-500', 'bg-red-500'];

const initialForm = {
  hoTen: '',
  capBac: '',
  chucVu: '',
  donVi: '',
  donViId: '',
  soDienThoai: '',
  email: '',
  vaiTro: 'Cán bộ',
  trangThai: 'active',
  denNgayHoc: '',
  tuNgayCongTac: '',
  denNgayCongTac: '',
};

const OFFICER_STATUS_LABELS = {
  active: 'Đang làm',
  on_business_trip: 'Đang đi công tác',
  inactive: 'Tạm nghỉ',
  studying: 'Đang học',
};

const OFFICER_STATUS_STYLES = {
  active: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  on_business_trip: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  inactive: { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  studying: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
};

const UI_ROLE_TO_BACKEND = {
  'Lãnh đạo': 'leader',
  'Quản lý': 'manager',
  'Cán bộ': 'officer',
};

const TITLE_OPTIONS = ['Thiếu tướng', 'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá', 'Đại úy', 'Thượng úy', 'Trung úy'];
const POSITION_OPTIONS = ['Giám đốc Học viện', 'Phó Giám đốc', 'Trưởng phòng', 'Phó trưởng phòng', 'Giảng viên', 'Cán bộ'];
const ACCOUNT_RANK_OPTIONS = ['Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'];
const initialCreateForm = {
  militaryRank: '',
  fullName: '',
  email: '',
  phone: '',
  position: '',
  departmentId: '',
  department: '',
  role: 'officer',
  status: 'active',
  businessTripStartDate: '',
  businessTripEndDate: '',
  canManageDutySchedulesByPermission: false,
  canCreateWorkSchedulesByPermission: false,
  canApproveWorkSchedulesByPermission: false,
};

const DEFAULT_UNIT_OPTIONS = ['Ban Giám đốc', ...DEPARTMENTS, ...SCHOOLS];

const QuanLyCanBo = ({ user, canBoData = [], departmentData = [], reloadData }) => {
  const isAdmin = user?.role === 'Quản trị viên' || Boolean(user?.isDelegatedAdmin);
  const isManager = user?.role === 'Quản lý' || Boolean(user?.isDelegatedManager);
  const canEdit = false;
  const canProvisionUser = false;
  const canManageDelegation = isAdmin || isManager;
  const canGrantDutyPermission = Boolean(user?.canGrantDutySchedulePermissions);
  const canGrantWorkPermission = Boolean(user?.canGrantWorkSchedulePermissions);
  
  // Admin can delegate to manager and officer; Manager can only delegate to officers in their department
  const canDelegateToRole = (targetRole) => {
    if (isAdmin) return true; // Admin can delegate to any role
    if (isManager && targetRole === 'Cán bộ') return true; // Manager can only delegate to officers
    return false;
  };
  const unitOptions = (departmentData || []).length
    ? departmentData.map((d) => ({ id: d.id, name: d.name }))
    : DEFAULT_UNIT_OPTIONS.map((name, idx) => ({ id: idx + 1, name }));
  const departmentNameOptions = unitOptions.map((x) => x.name);
  const [data, setData] = useState(canBoData);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [filterVaiTro, setFilterVaiTro] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState('');
  const [filterDonVi, setFilterDonVi] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeptdropdown, setShowDeptDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState({ type: '', message: '' });
  const deptDropdownRef = useRef(null);
  const perPage = 8;

  useEffect(() => {
    setData(canBoData);
  }, [canBoData]);

  const [delegatedIds, setDelegatedIds] = useState([]);

  useEffect(() => {
    if (canManageDelegation) {
      apiClient.officers.getAdminDelegations().then(res => {
        if (res.data?.success || res.success) {
          const data = res.data?.data || res.data;
          setDelegatedIds(data?.delegatedOfficerIds || []);
        }
      }).catch(console.error);
    }
  }, [canManageDelegation]);

  const handleToggleDelegation = async (cb) => {
    const isDelegated = delegatedIds.includes(cb.id);
    try {
      const res = await apiClient.officers.updateAdminDelegation(cb.id, !isDelegated);
      if (res.data?.success || res.success) {
        if (!isDelegated) {
          setDelegatedIds(prev => [...prev, cb.id]);
        } else {
          setDelegatedIds(prev => prev.filter(id => id !== cb.id));
        }
        alert(res.data?.message || res.message || 'Cập nhật ủy quyền thành công');
      }
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Lỗi khi cập nhật ủy quyền');
    }
  };

  useEffect(() => {
    if (isAdmin && !selectedDepartment) {
      setSelectedDepartment('');
    }
  }, [isAdmin, selectedDepartment]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target)) {
        setShowDeptDropdown(false);
      }
    };
    if (showDeptdropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDeptdropdown]);

  const departmentScopedData = data.filter((cb) => {
    if (isAdmin) {
      return !selectedDepartment || cb.donVi === selectedDepartment;
    }
    return true;
  });

  const filtered = departmentScopedData.filter(cb => {
    const q = search.toLowerCase();
    const matchSearch = !q || cb.hoTen.toLowerCase().includes(q) || cb.id.toLowerCase().includes(q) || cb.donVi.toLowerCase().includes(q);
    const matchVaiTro = !filterVaiTro || cb.vaiTro === filterVaiTro;
    const matchTT = !filterTrangThai || cb.trangThai === filterTrangThai;
    const matchDonVi = !filterDonVi || cb.donVi === filterDonVi;
    return matchSearch && matchVaiTro && matchTT && matchDonVi;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const openEdit = (cb) => {
    const unit = unitOptions.find((x) => x.name === cb.donVi);
    setForm({
      ...cb,
      donViId: cb.donViId || unit?.id || '',
      canManageDutySchedulesByPermission: Boolean(cb.canManageDutySchedules),
      canCreateWorkSchedulesByPermission: Boolean(cb.canCreateWorkSchedules),
      canApproveWorkSchedulesByPermission: Boolean(cb.canApproveWorkSchedules),
      tuNgayCongTac: cb.tuNgayCongTac || '',
      denNgayCongTac: cb.denNgayCongTac || '',
    });
    setEditItem(cb.id);
    setShowModal(true);
  };

  const openCreateAccount = () => {
    const managerUnit = unitOptions.find((x) => x.name === user?.department);
    const defaultRole = isManager ? 'officer' : 'officer';
    setCreateForm({
      ...initialCreateForm,
      departmentId: isManager ? String(managerUnit?.id || '') : '',
      department: isManager ? (managerUnit?.name || user?.department || '') : '',
      role: defaultRole,
    });
    setCreateResult({ type: '', message: '' });
    setShowCreateModal(true);
  };

  const handleCreateAccount = async () => {
    setCreateResult({ type: '', message: '' });

    if (!createForm.fullName.trim() || !createForm.departmentId) {
      setCreateResult({
        type: 'error',
        message: 'Vui lòng nhập đầy đủ: họ tên, đơn vị.',
      });
      return;
    }

    if (createForm.status === 'on_business_trip' && (!createForm.businessTripStartDate || !createForm.businessTripEndDate)) {
      setCreateResult({
        type: 'error',
        message: 'Vui lòng nhập từ ngày và đến ngày khi chọn trạng thái đang đi công tác.',
      });
      return;
    }

    try {
      setCreateLoading(true);
      await apiClient.auth.createUser({
        fullName: createForm.fullName.trim(),
        militaryRank: createForm.militaryRank.trim() || null,
        email: createForm.email.trim() || null,
        phone: createForm.phone.trim() || null,
        position: createForm.position.trim() || null,
        departmentId: Number(createForm.departmentId),
        department: createForm.department,
        role: createForm.department === 'Ban Giám đốc' ? 'leader' : (isManager ? 'officer' : createForm.role),
        status: createForm.status,
        businessTripStartDate: createForm.status === 'on_business_trip' ? createForm.businessTripStartDate : null,
        businessTripEndDate: createForm.status === 'on_business_trip' ? createForm.businessTripEndDate : null,
        canManageDutySchedulesByPermission: Boolean(createForm.canManageDutySchedulesByPermission),
        canCreateWorkSchedulesByPermission: Boolean(createForm.canCreateWorkSchedulesByPermission),
        canApproveWorkSchedulesByPermission: Boolean(createForm.canApproveWorkSchedulesByPermission),
      });

      if (reloadData) await reloadData();

      setCreateResult({
        type: 'success',
        message: 'Tạo cán bộ và tài khoản nội bộ thành công. Username sinh tự động theo quy tắc mới, mật khẩu mặc định là 123456.',
      });
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateForm(initialCreateForm);
      }, 600);
    } catch (err) {
      setCreateResult({
        type: 'error',
        message: err?.message || 'Không thể tạo tài khoản nội bộ.',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.hoTen || !form.chucVu || !form.donVi) return;
    if (form.trangThai === 'on_business_trip' && (!form.tuNgayCongTac || !form.denNgayCongTac)) {
      alert('Vui lòng nhập từ ngày và đến ngày công tác.');
      return;
    }

    const payload = {
      fullName: [form.capBac, form.hoTen].filter(Boolean).join(' ').trim(),
      officerTitle: form.capBac || '',
      officerName: form.hoTen,
      position: form.chucVu,
      departmentId: form.donViId ? Number(form.donViId) : undefined,
      department: form.donVi,
      phone: form.soDienThoai || null,
      email: form.email || null,
      role: UI_ROLE_TO_BACKEND[form.vaiTro] || 'officer',
      status: form.trangThai,
      studyUntil: form.trangThai === 'studying' ? (form.denNgayHoc || null) : null,
      businessTripStartDate: form.trangThai === 'on_business_trip' ? (form.tuNgayCongTac || null) : null,
      businessTripEndDate: form.trangThai === 'on_business_trip' ? (form.denNgayCongTac || null) : null,
    };

    try {
      await apiClient.officers.update(editItem, payload);

      if (canGrantDutyPermission) {
        await apiClient.officers.updateDutySchedulePermission(
          editItem,
          Boolean(form.canManageDutySchedulesByPermission)
        );
      }

      if (canGrantWorkPermission) {
        await apiClient.officers.updateWorkSchedulePermission(editItem, {
          canCreateWorkSchedules: Boolean(form.canCreateWorkSchedulesByPermission),
          canApproveWorkSchedules: Boolean(form.canApproveWorkSchedulesByPermission),
        });
      }

      if (reloadData) await reloadData();
      setShowModal(false);
    } catch (err) {
      alert(err?.message || 'Không thể lưu cán bộ.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.officers.delete(id);
      if (reloadData) await reloadData();
      setDeleteConfirm(null);
    } catch (err) {
      alert(err?.message || 'Không thể xóa cán bộ.');
    }
  };

  const stats = {
    total: departmentScopedData.length,
    active: departmentScopedData.filter(c => c.trangThai === 'active').length,
    lanhdao: departmentScopedData.filter(c => c.vaiTro === 'Lãnh đạo').length,
    quanly: departmentScopedData.filter(c => c.vaiTro === 'Quản lý').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý cán bộ</h2>
        </div>
      </div>

      {(isAdmin || isManager) && (
        <div className="card p-3 relative">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Chọn phòng/đơn vị:</span>
            <div className="relative" ref={deptDropdownRef}>
              <button
                onClick={() => setShowDeptDropdown(!showDeptdropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-300 transition-all min-w-[200px] text-left text-sm"
              >
                <span className="flex-1 truncate">{selectedDepartment || 'Tất cả đơn vị'}</span>
                <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${showDeptdropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDeptdropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-80 max-h-96 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {!isManager && (
                      <label className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100">
                        <input
                          type="checkbox"
                          checked={!selectedDepartment}
                          onChange={() => {
                            setSelectedDepartment('');
                            setShowDeptDropdown(false);
                            setCurrentPage(1);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-slate-700 flex-1">Tất cả đơn vị</span>
                      </label>
                    )}
                    {(isManager ? [user?.department].filter(Boolean) : departmentNameOptions).map((dept) => {
                      const active = selectedDepartment === dept;
                      return (
                        <label key={dept} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {
                              setSelectedDepartment(dept);
                              setShowDeptDropdown(false);
                              setCurrentPage(1);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                          />
                          <span className="text-sm text-slate-700 flex-1">{dept}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng cán bộ', value: stats.total, color: 'text-slate-800', icon: Users, bg: 'bg-slate-100' },
          { label: 'Đang công tác', value: stats.active, color: 'text-emerald-600', icon: UserCheck, bg: 'bg-emerald-50' },
          { label: 'Lãnh đạo', value: stats.lanhdao, color: 'text-purple-600', icon: Users, bg: 'bg-purple-50' },
          { label: 'Quản lý', value: stats.quanly, color: 'text-blue-600', icon: Users, bg: 'bg-blue-50' },
        ].map((s, i) => (
          <div key={i} className="card flex items-center gap-3 py-3.5">
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

      {/* Table card */}
      <div className="card-lg p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo họ tên, mã CB, đơn vị..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="input-field pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-slate-400" />
            <select value={filterVaiTro} onChange={e => { setFilterVaiTro(e.target.value); setCurrentPage(1); }}
              className="input-field !w-auto !py-2 text-sm">
              <option value="">Tất cả vai trò</option>
              <option>Lãnh đạo</option><option>Quản lý</option><option>Cán bộ</option>
            </select>
            <select value={filterTrangThai} onChange={e => { setFilterTrangThai(e.target.value); setCurrentPage(1); }}
              className="input-field !w-auto !py-2 text-sm">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang làm</option>
              <option value="on_business_trip">Đang đi công tác</option>
              <option value="inactive">Tạm nghỉ</option>
              <option value="studying">Đang học</option>
            </select>
            {!(isAdmin || isManager) && (
              <select value={filterDonVi} onChange={e => { setFilterDonVi(e.target.value); setCurrentPage(1); }}
                className="input-field !w-auto !py-2 text-sm">
                <option value="">Tất cả phòng/đơn vị</option>
                {unitOptions.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
              </select>
            )}
          </div>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} kết quả</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Họ và tên', 'Chức vụ', 'Đơn vị', 'Liên hệ', 'Vai trò', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((cb, idx) => {
                const roleColor = ROLES_COLORS[cb.vaiTro] || ROLES_COLORS['Cán bộ'];
                const avColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <tr key={cb.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${avColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {cb.avatar}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{cb.hoTen}</div>
                          <div className="text-xs text-slate-400 font-mono">{cb.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <span className="text-sm text-slate-700 whitespace-nowrap">{cb.chucVu}</span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-slate-400" />
                        <span className="text-sm text-slate-600">{cb.donVi}</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone size={10} className="text-slate-400" />{cb.soDienThoai}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail size={10} className="text-slate-400" />{cb.email}
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <span className={`badge inline-flex items-center whitespace-nowrap ${roleColor.bg} ${roleColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${roleColor.dot}`} />
                        {cb.vaiTro}
                      </span>
                    </td>
                    <td className="table-td">
                      <span className={`badge inline-flex items-center whitespace-nowrap ${(OFFICER_STATUS_STYLES[cb.trangThai] || OFFICER_STATUS_STYLES.inactive).badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${(OFFICER_STATUS_STYLES[cb.trangThai] || OFFICER_STATUS_STYLES.inactive).dot}`} />
                        {OFFICER_STATUS_LABELS[cb.trangThai] || OFFICER_STATUS_LABELS.inactive}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewItem(cb)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Xem">
                          <Eye size={14} />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(cb)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Sửa">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setDeleteConfirm(cb)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Xóa">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {canManageDelegation && (
                          (isAdmin && (cb.vaiTro === 'Cán bộ' || cb.vaiTro === 'Quản lý')) ||
                          (isManager && cb.vaiTro === 'Cán bộ' && cb.donVi === user?.department)
                        ) && (
                          <button onClick={() => handleToggleDelegation(cb)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${delegatedIds.includes(cb.id) ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                            title={delegatedIds.includes(cb.id) ? 'Bỏ ủy quyền' : 'Ủy quyền'}>
                            {delegatedIds.includes(cb.id) ? 'Bỏ ủy quyền' : 'Ủy quyền'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Không tìm thấy kết quả phù hợp</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Trang {currentPage}/{totalPages} · {filtered.length} cán bộ
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 transition-all">
                <ChevronLeft size={14} />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Tạo tài khoản nội bộ</h3>
                <p className="text-xs text-slate-500 mt-0.5">Nhập thông tin cán bộ để tạo tài khoản (mật khẩu mặc định: 123456).</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Quân hàm</label>
                  <select
                    className="input-field"
                    value={createForm.militaryRank}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, militaryRank: e.target.value }))}
                  >
                    <option value="">-- Chọn quân hàm --</option>
                    {ACCOUNT_RANK_OPTIONS.map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
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
                      const selected = unitOptions.find((x) => String(x.id) === e.target.value);
                      setCreateForm((prev) => ({
                        ...prev,
                        departmentId: e.target.value,
                        department: selected?.name || '',
                        role: selected?.name === 'Ban Giám đốc' ? 'leader' : 'officer',
                      }));
                    }}
                    disabled={isManager}
                  >
                    <option value="">-- Chọn đơn vị --</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vai trò</label>
                  {createForm.department === 'Ban Giám đốc' ? (
                    <select className="input-field" value="leader" disabled>
                      <option value="leader">Lãnh đạo</option>
                    </select>
                  ) : (
                    <select
                      className="input-field"
                      value={createForm.role}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                      disabled={isManager}
                    >
                      <option value="officer">Cán bộ</option>
                      {!isManager && <option value="manager">Quản lý</option>}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Trạng thái</label>
                  <select
                    className="input-field"
                    value={createForm.status}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="active">Đang làm</option>
                    <option value="on_business_trip">Đang đi công tác</option>
                    <option value="inactive">Tạm nghỉ</option>
                    <option value="studying">Đang học</option>
                  </select>
                </div>
              </div>

              {createForm.status === 'on_business_trip' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Từ ngày công tác</label>
                    <input
                      type="date"
                      className="input-field"
                      value={createForm.businessTripStartDate}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, businessTripStartDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đến ngày công tác</label>
                    <input
                      type="date"
                      className="input-field"
                      value={createForm.businessTripEndDate}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, businessTripEndDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">Phân quyền lịch</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Chọn quyền cần cấp ngay khi tạo cán bộ.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(createForm.canManageDutySchedulesByPermission)}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, canManageDutySchedulesByPermission: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  Cấp quyền lập/sửa lịch trực ban
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(createForm.canCreateWorkSchedulesByPermission)}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, canCreateWorkSchedulesByPermission: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  Cấp quyền tạo lịch công tác
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(createForm.canApproveWorkSchedulesByPermission)}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, canApproveWorkSchedulesByPermission: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  Cấp quyền duyệt lịch công tác
                </label>
              </div>

              {createResult.message && (
                <div className={`text-sm rounded-xl px-3 py-2 ${createResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {createResult.message}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleCreateAccount} disabled={createLoading} className="btn-primary flex-1 justify-center">
                {createLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Chỉnh sửa cán bộ</h3>
                <p className="text-xs text-slate-400 mt-0.5">Mã: {editItem}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cấp bậc / danh xưng</label>
                    <select className="input-field" value={form.capBac || ''} onChange={e => setForm({...form, capBac: e.target.value})}>
                      <option value="">-- Chọn cấp bậc --</option>
                      {TITLE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Họ và tên <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="VD: Nguyễn Văn A" value={form.hoTen} onChange={e => setForm({...form, hoTen: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chức vụ <span className="text-red-500">*</span></label>
                    <select className="input-field" value={form.chucVu} onChange={e => setForm({...form, chucVu: e.target.value})}>
                      <option value="">-- Chọn chức vụ --</option>
                      {POSITION_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đơn vị <span className="text-red-500">*</span></label>
                    <select
                      className="input-field"
                      value={form.donViId || ''}
                      onChange={e => {
                        const selected = unitOptions.find((x) => String(x.id) === e.target.value);
                        setForm({ ...form, donViId: e.target.value, donVi: selected?.name || '' });
                      }}
                      disabled={user?.role === 'Quản lý'}
                    >
                      <option value="">-- Chọn đơn vị --</option>
                      {unitOptions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại</label>
                    <input className="input-field" placeholder="09xxxxxxxx" value={form.soDienThoai} onChange={e => setForm({...form, soDienThoai: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                    <input className="input-field" placeholder="email@hvktcnan.edu.vn" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vai trò</label>
                    <select className="input-field" value={form.vaiTro} onChange={e => setForm({...form, vaiTro: e.target.value})}>
                      <option>Lãnh đạo</option><option>Quản lý</option><option>Cán bộ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Trạng thái</label>
                    <select className="input-field" value={form.trangThai} onChange={e => setForm({...form, trangThai: e.target.value})}>
                      <option value="active">Đang làm</option>
                      <option value="on_business_trip">Đang đi công tác</option>
                      <option value="inactive">Tạm nghỉ</option>
                      <option value="studying">Đang học</option>
                    </select>
                  </div>
                </div>
                {(canGrantDutyPermission || canGrantWorkPermission) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">Phân quyền lịch</h4>
                    {canGrantDutyPermission && (
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(form.canManageDutySchedulesByPermission)}
                          onChange={(e) => setForm({ ...form, canManageDutySchedulesByPermission: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        Cấp quyền lập/sửa lịch trực ban
                      </label>
                    )}
                    {canGrantWorkPermission && (
                      <>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(form.canCreateWorkSchedulesByPermission)}
                            onChange={(e) => setForm({ ...form, canCreateWorkSchedulesByPermission: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          Cấp quyền tạo lịch công tác
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(form.canApproveWorkSchedulesByPermission)}
                            onChange={(e) => setForm({ ...form, canApproveWorkSchedulesByPermission: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          Cấp quyền duyệt lịch công tác
                        </label>
                      </>
                    )}
                  </div>
                )}
                {form.trangThai === 'studying' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đang học đến ngày</label>
                    <input type="date" className="input-field" value={form.denNgayHoc || ''} onChange={e => setForm({...form, denNgayHoc: e.target.value})} />
                  </div>
                )}
                {form.trangThai === 'on_business_trip' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Từ ngày công tác</label>
                      <input type="date" className="input-field" value={form.tuNgayCongTac || ''} onChange={e => setForm({...form, tuNgayCongTac: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đến ngày công tác</label>
                      <input type="date" className="input-field" value={form.denNgayCongTac || ''} onChange={e => setForm({...form, denNgayCongTac: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Thông tin cán bộ</h3>
              <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {viewItem.avatar}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">{viewItem.hoTen}</h4>
                  <p className="text-sm text-slate-500">{viewItem.chucVu}</p>
                  <span className={`badge mt-1 ${(OFFICER_STATUS_STYLES[viewItem.trangThai] || OFFICER_STATUS_STYLES.inactive).badge}`}>
                    {`● ${OFFICER_STATUS_LABELS[viewItem.trangThai] || OFFICER_STATUS_LABELS.inactive}`}
                  </span>
                </div>
              </div>
              {viewItem.trangThai === 'on_business_trip' && (
                <div className="mb-4 p-3 bg-cyan-50 rounded-xl border border-cyan-100 text-sm text-cyan-700">
                  Thời gian công tác: {viewItem.tuNgayCongTac || 'Chưa cập nhật'} - {viewItem.denNgayCongTac || 'Chưa cập nhật'}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Mã cán bộ', value: viewItem.id, icon: '🪪' },
                  { label: 'Đơn vị', value: viewItem.donVi, icon: '🏢' },
                  { label: 'Vai trò', value: viewItem.vaiTro, icon: '👤' },
                  { label: 'Điện thoại', value: viewItem.soDienThoai, icon: '📞' },
                  { label: 'Email', value: viewItem.email, icon: '📧' },
                ].map((field, i) => (
                  <div key={i} className={`p-3 bg-slate-50 rounded-xl ${i === 4 ? 'col-span-2' : ''}`}>
                    <div className="text-xs text-slate-400 mb-0.5">{field.icon} {field.label}</div>
                    <div className="text-sm font-semibold text-slate-800">{field.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setViewItem(null)} className="btn-secondary flex-1 justify-center">Đóng</button>
              {canEdit && (
                <button onClick={() => { openEdit(viewItem); setViewItem(null); }} className="btn-primary flex-1 justify-center">
                  <Edit2 size={14} /> Chỉnh sửa
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-in-up">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Xác nhận xóa</h3>
            <p className="text-sm text-slate-500 mb-5">
              Bạn có chắc muốn xóa cán bộ <span className="font-semibold text-slate-700">"{deleteConfirm.hoTen}"</span>?
              Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger flex-1 justify-center">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuanLyCanBo;
