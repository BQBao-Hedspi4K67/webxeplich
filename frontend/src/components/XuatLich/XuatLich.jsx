import React, { useState } from 'react';
import { FileText, Eye, Download, Check, Shield, CalendarDays } from 'lucide-react';
import apiClient from '../../services/api';

const XuatLich = ({ xuatLichHistory = [], reloadData }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const getIsoWeekNo = () => {
    const d = new Date();
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };
  const [exportType, setExportType] = useState('congtac');
  const [exportScope, setExportScope] = useState('week');
  const [weekNo, setWeekNo] = useState(getIsoWeekNo());
  const [monthValue, setMonthValue] = useState(currentMonth);
  const [previewReady, setPreviewReady] = useState(false);
  const [exported, setExported] = useState(false);
  const [previewData, setPreviewData] = useState({ workSchedules: [], dutySchedules: [] });
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handlePreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await apiClient.exports.preview({
        type: exportType,
        scope: exportScope,
        weekNo,
        month: monthValue,
      });
      setPreviewData(res?.data || { workSchedules: [], dutySchedules: [] });
      setPreviewReady(true);
    } catch (err) {
      alert(err?.message || 'Không thể tạo xem trước.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await apiClient.exports.download({
        type: exportType,
        scope: exportScope,
        weekNo,
        month: monthValue,
        format: 'pdf',
      });

      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 3000);
      if (reloadData) await reloadData();
    } catch (err) {
      alert(err?.message || 'Không thể xuất lịch.');
    }
  };

  const buildWorkResponsible = (x) => {
    const entries = [
      ['Người PT', x.responsibleOfficerName],
      ['Cán bộ 1', x.officer1Name],
      ['Cán bộ 2', x.officer2Name],
      ['Trực CH', x.commanderOfficerName],
    ].filter(([, value]) => Boolean(value));

    return entries.map(([label, value]) => `${label}: ${value}`).join(' | ');
  };

  const previewRows = [
    ...(previewData.workSchedules || []).map((x) => ({
      loai: 'Công tác',
      ngay: x.date,
      noiDung: x.title,
      thoiGian: `${String(x.startTime || '').slice(0, 5)}–${String(x.endTime || '').slice(0, 5)}`,
      phuTrach: x.responsibleSummary || buildWorkResponsible(x),
    })),
    ...(previewData.dutySchedules || []).map((x) => ({
      loai: 'Trực ban',
      ngay: x.date,
      noiDung: `Trực ban - ${x.officerName || ''}`,
      thoiGian: `${String(x.startTime || '').slice(0, 5)}–${String(x.endTime || '').slice(0, 5)}`,
      phuTrach: x.officerName || '',
    })),
  ].sort((a, b) => (a.ngay > b.ngay ? 1 : -1));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Xuất / In lịch</h2>
        <p className="text-sm text-slate-500 mt-0.5">Xuất lịch ra file hoặc in trực tiếp</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Config panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Tùy chọn xuất</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Loại lịch</label>
                <div className="space-y-2">
                  {[{ v: 'congtac', l: 'Lịch công tác', icon: CalendarDays },
                    { v: 'trucban', l: 'Lịch trực ban', icon: Shield },
                    { v: 'both', l: 'Cả hai loại', icon: FileText }].map(o => (
                    <label key={o.v} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${exportType === o.v ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" name="exportType" value={o.v} checked={exportType === o.v} onChange={e => setExportType(e.target.value)} className="sr-only" />
                      <o.icon size={16} className={exportType === o.v ? 'text-blue-600' : 'text-slate-400'} />
                      <span className={`text-sm font-medium ${exportType === o.v ? 'text-blue-700' : 'text-slate-600'}`}>{o.l}</span>
                      {exportType === o.v && <Check size={14} className="text-blue-600 ml-auto" />}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Khoảng thời gian</label>
                <div className="space-y-2">
                  <select className="input-field text-sm" value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
                    <option value="week">Theo tuần</option>
                    <option value="month">Theo tháng</option>
                  </select>
                  {exportScope === 'week' ? (
                    <input
                      type="number"
                      className="input-field text-sm"
                      min={1}
                      max={53}
                      value={weekNo}
                      onChange={(e) => setWeekNo(Number(e.target.value || 1))}
                      placeholder="Tuần số"
                    />
                  ) : (
                    <input
                      type="month"
                      className="input-field text-sm"
                      value={monthValue}
                      onChange={(e) => setMonthValue(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Định dạng xuất</label>
                <div className="py-2 px-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 text-center">
                  PDF
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button onClick={handlePreview} className="w-full btn-secondary justify-center" disabled={loadingPreview}>
                  <Eye size={15} /> {loadingPreview ? 'Đang tạo...' : 'Xem trước'}
                </button>
                <button onClick={handleExport}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${exported ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'}`}>
                  {exported ? <><Check size={15} /> Đã xuất!</> : <><Download size={15} /> Tải xuống PDF</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2">
          <div className="card-lg min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">Xem trước tài liệu</h3>
              {previewReady && <span className="badge bg-emerald-100 text-emerald-600">✓ Sẵn sàng xuất</span>}
            </div>

            {!previewReady ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                  <FileText size={36} className="opacity-40" />
                </div>
                <p className="text-sm font-medium text-slate-500">Chưa có bản xem trước</p>
                <p className="text-xs text-slate-400 mt-1">Nhấn "Xem trước" để tạo bản xem trước</p>
                <button onClick={handlePreview} className="btn-primary mt-4"><Eye size={14} /> Tạo bản xem trước</button>
              </div>
            ) : (
              <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                {/* Simulated document preview */}
                <div className="bg-white mx-6 my-5 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Document header */}
                  <div className="bg-gradient-to-r from-[#0d2240] to-[#1a4a8a] px-6 py-4 text-white text-center">
                    <div className="text-[11px] uppercase tracking-wider text-blue-200 mb-1">BỘ CÔNG AN – HỌC VIỆN KỸ THUẬT VÀ CÔNG NGHỆ AN NINH</div>
                    <div className="text-base font-bold">
                      {exportType === 'congtac' ? 'LỊCH CÔNG TÁC' : exportType === 'trucban' ? 'LỊCH TRỰC BAN' : 'LỊCH CÔNG TÁC & TRỰC BAN'}
                    </div>
                    <div className="text-xs text-blue-200 mt-1">{exportScope === 'week' ? `Tuần ${weekNo}` : `Tháng ${monthValue}`}</div>
                  </div>
                  {/* Document content preview */}
                  <div className="p-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left py-2 px-2 font-semibold text-slate-600 rounded-l">STT</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Ngày</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Nội dung</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Thời gian</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600 rounded-r">Phụ trách</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 20).map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            {[String(i + 1), row.ngay, row.noiDung, row.thoiGian, row.phuTrach].map((cell, j) => (
                              <td key={j} className={`py-2 px-2 text-slate-700 border-b border-slate-100 ${j === 2 ? 'font-medium' : ''}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                      <span>Ngày in: {new Date().toLocaleDateString('vi-VN')}</span>
                      <span>Dữ liệu lấy từ hệ thống hiện tại</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent exports */}
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Lịch sử xuất file gần đây</h3>
        <div className="space-y-2">
          {xuatLichHistory.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
              <div className="w-9 h-9 rounded-xl text-red-600 bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{`lich_${file.exportType}_${file.exportScope}.${file.exportFormat}`}</div>
                <div className="text-xs text-slate-400">{file.itemCount} mục · {new Date(file.createdAt).toLocaleString('vi-VN')}</div>
              </div>
              <button className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                <Download size={15} />
              </button>
            </div>
          ))}
          {xuatLichHistory.length === 0 && (
            <div className="text-sm text-slate-400">Chưa có lịch sử xuất.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default XuatLich;
