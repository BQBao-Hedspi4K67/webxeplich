import React, { useEffect, useState, useRef } from 'react';
import { Search, Filter, Edit2, Trash2, Eye, X, UserCheck, Users, Phone, Mail, Building2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import apiClient from '../../services/api';
import { DEPARTMENTS, SCHOOLS } from '../../data/uiConstants';

const ROLES_COLORS = {
  'Lãnh đạo': { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Quản lý': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Cán bộ': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500', 'bg-teal-500', 'bg-amber-500', 'bg-red-500'];

const initialForm = { hoTen: '', capBac: '', chucVu: '', donVi: '', donViId: '', soDienThoai: '', email: '', vaiTro: 'Cán bộ', trangThai: 'active', denNgayHoc: '' };

const UI_ROLE_TO_BACKEND = {
  'Lãnh đạo': 'leader',
  'Quản lý': 'manager',
  'Cán bộ': 'officer',
};

const TITLE_OPTIONS = ['Thiếu tướng', 'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá', 'Đại úy', 'Thượng úy', 'Trung úy'];
const POSITION_OPTIONS = ['Giám đốc Học viện', 'Phó Giám đốc', 'Trưởng phòng', 'Phó trưởng phòng', 'Giảng viên', 'Cán bộ'];

const DEFAULT_UNIT_OPTIONS = ['Ban Giám đốc', ...DEPARTMENTS, ...SCHOOLS];

const QuanLyCanBo = ({ user, canBoData = [], departmentData = [], reloadData }) => {
  const isAdmin = user?.role === 'Quản trị viên';
  const isManager = user?.role === 'Quản lý';
  const canEdit = ['Quản trị viên', 'Quản lý'].includes(user?.role);
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
  const deptDropdownRef = useRef(null);
  const perPage = 8;

  useEffect(() => {
    setData(canBoData);
  }, [canBoData]);

  useEffect(() => {
    if (isManager) {
      setSelectedDepartment(user?.department || '');
      return;
    }

    if (isAdmin && !selectedDepartment) {
      setSelectedDepartment('');
    }
  }, [isAdmin, isManager, user?.department, selectedDepartment]);

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
    if (isManager) {
      return !user?.department || cb.donVi === user.department;
    }
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
    setForm({ ...cb, donViId: cb.donViId || unit?.id || '' });
    setEditItem(cb.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.hoTen || !form.chucVu || !form.donVi) return;

    if (!editItem) {
      alert('Chức năng thêm cán bộ tại màn này đã được tắt. Vui lòng tạo tài khoản ở mục Quản trị tài khoản.');
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
    };

    try {
      await apiClient.officers.update(editItem, payload);

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
              <option value="active">Đang công tác</option>
              <option value="inactive">Tạm nghỉ</option>
            </select>
            {!isManager && !isAdmin && (
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
                {['Quân hàm + Họ và tên', 'Chức vụ', 'Đơn vị', 'Liên hệ', 'Vai trò', 'Trạng thái', 'Thao tác'].map(h => (
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
                      <span className="text-sm text-slate-700">{cb.chucVu}</span>
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
                      <span className={`badge ${roleColor.bg} ${roleColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${roleColor.dot}`} />
                        {cb.vaiTro}
                      </span>
                    </td>
                    <td className="table-td">
                      <span className={`badge ${cb.trangThai === 'active' ? 'bg-emerald-100 text-emerald-700' : cb.trangThai === 'studying' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cb.trangThai === 'active' ? 'bg-emerald-500' : cb.trangThai === 'studying' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                        {cb.trangThai === 'active' ? 'Đang công tác' : cb.trangThai === 'studying' ? 'Đang học' : 'Tạm nghỉ'}
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
                      <option value="active">Đang công tác</option>
                      <option value="inactive">Tạm nghỉ</option>
                      <option value="studying">Đang học</option>
                    </select>
                  </div>
                </div>
                {form.trangThai === 'studying' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đang học đến ngày</label>
                    <input type="date" className="input-field" value={form.denNgayHoc || ''} onChange={e => setForm({...form, denNgayHoc: e.target.value})} />
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
                  <span className={`badge mt-1 ${viewItem.trangThai === 'active' ? 'bg-emerald-100 text-emerald-700' : viewItem.trangThai === 'studying' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {viewItem.trangThai === 'active' ? '● Đang công tác' : viewItem.trangThai === 'studying' ? '● Đang học' : '● Tạm nghỉ'}
                  </span>
                </div>
              </div>
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
