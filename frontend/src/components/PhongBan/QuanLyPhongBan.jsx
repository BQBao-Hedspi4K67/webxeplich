import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, PencilLine, Trash2, X } from 'lucide-react';
import apiClient from '../../services/api';

const TYPE_LABEL = {
  ban_giam_doc: 'Ban Giám đốc',
  phong: 'Phòng ban',
  khoa: 'Khoa',
  doi: 'Đội',
};

const initialForm = {
  name: '',
  departmentType: 'phong',
};

const QuanLyPhongBan = ({ user, departmentData = [], reloadData }) => {
  const canEdit = user?.role === 'Quản trị viên';
  const [items, setItems] = useState(departmentData);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setItems(departmentData);
  }, [departmentData]);

  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) =>
      String(x.name || '').toLowerCase().includes(q)
      || String(TYPE_LABEL[x.departmentType] || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const openCreate = () => {
    setEditItem(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      departmentType: item.departmentType,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editItem) {
      await apiClient.departments.update(editItem.id, {
        name: form.name.trim(),
        departmentType: form.departmentType,
      });
    } else {
      await apiClient.departments.create({
        name: form.name.trim(),
        departmentType: form.departmentType,
      });
    }

    if (reloadData) await reloadData();
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await apiClient.departments.delete(deleteItem.id);
    if (reloadData) await reloadData();
    setDeleteItem(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý phòng ban</h2>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Thêm phòng ban
          </button>
        )}
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <input
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên phòng ban/khoa..."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="table-th w-[30%]">Tên đơn vị</th>
                <th className="table-th w-[15%]">Loại</th>
                <th className="table-th w-[25%]">Trưởng phòng</th>
                <th className="table-th w-[20%]">Nhân sự</th>
                <th className="table-th w-[10%]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="table-td font-semibold text-slate-800">{item.name}</td>
                  <td className="table-td">
                    <span className="badge bg-blue-100 text-blue-700">{TYPE_LABEL[item.departmentType] || item.departmentType}</span>
                  </td>
                  <td className="table-td text-sm text-slate-600">{item.headOfficerName || 'Chưa gán'}</td>
                  <td className="table-td">
                    <div className="text-sm text-slate-600">
                      TP: {item.managerCount || 0} · Cán bộ: {item.officerCount || 0}
                    </div>
                    {item.departmentType === 'phong' && ((item.managerCount || 0) < 1 || (item.officerCount || 0) < 2) && (
                      <div className="text-xs text-amber-600 mt-1">Cần tối thiểu 1 trưởng phòng + 2 cán bộ</div>
                    )}
                  </td>
                  <td className="table-td">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                          <PencilLine size={14} />
                        </button>
                        <button onClick={() => setDeleteItem(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    <Building2 size={26} className="mx-auto mb-2 opacity-40" />
                    Chưa có phòng ban nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{editItem ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên đơn vị</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại</label>
                <select className="input-field" value={form.departmentType} onChange={(e) => setForm((prev) => ({ ...prev, departmentType: e.target.value }))}>
                  <option value="phong">Phòng ban</option>
                  <option value="khoa">Khoa</option>
                  <option value="doi">Đội</option>
                  <option value="ban_giam_doc">Ban Giám đốc</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">{editItem ? 'Lưu' : 'Thêm'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Xóa phòng ban?</h3>
            <p className="text-sm text-slate-500 mb-5">Bạn có chắc muốn xóa <span className="font-semibold text-slate-700">{deleteItem.name}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleDelete} className="btn-danger flex-1 justify-center">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuanLyPhongBan;
