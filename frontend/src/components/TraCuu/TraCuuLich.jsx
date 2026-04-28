import React, { useState } from 'react';
import {
  Search, Filter, CalendarDays, Eye, X,
  MapPin, User, Clock, ChevronLeft, ChevronRight, FolderSearch
} from 'lucide-react';
import { CA_TRUC_COLORS } from '../../data/uiConstants';
import apiClient from '../../services/api';

const formatLongDate = (dateValue) => (
  new Date(dateValue).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
);

const isDirectorWeeklyDuty = (item) => (
  item?.type === 'trucban' && (item?.ca === 'tuan' || item?.kieuTruc === 'giamdoc')
);

const getDisplayDate = (item) => {
  if (isDirectorWeeklyDuty(item) && item.denNgay) {
    return `${formatLongDate(item.ngay)} - ${formatLongDate(item.denNgay)}`;
  }
  return formatLongDate(item.ngay);
};

const getDisplayTime = (item) => {
  if (isDirectorWeeklyDuty(item)) {
    return 'Cả tuần';
  }
  return `${item.gioBatDau} – ${item.gioKetThuc}`;
};

const TraCuuLich = ({ lichCongTacData = [], lichTrucBanData = [] }) => {
  const [keyword, setKeyword] = useState('');
  const [filterLoai, setFilterLoai] = useState('all'); // 'all' | 'congtac' | 'trucban'
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const perPage = 10;

  // Merge both lists into unified search
  const allItems = [
    ...lichCongTacData.map(l => ({ ...l, type: 'congtac' })),
    ...lichTrucBanData.map(t => ({ ...t, type: 'trucban',
      tieuDe: `Trực ban - ${t.tenCanBo} - ${CA_TRUC_COLORS[t.ca]?.label || 'Trực ban'}`,
      nguoiPhuTrach: t.tenCanBo, diaDiem: t.viTri, gioBatDau: t.gioBatDau, gioKetThuc: t.gioKetThuc
    })),
  ];

  const filtered = allItems.filter(item => {
    const q = keyword.toLowerCase();
    const matchKeyword = !q || item.tieuDe.toLowerCase().includes(q) || (item.nguoiPhuTrach || '').toLowerCase().includes(q) || (item.diaDiem || '').toLowerCase().includes(q);
    const matchLoai = filterLoai === 'all' || item.type === filterLoai;
    const matchMonth = !filterMonth || item.ngay.startsWith(filterMonth);
    return matchKeyword && matchLoai && matchMonth;
  }).sort((a, b) => b.ngay > a.ngay ? 1 : -1);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Group by date for calendar view
  const byDate = {};
  filtered.forEach(item => {
    if (!byDate[item.ngay]) byDate[item.ngay] = [];
    byDate[item.ngay].push(item);
  });
  const sortedDates = Object.keys(byDate).sort();

  const typeColors = { congtac: 'bg-blue-100 text-blue-700', trucban: 'bg-indigo-100 text-indigo-700' };
  const typeLabels = { congtac: '📅 Lịch sự kiện', trucban: '🛡 Lịch trực ban' };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tra cứu lịch</h2>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Keyword search */}
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Từ khóa tìm kiếm</label>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tên lịch, Họ và tên, địa điểm..."
                value={keyword}
                onChange={e => { setKeyword(e.target.value); setCurrentPage(1); }}
                className="input-field pl-9"
              />
              {keyword && (
                <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Type filter */}
          <div className="min-w-[160px]">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Loại lịch</label>
            <select value={filterLoai} onChange={e => { setFilterLoai(e.target.value); setCurrentPage(1); }} className="input-field">
              <option value="all">Tất cả</option>
              <option value="congtac">Lịch sự kiện</option>
              <option value="trucban">Lịch trực ban</option>
            </select>
          </div>

          {/* Month filter */}
          <div className="min-w-[150px]">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tháng</label>
            <input type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }} className="input-field" />
          </div>

          {/* Clear */}
          {(keyword || filterLoai !== 'all') && (
            <button
              onClick={() => { setKeyword(''); setFilterLoai('all'); setCurrentPage(1); }}
              className="btn-secondary !py-2.5">
              <X size={14} /> Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Result count + view toggle */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-600">{filtered.length}</span>
            <span className="text-sm text-slate-500">kết quả</span>
            {keyword && <span className="text-sm text-slate-400">cho "<span className="font-medium text-slate-600">{keyword}</span>"</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              ≡ Danh sách
            </button>
            <button onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              📅 Theo ngày
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* List view */
        <div className="card-lg p-0 overflow-hidden">
          {paged.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FolderSearch size={44} className="mx-auto mb-3 opacity-25" />
              <p className="text-sm font-medium">Không tìm thấy kết quả</p>
              <p className="text-xs mt-1 text-slate-300">Thử thay đổi từ khóa hoặc bộ lọc</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['Loại', 'Tên lịch', 'Ngày', 'Thời gian', 'Địa điểm / Vị trí', 'Người phụ trách', ''].map(h => (
                        <th key={h} className="table-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(item => {
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer group" onClick={() => setSelectedItem(item)}>
                          <td className="table-td">
                            <span className={`badge inline-flex items-center whitespace-nowrap text-[11px] ${typeColors[item.type]}`}>{typeLabels[item.type]}</span>
                          </td>
                          <td className="table-td max-w-[240px]">
                            <div className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{item.tieuDe}</div>
                          </td>
                          <td className="table-td whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">
                              {isDirectorWeeklyDuty(item)
                                ? `${new Date(item.ngay).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${new Date(item.denNgay || item.ngay).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                                : new Date(item.ngay).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </td>
                          <td className="table-td whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Clock size={11} className="text-slate-400" />
                              {getDisplayTime(item)}
                            </div>
                          </td>
                          <td className="table-td max-w-[180px]">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <MapPin size={11} className="text-slate-400 flex-shrink-0" />
                              <span>{item.diaDiem || item.viTri || '—'}</span>
                            </div>
                          </td>
                          <td className="table-td">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <User size={11} className="text-slate-400 flex-shrink-0" />
                              <span>{item.nguoiPhuTrach || '—'}</span>
                            </div>
                          </td>
                          <td className="table-td">
                            <button onClick={e => { e.stopPropagation(); setSelectedItem(item); }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Trang {currentPage}/{totalPages} · {filtered.length} mục</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                      <button key={i} onClick={() => setCurrentPage(i + 1)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Calendar / date-grouped view */
        <div className="space-y-3">
          {sortedDates.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">
              <FolderSearch size={40} className="mx-auto mb-2 opacity-25" />
              <p className="text-sm">Không có dữ liệu</p>
            </div>
          ) : sortedDates.map(date => {
            const items = byDate[date];
            const dateObj = new Date(date);
            const isToday = date === new Date().toISOString().slice(0, 10);
            const weekday = dateObj.toLocaleDateString('vi-VN', { weekday: 'long' });
            const dateLabel = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return (
              <div key={date} className="card">
                <div className={`flex items-center gap-3 mb-3 pb-3 border-b border-slate-100`}>
                  <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <div className={`text-lg font-extrabold leading-none ${isToday ? 'text-white' : 'text-slate-800'}`}>
                      {dateObj.getDate()}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                      /{dateObj.getMonth() + 1}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-bold capitalize ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                      {isToday ? '⭐ ' : ''}{weekday}{isToday ? ' (Hôm nay)' : ''}
                    </div>
                    <div className="text-xs text-slate-400">{items.length} lịch</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map(item => {
                    return (
                      <div key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer group">
                        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${item.type === 'congtac' ? 'bg-blue-400' : 'bg-indigo-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className={`badge inline-flex items-center whitespace-nowrap text-[10px] ${typeColors[item.type]}`}>{typeLabels[item.type]}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 mt-1 group-hover:text-blue-600 transition-colors line-clamp-1">{item.tieuDe}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-slate-500"><Clock size={10} />{getDisplayTime(item)}</div>
                            {(item.diaDiem || item.viTri) && <div className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={10} />{item.diaDiem || item.viTri}</div>}
                            {item.nguoiPhuTrach && <div className="flex items-center gap-1 text-xs text-slate-500"><User size={10} />{item.nguoiPhuTrach.split(' ').slice(-2).join(' ')}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <span className={`badge inline-flex items-center whitespace-nowrap text-xs mb-1 ${typeColors[selectedItem.type]}`}>{typeLabels[selectedItem.type]}</span>
                <h3 className="text-base font-bold text-slate-800 leading-tight mt-1">{selectedItem.tieuDe}</h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 ml-3"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { icon: '📅', label: 'Ngày', value: getDisplayDate(selectedItem) },
                { icon: '🕐', label: 'Thời gian', value: getDisplayTime(selectedItem) },
                { icon: '📍', label: 'Địa điểm', value: selectedItem.diaDiem || selectedItem.viTri || '—' },
                { icon: '👤', label: 'Người phụ trách', value: selectedItem.nguoiPhuTrach || '—' },
                { icon: '🏢', label: 'Đơn vị', value: selectedItem.donVi || '—' },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="text-base flex-shrink-0">{f.icon}</span>
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">{f.label}</div>
                    <div className="text-sm font-semibold text-slate-800">{f.value}</div>
                  </div>
                </div>
              ))}
              {selectedItem.ghiChu && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-xs text-amber-600 font-semibold mb-0.5">📝 Ghi chú</div>
                  <div className="text-sm text-slate-700">{selectedItem.ghiChu}</div>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setSelectedItem(null)} className="btn-secondary flex-1 justify-center">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraCuuLich;
