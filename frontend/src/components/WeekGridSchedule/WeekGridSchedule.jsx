import React, { useState } from 'react';
import { X, Clock, MapPin, Users } from 'lucide-react';

const SESSIONS = ['night', 'morning', 'afternoon'];
const SESSION_INFO = {
  night: { label: 'Đêm', range: '(00:00-08:00)' },
  morning: { label: 'Sáng', range: '(08:00-16:00)' },
  afternoon: { label: 'Chiều', range: '(16:00-24:00)' },
};

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toDateOnly = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  
  // Handle ISO datetime strings (e.g., "2026-04-27T00:00:00Z" or "2026-04-27T00:00:00")
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0]; // Return just the date part
  }
  
  // Handle Date objects
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocalDate(d);
};

const toTimeOnly = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 5);
};

const getSessionBucket = (timeValue) => {
  const hour = Number.parseInt(String(timeValue || '00:00').split(':')[0], 10);
  if (Number.isNaN(hour) || hour < 8) return 'night';
  if (hour < 16) return 'morning';
  return 'afternoon';
};

const buildDutyLabel = (duty) => {
  if (duty.viTri === 'Nhà hiệu bộ' && duty.vaiTroTruc === 'commander') return 'HB - Chỉ huy';
  if (duty.viTri === 'Nhà hiệu bộ' && Number(duty.slotNo || 1) === 1) return 'HB - Cán bộ 1';
  if (duty.viTri === 'Nhà hiệu bộ' && Number(duty.slotNo || 1) === 2) return 'HB - Cán bộ 2';
  return duty.viTri || 'Trực ban';
};

const buildDutySummaryLines = (duties = []) => {
  if (!duties.length) return [];
  const sortedDutyItems = [...duties].sort((a, b) => {
    const slotA = Number(a.slotNo || 1);
    const slotB = Number(b.slotNo || 1);
    if (a.kieuTruc !== b.kieuTruc) return a.kieuTruc === 'giamdoc' ? -1 : 1;
    if (a.viTri !== b.viTri) {
      const order = { 'Trực ban Giám đốc': 0, 'Nhà hiệu bộ': 1, 'Lái xe': 2, 'Bệnh xá': 3 };
      return (order[a.viTri] || 99) - (order[b.viTri] || 99);
    }
    return slotA - slotB;
  });

  const directorDuty = sortedDutyItems.find((item) => item.kieuTruc === 'giamdoc');
  const canboDuties = sortedDutyItems.filter((item) => item.kieuTruc === 'canbo');

  return [
    `Trực ban Giám đốc: ${directorDuty?.tenCanBo || 'Chưa phân công'}`,
    'Trực ban cán bộ:',
    ...(canboDuties.length > 0
      ? canboDuties.map((item) => `${buildDutyLabel(item)}: ${item.tenCanBo || 'Chưa phân công'}`)
      : ['Chưa phân công']),
  ];
};

const getBoardMemberLine = (participants) => {
  const labels = participants?.boardMemberLabels;
  if (!Array.isArray(labels) || !labels.length) return '';
  return `Ban giám đốc: ${labels.join(', ')}`;
};

const buildScheduleDetails = (schedule) => {
  const details = [schedule.tieuDe, schedule.diaDiem].filter(Boolean);
  const boardMemberLine = getBoardMemberLine(schedule.participants);
  const units = String(schedule.donVi || '')
    .split(',')
    .map((unit) => unit.trim())
    .filter(Boolean);
  const filteredUnits = boardMemberLine
    ? units.filter((unit) => unit.toLowerCase() !== 'ban giám đốc')
    : units;
  const participantLine = boardMemberLine
    ? [boardMemberLine, ...filteredUnits].join(', ')
    : filteredUnits.join(', ');
  if (participantLine) details.push(participantLine);
  return details;
};

const WeekGridSchedule = ({
  weekDates,
  duties = [],
  schedules = [],
  holidays = {},
  onSelectEvent = null,
}) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  const normalizedWeekDates = weekDates.map((rawDate, idx) => {
    const dateStr = toDateOnly(rawDate);
    let dateObj;
    
    if (dateStr) {
      // Parse dateStr as local date to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    } else {
      dateObj = new Date();
    }
    
    return {
      key: dateStr || `day-${idx}`,
      dateStr,
      dateObj,
      dayLabel: DAY_LABELS[idx] || '',
    };
  });

  // Group events by date and session
  const eventsByDateSession = {};
  normalizedWeekDates.forEach(({ dateStr, key }) => {
    eventsByDateSession[key] = {
      night: { duties: [], schedules: [] },
      morning: { duties: [], schedules: [] },
      afternoon: { duties: [], schedules: [] },
    };
  });

  // Add duties
  duties.forEach((duty) => {
    const startDate = toDateOnly(duty.ngay || duty.date);
    let endDate = toDateOnly(duty.denNgay || duty.endDate);
    const isWeeklyDirectorDuty = duty.kieuTruc === 'giamdoc' || duty.dutyType === 'director_weekly' || duty.ca === 'tuan';
    
    // If no explicit end date, use start date (single-day duty)
    if ((!endDate || !isWeeklyDirectorDuty) && startDate) {
      endDate = startDate;
    }
    
    if (!startDate || !endDate) return;

    const session = getSessionBucket(duty.gioBatDau || '00:00');

    normalizedWeekDates.forEach(({ dateStr, key }) => {
      if (!dateStr || !eventsByDateSession[key]) return;
      if (dateStr >= startDate && dateStr <= endDate) {
        eventsByDateSession[key][session].duties.push(duty);
      }
    });
  });

  // Add schedules
  schedules.forEach((schedule) => {
    const dateStr = toDateOnly(schedule.ngay || schedule.date);
    const target = normalizedWeekDates.find((item) => item.dateStr === dateStr);
    if (target && eventsByDateSession[target.key]) {
      const session = getSessionBucket(schedule.gioBatDau);
      eventsByDateSession[target.key][session].schedules.push(schedule);
    }
  });

  Object.values(eventsByDateSession).forEach((groupBySession) => {
    Object.values(groupBySession).forEach((group) => {
      group.schedules.sort((a, b) => String(a.gioBatDau || '').localeCompare(String(b.gioBatDau || '')));
    });
  });

  const handleEventHover = (event, e, type) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const details = type === 'duty'
      ? buildDutySummaryLines(event.items || [])
      : buildScheduleDetails(event);
    
    setHoveredEvent({ type, details });
    setTooltipPos({
      x: rect.left,
      y: rect.top - 10,
    });
  };

  const handleEventClick = (event, type, meta = {}) => {
    if (onSelectEvent) {
      onSelectEvent({ ...event, eventType: type, ...meta });
    } else {
      setSelectedEvent({ event, type, ...meta });
    }
  };

  return (
    <div className="w-full">
      {/* Week Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '12%' }} />
            {normalizedWeekDates.map(({ key }) => (
              <col key={`col-${key}`} style={{ width: `${88 / 7}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="px-4 py-3 text-left font-bold text-slate-700 w-[12%]"></th>
              {normalizedWeekDates.map(({ key, dateStr, dateObj, dayLabel }, idx) => {
                const day = dateObj.getDate();
                const month = dateObj.getMonth() + 1;
                const isWeekend = idx >= 5;
                return (
                  <th
                    key={key}
                    className={`px-3 py-3 text-center font-bold text-slate-700 border-l border-slate-200 max-w-0 ${isWeekend ? 'bg-slate-100' : ''}`}
                  >
                    <div className="text-xs">{dayLabel}</div>
                    <div className="text-sm font-semibold">{day}/{month}</div>
                    {holidays[dateStr] && (
                      <div className="text-[10px] text-red-600 mt-1 font-semibold break-words">{holidays[dateStr]}</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map((session) => (
              <tr key={session} className="border-b border-slate-200">
                <td className="px-4 py-3 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 align-top">
                  <div className="text-sm">{SESSION_INFO[session].label}</div>
                  <div className="text-[10px] text-slate-500">{SESSION_INFO[session].range}</div>
                </td>
                {normalizedWeekDates.map(({ key }, idx) => {
                  const { duties: dayDuties, schedules: daySchedules } = eventsByDateSession[key][session];
                  const dutyLines = buildDutySummaryLines(dayDuties);
                  const isWeekend = idx >= 5;
                  
                  return (
                    <td
                      key={`${key}-${session}`}
                      className={`px-3 py-2 align-top border-l border-slate-200 min-h-[120px] max-w-0 ${isWeekend ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}
                    >
                      <div className="space-y-2 min-w-0">
                        {dayDuties.length > 0 && (
                          <div
                            className="w-full min-w-0 overflow-hidden text-[11px] px-2 py-1 rounded-md transition-all duration-150 cursor-pointer hover:shadow-sm border border-current border-opacity-30 group/evt bg-blue-50 text-blue-700"
                            onMouseEnter={(e) => handleEventHover({ items: dayDuties }, e, 'duty')}
                            onMouseLeave={() => setHoveredEvent(null)}
                            onClick={() => handleEventClick({ items: dayDuties, session }, 'duty')}
                          >
                            <div className="font-bold whitespace-nowrap flex-shrink-0">00:00</div>
                            {dutyLines.map((line, lineIdx) => (
                              <div key={`${line}-${lineIdx}`} className={`mt-0.5 break-words ${lineIdx < 2 ? 'font-semibold' : ''}`}>
                                {line}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Schedules */}
                        {daySchedules.map((schedule, idx) => (
                          <div
                            key={`schedule-${schedule.id}-${idx}`}
                            className="w-full min-w-0 overflow-hidden text-[11px] px-2 py-1 rounded-md transition-all duration-150 cursor-pointer hover:shadow-sm border border-current border-opacity-30 group/evt bg-emerald-100 text-emerald-700"
                            onMouseEnter={(e) => handleEventHover(schedule, e, 'schedule')}
                            onMouseLeave={() => setHoveredEvent(null)}
                            onClick={() => handleEventClick(schedule, 'schedule')}
                          >
                            <div className="font-bold whitespace-nowrap flex-shrink-0">
                              {toTimeOnly(schedule.gioBatDau) || '—'}
                            </div>
                            <div className="font-medium mt-0.5 line-clamp-2 break-words group-hover/evt:underline">
                              {schedule.tieuDe || 'Sự kiện'}
                            </div>
                          </div>
                        ))}
                        
                        {dayDuties.length === 0 && daySchedules.length === 0 && (
                          <div className="text-slate-300 text-xs italic py-2">—</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {hoveredEvent && tooltipPos && (
        <div
          className="fixed z-40 bg-slate-900 text-white text-xs rounded-lg p-2 max-w-xs shadow-lg pointer-events-none"
          style={{
            left: Math.min(tooltipPos.x, window.innerWidth - 280) + 'px',
            top: tooltipPos.y - 40 + 'px',
          }}
        >
          <div className="space-y-1">
            {hoveredEvent.details.map((detail, idx) => (
              <div key={idx}>{detail}</div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedEvent && !onSelectEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {selectedEvent.type === 'duty' ? 'Chi tiết Lịch trực' : 'Chi tiết Sự kiện'}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-3">
              {selectedEvent.type === 'duty' ? (
                <>
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-1">Buổi</div>
                    <div className="text-slate-900">{SESSION_INFO[selectedEvent.event.session]?.label || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-1">Chi tiết lịch trực</div>
                    <div className="space-y-1 text-slate-900">
                      {buildDutySummaryLines(selectedEvent.event.items || []).map((line, idx) => (
                        <div key={`${line}-${idx}`}>{line}</div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-1">Tiêu đề</div>
                    <div className="text-slate-900">{selectedEvent.event.tieuDe}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-1">Thời gian</div>
                    <div className="flex items-center gap-2 text-slate-900">
                      <Clock size={14} />
                      {selectedEvent.event.gioBatDau} - {selectedEvent.event.gioKetThuc}
                    </div>
                  </div>
                  {selectedEvent.event.diaDiem && (
                    <div>
                      <div className="text-sm font-semibold text-slate-600 mb-1">Địa điểm</div>
                      <div className="flex items-start gap-2 text-slate-900">
                        <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                        {selectedEvent.event.diaDiem}
                      </div>
                    </div>
                  )}
                  {getBoardMemberLine(selectedEvent.event.participants) && (
                    <div>
                      <div className="text-sm font-semibold text-slate-600 mb-1">Tham gia</div>
                      <div className="flex items-start gap-2 text-slate-900">
                        <Users size={14} className="flex-shrink-0 mt-0.5" />
                        {getBoardMemberLine(selectedEvent.event.participants)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekGridSchedule;
