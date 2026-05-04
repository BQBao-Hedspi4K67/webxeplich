import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    department: officer?.donVi || user?.department || '',
  };
};

const getAssigneeTokens = (assignedTo) => {
  if (!assignedTo) return [];
  return String(assignedTo)
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
};

  const BAN_GIAM_DOC_NORMALIZED = simplify('Ban Giám đốc');

  const getWeekStart = (offset = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // move to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + offset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const formatDDMM = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatWeekRange = (weekStart) => {
    const start = formatDDMM(weekStart);
    const end = formatDDMM(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
    return `${start} - ${end}`;
  };

  const formatISODate = (d) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

const LichCuaToi = ({ user, canBoData = [], lichCongTacData = [], lichTrucBanData = [] }) => {
  const [typeFilter, setTypeFilter] = useState(() => sessionStorage.getItem('lichCuaToiType') || 'all');
  const [weekOffset, setWeekOffset] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const v = Number(window.localStorage.getItem('lichCuaToiWeekOffset'));
    return Number.isFinite(v) ? v : 0;
  });

  React.useEffect(() => {
    window.localStorage.setItem('lichCuaToiWeekOffset', String(weekOffset));
  }, [weekOffset]);

  React.useEffect(() => {
    sessionStorage.setItem('lichCuaToiType', typeFilter);
  }, [typeFilter]);

  const myIdentity = useMemo(() => buildMyIdentity(user, canBoData), [user, canBoData]);

  const myNameSet = useMemo(() => new Set(myIdentity.names.map(simplify).filter(Boolean)), [myIdentity]);

  const myDepartment = useMemo(() => simplify(myIdentity.department), [myIdentity.department]);

  const myWorkSchedules = useMemo(() => (
    lichCongTacData.filter((item) => {
      const assignees = [
        ...getAssigneeTokens(item.nguoiPhuTrach),
        ...getAssigneeTokens(item.canBo1),
        ...getAssigneeTokens(item.canBo2),
        ...getAssigneeTokens(item.canBoTrucChiHuy),
      ];
      if (assignees.some((name) => myNameSet.has(simplify(name)))) {
        return true;
      }
      
      if (item.participants?.boardMembers?.includes(myIdentity.officerId)) {
        return true;
      }
      
      if (myDepartment && item.participants?.units) {
        const units = Array.isArray(item.participants.units) ? item.participants.units : [];
        if (myDepartment !== BAN_GIAM_DOC_NORMALIZED && units.some(u => simplify(u) === myDepartment)) {
          return true;
        }
      }

      return false;
    })
  ), [lichCongTacData, myNameSet, myIdentity.officerId, myDepartment]);

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
        // filter by selected week
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        const weekStart = getWeekStart(weekOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const matchWeek = itemDate >= weekStart && itemDate <= weekEnd;
        const matchType = typeFilter === 'all' || item.type === typeFilter;
        return matchWeek && matchType;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [myWorkSchedules, myDutySchedules, weekOffset, typeFilter]);

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
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">Tuần</label>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl">
              <button onClick={() => setWeekOffset((w) => w - 1)}
                className="p-2 rounded-l-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all">
                <ChevronLeft size={16} />
              </button>
              <div className="flex-1 px-4 py-2 text-sm text-slate-700 font-bold text-center">
                {weekOffset === 0
                  ? `Tuần này (${formatWeekRange(getWeekStart(weekOffset))})`
                  : `Tuần ${formatISODate(getWeekStart(weekOffset))} - ${formatISODate(new Date(getWeekStart(weekOffset).getFullYear(), getWeekStart(weekOffset).getMonth(), getWeekStart(weekOffset).getDate() + 6))}`
                }
              </div>
              <button onClick={() => setWeekOffset((w) => w + 1)}
                className="p-2 rounded-r-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Loại lịch</label>
            <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="congtac">Lịch sự kiện</option>
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
