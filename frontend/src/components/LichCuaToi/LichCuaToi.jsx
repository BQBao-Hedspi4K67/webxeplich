import React, { useMemo, useState } from 'react';
import { CA_TRUC_COLORS, LOAI_LICH_COLORS } from '../../data/uiConstants';

const simplify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const toDateLabel = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue || '');
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toTimeRange = (start, end) => {
  const s = start || '--:--';
  const e = end || '--:--';
  return `${s} - ${e}`;
};

const buildMyIdentity = (user, canBoData = []) => {
  const normalizedUserName = simplify(user?.name);
  const normalizedEmail = simplify(user?.email);

  const officerById = canBoData.find((x) => String(x.id) === String(user?.id));
  const officerByName = canBoData.find((x) => simplify(x.hoTen) === normalizedUserName);
  const officerByEmail = canBoData.find((x) => simplify(x.email) === normalizedEmail);
  const officer = officerById || officerByEmail || officerByName || null;

  return {
    officerId: officer?.id || String(user?.id || ''),
    names: [user?.name, officer?.hoTen].filter(Boolean),
    emails: [user?.email, officer?.email].filter(Boolean),
  };
};

const getAssigneeTokens = (assignedTo) => {
  if (!assignedTo) return [];
  return String(assignedTo)
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
};

const LichCuaToi = ({ user, canBoData = [], lichCongTacData = [], lichTrucBanData = [] }) => {
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [typeFilter, setTypeFilter] = useState('all');

  const myIdentity = useMemo(() => buildMyIdentity(user, canBoData), [user, canBoData]);

  const myNameSet = useMemo(() => new Set(myIdentity.names.map(simplify).filter(Boolean)), [myIdentity]);

  const myWorkSchedules = useMemo(() => (
    lichCongTacData.filter((item) => {
      const assignees = getAssigneeTokens(item.nguoiPhuTrach);
      if (!assignees.length) return false;
      return assignees.some((name) => myNameSet.has(simplify(name)));
    })
  ), [lichCongTacData, myNameSet]);

  const myDutySchedules = useMemo(() => (
    lichTrucBanData.filter((item) => {
      if (String(item.canBoId) === String(myIdentity.officerId)) return true;
      return myNameSet.has(simplify(item.tenCanBo));
    })
  ), [lichTrucBanData, myIdentity.officerId, myNameSet]);

  const mergedRows = useMemo(() => {
    const workRows = myWorkSchedules.map((item) => ({
      id: `work-${item.id}`,
      baseId: item.id,
      type: 'congtac',
      title: item.tieuDe,
      date: item.ngay,
      endDate: '',
      time: toTimeRange(item.gioBatDau, item.gioKetThuc),
      place: item.diaDiem || '-',
      unit: item.donVi || '-',
      extra: LOAI_LICH_COLORS[item.loai]?.label || item.loaiLabel || 'Công tác',
    }));

    const dutyRows = myDutySchedules.map((item) => ({
      id: `duty-${item.id}`,
      baseId: item.id,
      type: 'trucban',
      title: item.kieuTruc === 'giamdoc' ? 'Trực ban giám đốc' : 'Trực ban cán bộ',
      date: item.ngay,
      endDate: item.denNgay || '',
      time: item.kieuTruc === 'giamdoc' ? 'Cả tuần' : toTimeRange(item.gioBatDau, item.gioKetThuc),
      place: item.viTri || '-',
      unit: '-',
      extra: CA_TRUC_COLORS[item.ca]?.label || 'Trực ban',
    }));

    return [...workRows, ...dutyRows]
      .filter((item) => {
        const matchMonth = !monthFilter || String(item.date || '').startsWith(monthFilter);
        const matchType = typeFilter === 'all' || item.type === typeFilter;
        return matchMonth && matchType;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [myWorkSchedules, myDutySchedules, monthFilter, typeFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch của tôi</h2>

        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tháng</label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Loại lịch</label>
            <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="congtac">Lịch công tác</option>
              <option value="trucban">Lịch trực ban</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card-lg p-0 overflow-hidden">
        {mergedRows.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <p className="text-sm font-medium">Chưa có lịch nào được phân công cho bạn</p>
            <p className="text-xs mt-1 text-slate-300">Khi có phân công mới, dữ liệu sẽ hiển thị tại đây</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr>
                  <th className="table-th">Loại</th>
                  <th className="table-th">Nội dung</th>
                  <th className="table-th">Ngày</th>
                  <th className="table-th">Thời gian</th>
                  <th className="table-th">Địa điểm / Vị trí</th>
                </tr>
              </thead>
              <tbody>
                {mergedRows.map((row) => {
                  const dateDisplay = row.endDate
                    ? `${toDateLabel(row.date)} - ${toDateLabel(row.endDate)}`
                    : toDateLabel(row.date);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="table-td whitespace-nowrap">
                        <span className={`badge ${row.type === 'congtac' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {row.type === 'congtac' ? 'Công tác' : 'Trực ban'}
                        </span>
                      </td>
                      <td className="table-td">
                        <div className="font-semibold text-slate-800 text-sm">{row.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{row.extra}</div>
                      </td>
                      <td className="table-td whitespace-nowrap text-sm text-slate-700">{dateDisplay}</td>
                      <td className="table-td whitespace-nowrap text-sm text-slate-700">{row.time}</td>
                      <td className="table-td text-sm text-slate-700">{row.place}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LichCuaToi;
