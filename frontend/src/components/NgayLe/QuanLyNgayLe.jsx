import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Plus, PencilLine, Trash2, X } from 'lucide-react';
import apiClient from '../../services/api';

const initialForm = {
  holidayDate: '',
  holidayName: '',
  holidayType: 'holiday',
  isRecurring: false,
};

const typeLabels = {
  holiday: 'Nghỉ lễ',
  special_event: 'Sự kiện đặc biệt',
  flag_ceremony: 'Chào cờ',
};

const QuanLyNgayLe = ({ user, holidayData = [], reloadData }) => {
  const canEdit = user?.role === 'Quản trị viên';
  const [items, setItems] = useState(holidayData);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    setItems(holidayData);
  }, [holidayData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.ten.toLowerCase().includes(q) ||
      item.ngay.includes(q) ||
      typeLabels[item.loai]?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const openAdd = () => {
    setEditId(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      holidayDate: item.ngay,
      holidayName: item.ten,
      holidayType: item.loai,
      isRecurring: !!item.isRecurring,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.holidayDate || !form.holidayName.trim()) return;

    const payload = {
      holidayDate: form.holidayDate,
      holidayName: form.holidayName.trim(),
      holidayType: form.holidayType,
      isRecurring: !!form.isRecurring,
    };

    if (editId) {
      await apiClient.holidays.update(editId, payload);
    } else {
      await apiClient.holidays.create(payload);
    }

    if (reloadData) await reloadData();
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    await apiClient.holidays.delete(id);
    if (reloadData) await reloadData();
    setDeleteConfirm(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý ngày lễ</h2>
          <p className="text-sm text-slate-500 mt-0.5">Cập nhật lịch nghỉ lễ và chào cờ trực tiếp từ giao diện.</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Thêm ngày lễ
          </button>
        )}
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="flex-1 min-w-[220px]">
            <input
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên ngày lễ, ngày tháng, loại..."
            />
          </div>
          <span className="text-xs text-slate-400">{filtered.length} kết quả</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                {['Ngày', 'Tên ngày lễ', 'Loại', 'Lặp lại', ''].map((h) => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="table-td font-medium text-slate-700">{item.ngay}</td>
                  <td className="table-td text-slate-800 font-semibold">{item.ten}</td>
                  <td className="table-td">
                    <span className="badge bg-blue-100 text-blue-700">{typeLabels[item.loai] || item.loai}</span>
                  </td>
                  <td className="table-td text-slate-600">{item.isRecurring ? 'Có' : 'Không'}</td>
                  <td className="table-td">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Sửa">
                          <PencilLine size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Xóa">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <CalendarRange size={28} className="mx-auto mb-2 opacity-40" />
                    Chưa có ngày lễ nào.
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
              <div>
                <h3 className="text-base font-bold text-slate-800">{editId ? 'Sửa ngày lễ' : 'Thêm ngày lễ'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ngày</label>
                <input type="date" className="input-field" value={form.holidayDate} onChange={(e) => setForm((prev) => ({ ...prev, holidayDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên ngày lễ</label>
                <input className="input-field" value={form.holidayName} onChange={(e) => setForm((prev) => ({ ...prev, holidayName: e.target.value }))} placeholder="VD: Quốc khánh" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại</label>
                  <select className="input-field" value={form.holidayType} onChange={(e) => setForm((prev) => ({ ...prev, holidayType: e.target.value }))}>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm((prev) => ({ ...prev, isRecurring: e.target.checked }))} />
                  <span className="text-sm text-slate-700">Lặp lại hằng năm</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Hủy</button>
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">{editId ? 'Lưu' : 'Thêm'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Xóa ngày lễ?</h3>
            <p className="text-sm text-slate-500 mb-5">Bạn có chắc muốn xóa <span className="font-semibold text-slate-700">{deleteConfirm.ten}</span>?</p>
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

export default QuanLyNgayLe;