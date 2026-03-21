import React, { useEffect, useState } from 'react';
import { Search, Filter, Edit2, Trash2, Eye, X, UserCheck, Users, Phone, Mail, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../services/api';

const ROLES_COLORS = {
  'Lãnh đạo': { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Quản lý': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Cán bộ': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500', 'bg-teal-500', 'bg-amber-500', 'bg-red-500'];

const initialForm = { hoTen: '', chucVu: '', donVi: '', soDienThoai: '', email: '', vaiTro: 'Cán bộ', trangThai: 'active' };

const UI_ROLE_TO_BACKEND = {
  'Lãnh đạo': 'leader',
  'Quản lý': 'manager',
  'Cán bộ': 'officer',
};

const QuanLyCanBo = ({ user, canBoData = [], reloadData }) => {
  const canEdit = user?.role === 'Quản trị viên';
  const [data, setData] = useState(canBoData);
  const [search, setSearch] = useState('');
  const [filterVaiTro, setFilterVaiTro] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const perPage = 8;

  useEffect(() => {
    setData(canBoData);
  }, [canBoData]);

  const filtered = data.filter(cb => {
    const q = search.toLowerCase();
    const matchSearch = !q || cb.hoTen.toLowerCase().includes(q) || cb.id.toLowerCase().includes(q) || cb.donVi.toLowerCase().includes(q);
    const matchVaiTro = !filterVaiTro || cb.vaiTro === filterVaiTro;
    const matchTT = !filterTrangThai || cb.trangThai === filterTrangThai;
    return matchSearch && matchVaiTro && matchTT;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const openEdit = (cb) => { setForm({ ...cb }); setEditItem(cb.id); setShowModal(true); };

  const handleSave = async () => {
    if (!form.hoTen || !form.chucVu || !form.donVi) return;

    if (!editItem) {
      alert('Chức năng thêm cán bộ tại màn này đã được tắt. Vui lòng tạo tài khoản ở mục Quản trị tài khoản.');
      return;
    }

    const payload = {
      fullName: form.hoTen,
      position: form.chucVu,
      department: form.donVi,
      phone: form.soDienThoai || null,
      email: form.email || null,
      role: UI_ROLE_TO_BACKEND[form.vaiTro] || 'officer',
      status: form.trangThai,
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
    total: data.length,
    active: data.filter(c => c.trangThai === 'active').length,
    lanhdao: data.filter(c => c.vaiTro === 'Lãnh đạo').length,
    quanly: data.filter(c => c.vaiTro === 'Quản lý').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý cán bộ</h2>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý thông tin cán bộ. Tạo cán bộ mới thực hiện tại mục Quản trị tài khoản.</p>
        </div>
      </div>

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
          </div>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} kết quả</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Cán bộ', 'Chức vụ', 'Đơn vị', 'Liên hệ', 'Vai trò', 'Trạng thái', 'Thao tác'].map(h => (
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
                      <span className={`badge ${cb.trangThai === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cb.trangThai === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {cb.trangThai === 'active' ? 'Đang công tác' : 'Tạm nghỉ'}
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Họ và tên <span className="text-red-500">*</span></label>
                  <input className="input-field" placeholder="VD: Đại tá Nguyễn Văn A" value={form.hoTen} onChange={e => setForm({...form, hoTen: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Chức vụ <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="VD: Trưởng phòng" value={form.chucVu} onChange={e => setForm({...form, chucVu: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Đơn vị <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="VD: Phòng CNTT" value={form.donVi} onChange={e => setForm({...form, donVi: e.target.value})} />
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
                    </select>
                  </div>
                </div>
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
                  <span className={`badge mt-1 ${viewItem.trangThai === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {viewItem.trangThai === 'active' ? '● Đang công tác' : '● Tạm nghỉ'}
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
