import pool from '../config/database.js';
import { DUTY_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  ensureDutyScheduleAccessSchema,
  getDutyScheduleAccessState,
} from '../utils/dutyScheduleAccess.js';
import {
  ensureNotificationTargetingSchema,
  createUserNotification,
  resolveUserIdByOfficerId,
} from '../utils/notificationTargeting.js';

const LOCATION = {
  HB: 'Nhà hiệu bộ',
  DRIVER: 'Lái xe',
  MEDIC: 'Bệnh xá',
  DIRECTOR: 'Trực ban Giám đốc',
};

const TEAM_NAME = {
  DRIVER: 'Đội lái xe',
  MEDIC: 'Đội bệnh xá',
};

const LOCATION_ALIAS = {
  'Nhà xe': LOCATION.DRIVER,
  'Trạm xá': LOCATION.MEDIC,
};

const COMMANDER_POSITION_PATTERN = /(PT\s*Kh[oó]a|Ph[oó]\s*tr[uư][oở]ng\s*kh[oó]a|Tr[uư][oở]ng\s*ph[oò]ng|Tr[uư][oở]ng\s*phòng\s*đội|Trưởng đội)/i;

const SHIFT_LABELS = {
  sang: 'Ca sáng',
  chiều: 'Ca chiều',
  toi: 'Ca tối',
  tối: 'Ca tối',
  nguyenday: 'Trực cán bộ',
  tuan: 'Trực tuần giám đốc',
};

const buildOfficerDisplaySql = (alias) => `
CASE
  WHEN ${alias}.officerTitle IS NULL OR TRIM(${alias}.officerTitle) = '' THEN TRIM(COALESCE(${alias}.fullName, ''))
  WHEN ${alias}.fullName IS NULL OR TRIM(${alias}.fullName) = '' THEN TRIM(${alias}.officerTitle)
  -- If fullName accidentally contains the title twice (e.g. 'Thiếu tướng Thiếu tướng ...'), collapse the duplicate
  WHEN LOWER(TRIM(${alias}.fullName)) LIKE CONCAT(LOWER(TRIM(${alias}.officerTitle)), ' ', LOWER(TRIM(${alias}.officerTitle)), ' %')
    THEN TRIM(REPLACE(TRIM(${alias}.fullName), CONCAT(TRIM(${alias}.officerTitle), ' ', TRIM(${alias}.officerTitle)), TRIM(${alias}.officerTitle)))
  WHEN LOWER(TRIM(${alias}.fullName)) = LOWER(TRIM(${alias}.officerTitle))
       OR LOWER(TRIM(${alias}.fullName)) LIKE CONCAT(LOWER(TRIM(${alias}.officerTitle)), ' %')
    THEN TRIM(${alias}.fullName)
  ELSE CONCAT(TRIM(${alias}.officerTitle), ' ', TRIM(${alias}.fullName))
END`;

const getShiftLabel = (shift = '') => {
  const normalizedShift = String(shift || '').trim().toLowerCase();
  return SHIFT_LABELS[normalizedShift] || String(shift || '').trim();
};

const normalizeLocation = (value = '') => {
  const text = String(value || '').trim();
  return LOCATION_ALIAS[text] || text;
};

const toDateOnly = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const isWeekend = (dateValue) => {
  const dt = new Date(`${toDateOnly(dateValue)}T00:00:00Z`);
  const day = dt.getUTCDay();
  return day === 0 || day === 6;
};

const getWeekStartDate = (dateValue) => {
  const raw = toDateOnly(dateValue);
  if (!raw) return null;
  const dt = new Date(`${raw}T00:00:00Z`);
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
};

const getIsoWeekRange = (weekNo, year = new Date().getFullYear()) => {
  const w = Number(weekNo);
  const y = Number(year);
  if (!Number.isInteger(w) || w < 1 || w > 53) return null;

  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const buildWeekDates = (weekStartDate) => {
  const monday = getWeekStartDate(weekStartDate || new Date().toISOString().slice(0, 10));
  if (!monday) return [];
  return Array.from({ length: 7 }, (_, idx) => {
    const dt = new Date(`${monday}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + idx);
    return dt.toISOString().slice(0, 10);
  });
};

const requireDutyScheduleManagementAccess = async (connection, reqUser) => {
  await ensureDutyScheduleAccessSchema(connection);
  const accessState = await getDutyScheduleAccessState(connection, reqUser || {});
  if (!accessState.canManageDutySchedules) {
    return {
      ok: false,
      status: 403,
      error: 'Bạn không có quyền thực hiện',
      code: 'FORBIDDEN',
    };
  }
  return { ok: true };
};

const listHas = async (connection, sql, params = []) => {
  const [rows] = await connection.execute(sql, params);
  return rows.length > 0;
};

const getColumnType = async (connection, tableName, columnName) => {
  const [rows] = await connection.execute(
    `SELECT COLUMN_TYPE
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return String(rows[0]?.COLUMN_TYPE || '').toLowerCase();
};

const ensureDutySchema = async (connection) => {
  await connection.execute("UPDATE duty_schedules SET location = 'Lái xe' WHERE location = 'Nhà xe'");
  await connection.execute("UPDATE duty_schedules SET location = 'Bệnh xá' WHERE location = 'Trạm xá'");

  // Avoid forcing ALTER TABLE on every request because duty_schedules is referenced by leave_requests.
  // Only migrate enum definitions when the current schema is actually missing required values.
  const dutyTypeColumnType = await getColumnType(connection, 'duty_schedules', 'dutyType');
  if (!dutyTypeColumnType.includes("'holiday_daily'")) {
    await connection.execute(`
      ALTER TABLE duty_schedules
      MODIFY COLUMN dutyType ENUM('director_weekly', 'officer_daily', 'holiday_daily') NOT NULL
    `);
  }

  const locationColumnType = await getColumnType(connection, 'duty_schedules', 'location');
  if (!locationColumnType.includes("'trực ban giám đốc'")) {
    await connection.execute(`
      ALTER TABLE duty_schedules
      MODIFY COLUMN location ENUM('Nhà hiệu bộ', 'Lái xe', 'Bệnh xá', 'Trực ban Giám đốc') NOT NULL
    `);
  }

  const hasDutyRole = await listHas(connection, "SHOW COLUMNS FROM duty_schedules LIKE 'dutyRole'");
  if (!hasDutyRole) {
    await connection.execute(
      "ALTER TABLE duty_schedules ADD COLUMN dutyRole ENUM('officer', 'commander') NOT NULL DEFAULT 'officer' AFTER location"
    );
  }

  const hasSlotNo = await listHas(connection, "SHOW COLUMNS FROM duty_schedules LIKE 'slotNo'");
  if (!hasSlotNo) {
    await connection.execute('ALTER TABLE duty_schedules ADD COLUMN slotNo TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER dutyRole');
  }

  const hasAssignmentGroup = await listHas(connection, "SHOW COLUMNS FROM duty_schedules LIKE 'assignmentGroup'");
  if (!hasAssignmentGroup) {
    await connection.execute(
      "ALTER TABLE duty_schedules ADD COLUMN assignmentGroup ENUM('weekday', 'weekend', 'holiday') NULL AFTER slotNo"
    );
  }

  const hasOldUnique = await listHas(
    connection,
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'duty_schedules'
       AND index_name = 'uq_daily_location'
     LIMIT 1`
  );
  if (hasOldUnique) {
    await connection.execute('ALTER TABLE duty_schedules DROP INDEX uq_daily_location');
  }

  const hasSlotUnique = await listHas(
    connection,
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'duty_schedules'
       AND index_name = 'uq_duty_slot'
     LIMIT 1`
  );
  if (!hasSlotUnique) {
    await connection.execute(
      'ALTER TABLE duty_schedules ADD UNIQUE KEY uq_duty_slot (dutyType, date, location, dutyRole, slotNo)'
    );
  }

  const hasAssignmentIdx = await listHas(
    connection,
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'duty_schedules'
       AND index_name = 'idx_assignment_group'
     LIMIT 1`
  );
  if (!hasAssignmentIdx) {
    await connection.execute('ALTER TABLE duty_schedules ADD INDEX idx_assignment_group (assignmentGroup)');
  }
};

const getHolidaySet = async (connection, startDate, endDate) => {
  const [rows] = await connection.execute(
    `SELECT holidayDate
     FROM holidays
     WHERE holidayType = 'holiday'
       AND holidayDate BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  return new Set(rows.map((x) => toDateOnly(x.holidayDate)));
};

const getAssignmentGroupForDate = async (connection, dateValue) => {
  const date = toDateOnly(dateValue);
  if (!date) return null;

  const [rows] = await connection.execute(
    "SELECT id FROM holidays WHERE holidayDate = ? AND holidayType = 'holiday' LIMIT 1",
    [date]
  );
  if (rows.length > 0) return 'holiday';
  return isWeekend(date) ? 'weekend' : 'weekday';
};

const getOfficerInfo = async (connection, officerId) => {
  const [rows] = await connection.execute(
    `SELECT o.id,
            ${buildOfficerDisplaySql('o')} AS fullName,
            o.role,
            o.status,
            o.position,
            COALESCE(d.name, o.department, '') AS departmentName
     FROM officers o
     LEFT JOIN departments d ON d.id = o.departmentId
     WHERE o.id = ?
     LIMIT 1`,
    [officerId]
  );
  return rows[0] || null;
};

const validateOfficerForSlot = ({ officer, location, dutyRole }) => {
  if (!officer) {
    return { ok: false, error: 'Officer not found', code: 'OFFICER_NOT_FOUND', status: 404 };
  }
  if (officer.status !== 'active') {
    return { ok: false, error: 'Officer is not active', code: 'OFFICER_NOT_ACTIVE', status: 400 };
  }

  if (location === LOCATION.DRIVER && officer.departmentName !== TEAM_NAME.DRIVER) {
    return {
      ok: false,
      error: 'Vị trí Lái xe chỉ được chọn cán bộ thuộc Đội lái xe',
      code: 'INVALID_DRIVER_OFFICER',
      status: 400,
    };
  }

  if (location === LOCATION.MEDIC && officer.departmentName !== TEAM_NAME.MEDIC) {
    return {
      ok: false,
      error: 'Vị trí Bệnh xá chỉ được chọn cán bộ thuộc Đội bệnh xá',
      code: 'INVALID_MEDIC_OFFICER',
      status: 400,
    };
  }

  if (location === LOCATION.HB && dutyRole === 'commander') {
    const isCommander = officer.role === 'manager' || COMMANDER_POSITION_PATTERN.test(String(officer.position || ''));
    if (!isCommander) {
      return {
        ok: false,
        error: 'Chỉ huy Nhà hiệu bộ phải là PT Khóa hoặc Trưởng phòng',
        code: 'INVALID_HB_COMMANDER',
        status: 400,
      };
    }
  }

  if (location === LOCATION.HB && dutyRole === 'officer' && officer.role !== 'officer') {
    return {
      ok: false,
      error: '2 vị trí cán bộ Nhà hiệu bộ chỉ được gán cho cán bộ',
      code: 'INVALID_HB_OFFICER',
      status: 400,
    };
  }

  if (location === LOCATION.DIRECTOR) {
    const isDirector = officer.role === 'leader' || String(officer.departmentName || '').trim() === 'Ban Giám đốc';
    if (!isDirector) {
      return {
        ok: false,
        error: 'Trực ban Giám đốc chỉ được gán cho cán bộ Ban Giám đốc',
        code: 'INVALID_DIRECTOR_OFFICER',
        status: 400,
      };
    }
  }

  return { ok: true };
};

const validateSlot = ({ dutyType, location, dutyRole, slotNo }) => {
  if (dutyType === DUTY_TYPES.DIRECTOR_WEEKLY) {
    if (location !== LOCATION.DIRECTOR) {
      return {
        ok: false,
        error: `Trực ban giám đốc chỉ dùng vị trí ${LOCATION.DIRECTOR}`,
        code: 'INVALID_DIRECTOR_LOCATION',
      };
    }
    return { ok: true };
  }

  if (![DUTY_TYPES.OFFICER_DAILY, DUTY_TYPES.HOLIDAY_DAILY].includes(dutyType)) {
    return { ok: false, error: 'Invalid dutyType', code: 'INVALID_DUTY_TYPE' };
  }

  if (location === LOCATION.HB && dutyRole === 'officer' && [1, 2].includes(slotNo)) return { ok: true };
  if (location === LOCATION.HB && dutyRole === 'commander' && slotNo === 1) return { ok: true };
  if (location === LOCATION.DRIVER && dutyRole === 'officer' && slotNo === 1) return { ok: true };
  if (location === LOCATION.MEDIC && dutyRole === 'officer' && slotNo === 1) return { ok: true };

  return {
    ok: false,
    error: 'Cấu hình vị trí trực không hợp lệ',
    code: 'INVALID_DUTY_SLOT',
  };
};

const loadCountsByPosition = async (connection, dutyType, assignmentGroup, location, dutyRole, slotNo) => {
  const [rows] = await connection.execute(
    `SELECT officerId, COUNT(*) AS total
     FROM duty_schedules
     WHERE dutyType = ?
       AND assignmentGroup = ?
       AND location = ?
       AND dutyRole = ?
       AND slotNo = ?
     GROUP BY officerId`,
    [dutyType, assignmentGroup, location, dutyRole, slotNo]
  );

  const map = new Map();
  for (const row of rows) {
    map.set(row.officerId, Number(row.total) || 0);
  }
  return map;
};

const pickFairOfficer = ({ pool, usedToday, blockedByYesterday, countMap }) => {
  const available = pool.filter((id) => !usedToday.has(id));
  if (!available.length) return null;

  const nonBlocked = available.filter((id) => !blockedByYesterday.has(id));
  const candidatesBase = nonBlocked.length ? nonBlocked : available;
  const minCount = Math.min(...candidatesBase.map((id) => countMap.get(id) || 0));
  const leastUsed = candidatesBase.filter((id) => (countMap.get(id) || 0) === minCount);
  return leastUsed[Math.floor(Math.random() * leastUsed.length)] || null;
};

const loadAutoPools = async (connection) => {
  const [rows] = await connection.execute(
    `SELECT o.id,
            o.role,
            o.position,
            COALESCE(d.name, o.department, '') AS departmentName
     FROM officers o
     LEFT JOIN departments d ON d.id = o.departmentId
     WHERE o.status = 'active'
     ORDER BY o.id ASC`
  );

  const driver = rows.filter((x) => x.role === 'officer' && x.departmentName === TEAM_NAME.DRIVER).map((x) => x.id);
  const medic = rows.filter((x) => x.role === 'officer' && x.departmentName === TEAM_NAME.MEDIC).map((x) => x.id);

  let hbOfficers = rows
    .filter((x) => x.role === 'officer' && ![TEAM_NAME.DRIVER, TEAM_NAME.MEDIC].includes(x.departmentName))
    .map((x) => x.id);

  if (hbOfficers.length < 2) {
    hbOfficers = rows.filter((x) => x.role === 'officer').map((x) => x.id);
  }

  const commander = rows
    .filter((x) => x.role === 'manager' || COMMANDER_POSITION_PATTERN.test(String(x.position || '')))
    .map((x) => x.id);

  return { hbOfficers, commander, driver, medic };
};

const createNextIdGenerator = async (connection, prefix) => {
  const start = prefix.length + 1;
  const [rows] = await connection.execute(
    `SELECT MAX(CAST(SUBSTRING(id, ${start}) AS UNSIGNED)) AS maxNum
     FROM duty_schedules
     WHERE id LIKE ?`,
    [`${prefix}%`]
  );
  let nextNum = (rows[0]?.maxNum || 0) + 1;

  return () => {
    const id = `${prefix}${String(nextNum).padStart(3, '0')}`;
    nextNum += 1;
    return id;
  };
};

const createDutyRow = async (connection, item) => {
  await connection.execute(
    `INSERT INTO duty_schedules
     (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, dutyRole, slotNo, assignmentGroup, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, '00:00', '23:59', ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.officerId,
      item.dutyType,
      item.date,
      item.endDate || null,
      item.weekStartDate || null,
      item.shift,
      item.location,
      item.dutyRole,
      item.slotNo,
      item.assignmentGroup || null,
      item.notes || '',
    ]
  );
};

const notifyDutyAssignments = async (connection, rows) => {
  await ensureNotificationTargetingSchema(connection);
  for (const row of rows) {
    const targetUserId = await resolveUserIdByOfficerId(connection, row.officerId);
    await createUserNotification(connection, {
      title: 'Bạn được phân công lịch trực ban',
      content: `${row.date} - ${row.location}`,
      type: 'info',
      module: 'lichtrucban',
      entityType: 'duty_schedule',
      entityId: row.id,
      targetUserId,
    });
  }
};

// Get all duty schedules
export const getDutySchedules = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      dutyType = '',
      weekNo = '',
      year = new Date().getFullYear(),
      startDate = '',
      endDate = '',
      officerId = '',
      location = '',
      assignmentGroup = '',
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const connection = await pool.getConnection();

    try {
      // Bỏ kiểm tra quyền quản lý, chỉ cần đăng nhập là xem được danh sách lịch trực
      await ensureDutySchema(connection);

      const whereConditions = [];
      const params = [];

      if (dutyType) {
        whereConditions.push('ds.dutyType = ?');
        params.push(dutyType);
      }

      if (weekNo) {
        const range = getIsoWeekRange(weekNo, year);
        if (range) {
          whereConditions.push('ds.date BETWEEN ? AND ?');
          params.push(range.startDate, range.endDate);
        }
      }

      if (startDate) {
        whereConditions.push('ds.date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('ds.date <= ?');
        params.push(endDate);
      }

      if (officerId) {
        whereConditions.push('ds.officerId = ?');
        params.push(officerId);
      }

      if (location) {
        whereConditions.push('ds.location = ?');
        params.push(normalizeLocation(location));
      }

      if (assignmentGroup) {
        whereConditions.push('ds.assignmentGroup = ?');
        params.push(assignmentGroup);
      }

      const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total
         FROM duty_schedules ds
         LEFT JOIN officers o ON ds.officerId = o.id
         ${whereClause}`,
        params
      );

      const [schedules] = await connection.execute(
        `SELECT ds.*,
                ${buildOfficerDisplaySql('o')} as officerName,
                COALESCE(d.name, o.department, '') AS department
         FROM duty_schedules ds
         LEFT JOIN officers o ON ds.officerId = o.id
         LEFT JOIN departments d ON d.id = o.departmentId
         ${whereClause}
         ORDER BY ds.date ASC, ds.location ASC, ds.dutyRole ASC, ds.slotNo ASC
         LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
        params
      );

      const mappedSchedules = schedules.map((item) => ({
        ...item,
        shiftLabel: getShiftLabel(item.shift),
      }));

      return res.json({
        success: true,
        data: mappedSchedules,
        pagination: {
          total: Number(countRows[0].total || 0),
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(Number(countRows[0].total || 0) / parseInt(limit, 10)),
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Get single schedule
export const getDutyScheduleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await ensureDutySchema(connection);

      const [rows] = await connection.execute(
        `SELECT ds.*,
                ${buildOfficerDisplaySql('o')} as officerName,
                COALESCE(d.name, o.department, '') AS department
         FROM duty_schedules ds
         LEFT JOIN officers o ON ds.officerId = o.id
         LEFT JOIN departments d ON d.id = o.departmentId
         WHERE ds.id = ?`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'Duty schedule not found', code: 'SCHEDULE_NOT_FOUND' });
      }

      return res.json({
        success: true,
        data: {
          ...rows[0],
          shiftLabel: getShiftLabel(rows[0].shift),
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Create new duty schedule
export const createDutySchedule = async (req, res, next) => {
  try {
    const {
      officerId,
      dutyType,
      date,
      endDate = null,
      shift,
      location = '',
      dutyRole = 'officer',
      slotNo = 1,
      bulkAssignments = null,
      notes = '',
    } = req.body;

    if (!dutyType || !date || !shift) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: dutyType, date, shift',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!Object.values(DUTY_TYPES).includes(dutyType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid dutyType. Must be one of: ${Object.values(DUTY_TYPES).join(', ')}`,
        code: 'INVALID_DUTY_TYPE',
      });
    }

    const dutyDate = toDateOnly(date);
    const connection = await pool.getConnection();

    try {
      const accessCheck = await requireDutyScheduleManagementAccess(connection, req.user || {});
      if (!accessCheck.ok) {
        return res.status(accessCheck.status || 403).json({ success: false, error: accessCheck.error, code: accessCheck.code });
      }

      await ensureDutySchema(connection);

      const assignmentGroup = await getAssignmentGroupForDate(connection, dutyDate);
      if (dutyType === DUTY_TYPES.OFFICER_DAILY && assignmentGroup === 'holiday') {
        return res.status(400).json({
          success: false,
          error: 'Ngày lễ không được tạo lịch trực cán bộ thông thường. Vui lòng dùng tab Trực lễ.',
          code: 'OFFICER_DUTY_BLOCKED_ON_HOLIDAY',
        });
      }

      if (dutyType === DUTY_TYPES.HOLIDAY_DAILY && assignmentGroup !== 'holiday') {
        return res.status(400).json({
          success: false,
          error: 'Trực lễ chỉ được tạo cho ngày lễ.',
          code: 'HOLIDAY_DUTY_ONLY_ON_HOLIDAY',
        });
      }

      const weekStartDate = dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? getWeekStartDate(dutyDate) : null;
      if (dutyType === DUTY_TYPES.DIRECTOR_WEEKLY && weekStartDate) {
        const [dupeRows] = await connection.execute(
          `SELECT id
           FROM duty_schedules
           WHERE dutyType = ? AND weekStartDate = ?
           LIMIT 1`,
          [DUTY_TYPES.DIRECTOR_WEEKLY, weekStartDate]
        );

        if (dupeRows.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Mỗi tuần chỉ được có một giám đốc trực.',
            code: 'DIRECTOR_WEEK_ALREADY_ASSIGNED',
          });
        }
      }

      const prefix = dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? 'TBGD' : 'TBCB';
      const nextId = await createNextIdGenerator(connection, prefix);

      const createdRows = [];
      if (Array.isArray(bulkAssignments) && bulkAssignments.length) {
        for (const item of bulkAssignments) {
          const loc = normalizeLocation(item?.location || '');
          const role = String(item?.dutyRole || 'officer');
          const slot = Number(item?.slotNo || 1);
          const targetOfficerId = String(item?.officerId || '').trim();

          if (!targetOfficerId) {
            return res.status(400).json({ success: false, error: 'Missing officerId in bulkAssignments', code: 'VALIDATION_ERROR' });
          }

          const slotCheck = validateSlot({ dutyType, location: loc, dutyRole: role, slotNo: slot });
          if (!slotCheck.ok) {
            return res.status(400).json({ success: false, error: slotCheck.error, code: slotCheck.code });
          }

          const officer = await getOfficerInfo(connection, targetOfficerId);
          const officerCheck = validateOfficerForSlot({ officer, location: loc, dutyRole: role });
          if (!officerCheck.ok) {
            return res.status(officerCheck.status || 400).json({
              success: false,
              error: officerCheck.error,
              code: officerCheck.code,
            });
          }

          const [dupeRows] = await connection.execute(
            `SELECT id
             FROM duty_schedules
             WHERE dutyType = ? AND date = ? AND location = ? AND dutyRole = ? AND slotNo = ?
             LIMIT 1`,
            [dutyType, dutyDate, loc, role, slot]
          );
          if (dupeRows.length) {
            return res.status(409).json({
              success: false,
              error: `Vị trí ${loc} (${role} #${slot}) đã có cán bộ trực trong ngày ${dutyDate}`,
              code: 'DAILY_SLOT_ALREADY_ASSIGNED',
            });
          }

          const row = {
            id: nextId(),
            officerId: targetOfficerId,
            dutyType,
            date: dutyDate,
            endDate: dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? (toDateOnly(endDate) || dutyDate) : null,
            weekStartDate,
            shift,
            location: loc,
            dutyRole: role,
            slotNo: slot,
            assignmentGroup: dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? null : assignmentGroup,
            notes,
          };

          await createDutyRow(connection, row);
          createdRows.push(row);
        }
      } else {
        if (!officerId) {
          return res.status(400).json({ success: false, error: 'Missing required field: officerId', code: 'VALIDATION_ERROR' });
        }

        const loc = normalizeLocation(location);
        const role = String(dutyRole || 'officer');
        const slot = Number(slotNo || 1);
        const slotCheck = validateSlot({ dutyType, location: loc, dutyRole: role, slotNo: slot });
        if (!slotCheck.ok) {
          return res.status(400).json({ success: false, error: slotCheck.error, code: slotCheck.code });
        }

        const officer = await getOfficerInfo(connection, officerId);
        const officerCheck = validateOfficerForSlot({ officer, location: loc, dutyRole: role });
        if (!officerCheck.ok) {
          return res.status(officerCheck.status || 400).json({
            success: false,
            error: officerCheck.error,
            code: officerCheck.code,
          });
        }

        if (dutyType !== DUTY_TYPES.DIRECTOR_WEEKLY) {
          const [dupeRows] = await connection.execute(
            `SELECT id
             FROM duty_schedules
             WHERE dutyType = ? AND date = ? AND location = ? AND dutyRole = ? AND slotNo = ?
             LIMIT 1`,
            [dutyType, dutyDate, loc, role, slot]
          );
          if (dupeRows.length) {
            return res.status(409).json({
              success: false,
              error: `Vị trí ${loc} (${role} #${slot}) đã có cán bộ trực trong ngày ${dutyDate}`,
              code: 'DAILY_SLOT_ALREADY_ASSIGNED',
            });
          }
        }

        const row = {
          id: nextId(),
          officerId,
          dutyType,
          date: dutyDate,
          endDate: dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? (toDateOnly(endDate) || dutyDate) : null,
          weekStartDate,
          shift,
          location: loc,
          dutyRole: role,
          slotNo: slot,
          assignmentGroup: dutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? null : assignmentGroup,
          notes,
        };

        await createDutyRow(connection, row);
        createdRows.push(row);
      }

      await notifyDutyAssignments(connection, createdRows);

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'create',
        entityType: 'duty_schedule',
        entityId: createdRows.map((x) => x.id).join(','),
        summary: `Them moi ${createdRows.length} lich truc ban ngay ${dutyDate}`,
      });

      return res.status(201).json({
        success: true,
        data: { ids: createdRows.map((x) => x.id) },
        message: 'Duty schedule created successfully',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

const assignDutyByDates = async ({ connection, dates, dutyType, actor }) => {
  const pools = await loadAutoPools(connection);
  if (pools.hbOfficers.length < 2) {
    return { ok: false, status: 400, error: 'Cần ít nhất 2 cán bộ để xếp trực Nhà hiệu bộ', code: 'INSUFFICIENT_HB_OFFICERS' };
  }
  if (!pools.commander.length) {
    return { ok: false, status: 400, error: 'Không có PT Khóa/Trưởng phòng để phân công chỉ huy', code: 'INSUFFICIENT_COMMANDERS' };
  }
  if (!pools.driver.length) {
    return { ok: false, status: 400, error: 'Không có cán bộ thuộc Đội lái xe', code: 'INSUFFICIENT_DRIVER_TEAM' };
  }
  if (!pools.medic.length) {
    return { ok: false, status: 400, error: 'Không có cán bộ thuộc Đội bệnh xá', code: 'INSUFFICIENT_MEDIC_TEAM' };
  }

  const nextId = await createNextIdGenerator(connection, 'TBCB');
  const createdRows = [];

  const slots = [
    { location: LOCATION.HB, dutyRole: 'officer', slotNo: 1, poolKey: 'hbOfficers' },
    { location: LOCATION.HB, dutyRole: 'officer', slotNo: 2, poolKey: 'hbOfficers' },
    { location: LOCATION.HB, dutyRole: 'commander', slotNo: 1, poolKey: 'commander' },
    { location: LOCATION.DRIVER, dutyRole: 'officer', slotNo: 1, poolKey: 'driver' },
    { location: LOCATION.MEDIC, dutyRole: 'officer', slotNo: 1, poolKey: 'medic' },
  ];

  const countsCache = new Map();
  for (const date of dates) {
    const assignmentGroup = await getAssignmentGroupForDate(connection, date);
    if (dutyType === DUTY_TYPES.OFFICER_DAILY && assignmentGroup === 'holiday') continue;
    if (dutyType === DUTY_TYPES.HOLIDAY_DAILY && assignmentGroup !== 'holiday') continue;

    const [existingRows] = await connection.execute(
      `SELECT location, dutyRole, slotNo, officerId
       FROM duty_schedules
       WHERE dutyType = ? AND date = ?`,
      [dutyType, date]
    );

    const existingMap = new Map(
      existingRows.map((x) => [`${x.location}|${x.dutyRole}|${Number(x.slotNo || 1)}`, x.officerId])
    );

    const usedToday = new Set(existingRows.map((x) => x.officerId));

    for (const slot of slots) {
      const slotKey = `${slot.location}|${slot.dutyRole}|${slot.slotNo}`;
      if (existingMap.has(slotKey)) continue;

      const countKey = `${dutyType}|${assignmentGroup}|${slot.location}|${slot.dutyRole}|${slot.slotNo}`;
      if (!countsCache.has(countKey)) {
        countsCache.set(
          countKey,
          await loadCountsByPosition(connection, dutyType, assignmentGroup, slot.location, slot.dutyRole, slot.slotNo)
        );
      }
      const countMap = countsCache.get(countKey);

      const prevDate = toDateOnly(new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400000));
      const [prevRows] = await connection.execute(
        `SELECT officerId
         FROM duty_schedules
         WHERE dutyType = ?
           AND date = ?
           AND location = ?
           AND dutyRole = ?`,
        [dutyType, prevDate, slot.location, slot.dutyRole]
      );
      const blockedByYesterday = new Set(prevRows.map((x) => x.officerId));

      const chosen = pickFairOfficer({
        pool: pools[slot.poolKey],
        usedToday,
        blockedByYesterday,
        countMap,
      });

      if (!chosen) {
        return {
          ok: false,
          status: 409,
          error: `Không đủ cán bộ khả dụng cho ${slot.location} ngày ${date}`,
          code: 'NO_AVAILABLE_OFFICER_FOR_SLOT',
        };
      }

      const row = {
        id: nextId(),
        officerId: chosen,
        dutyType,
        date,
        endDate: null,
        weekStartDate: null,
        shift: 'nguyenday',
        location: slot.location,
        dutyRole: slot.dutyRole,
        slotNo: slot.slotNo,
        assignmentGroup,
        notes: dutyType === DUTY_TYPES.HOLIDAY_DAILY
          ? 'Tự động xếp trực lễ theo vòng công bằng'
          : 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)',
      };

      await createDutyRow(connection, row);
      createdRows.push(row);
      usedToday.add(chosen);
      countMap.set(chosen, (countMap.get(chosen) || 0) + 1);
    }
  }

  if (createdRows.length) {
    await notifyDutyAssignments(connection, createdRows);

    await logActivity({
      actorUserId: actor?.id,
      actorUsername: actor?.username,
      actorRole: actor?.role,
      module: 'lichtrucban',
      action: 'create',
      entityType: 'duty_schedule',
      entityId: createdRows.map((x) => x.id).join(','),
      summary: `Auto xep ${dutyType} (${createdRows.length} lich)`,
    });
  }

  return {
    ok: true,
    data: {
      createdCount: createdRows.length,
      createdIds: createdRows.map((x) => x.id),
    },
  };
};

// Auto assign officer daily duty for selected week
export const autoAssignOfficerDailyWeek = async (req, res, next) => {
  try {
    const weekStartDate = req.body?.weekStartDate;
    const dates = buildWeekDates(weekStartDate);
    if (!dates.length) {
      return res.status(400).json({ success: false, error: 'weekStartDate không hợp lệ', code: 'INVALID_WEEK_START' });
    }

    const connection = await pool.getConnection();
    try {
      const accessCheck = await requireDutyScheduleManagementAccess(connection, req.user || {});
      if (!accessCheck.ok) {
        return res.status(accessCheck.status || 403).json({ success: false, error: accessCheck.error, code: accessCheck.code });
      }

      await ensureDutySchema(connection);

      // Check if this week has already been auto-scheduled
      const [existingLog] = await connection.execute(
        'SELECT id FROM auto_schedule_logs WHERE weekStartDate = ? AND scheduleType = ? LIMIT 1',
        [dates[0], DUTY_TYPES.OFFICER_DAILY]
      );

      if (existingLog.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Tuần này đã được tự động xếp lịch rồi. Không được xếp lịch lần thứ 2.',
          code: 'ALREADY_AUTO_SCHEDULED',
        });
      }

      const result = await assignDutyByDates({
        connection,
        dates,
        dutyType: DUTY_TYPES.OFFICER_DAILY,
        actor: req.user,
      });

      if (!result.ok) {
        return res.status(result.status || 400).json({
          success: false,
          error: result.error,
          code: result.code,
        });
      }

      // Insert log record to prevent re-scheduling
      await connection.execute(
        'INSERT INTO auto_schedule_logs (weekStartDate, scheduleType, createdByUserId, createdByUsername) VALUES (?, ?, ?, ?)',
        [dates[0], DUTY_TYPES.OFFICER_DAILY, req.user?.id || null, req.user?.username || null]
      );

      return res.status(201).json({
        success: true,
        data: {
          ...result.data,
          weekStartDate: dates[0],
          weekEndDate: dates[dates.length - 1],
        },
        message: 'Đã tự động xếp lịch trực cán bộ theo vòng công bằng (tách ngày thường/cuối tuần/ngày lễ).',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Auto assign holiday duty
export const autoAssignHolidayDuty = async (req, res, next) => {
  try {
    const { fromDate = '', toDate = '', weekStartDate = '' } = req.body || {};

    let rangeStart = toDateOnly(fromDate);
    let rangeEnd = toDateOnly(toDate);

    if (!rangeStart || !rangeEnd) {
      if (weekStartDate) {
        const dates = buildWeekDates(weekStartDate);
        rangeStart = dates[0];
        rangeEnd = dates[dates.length - 1];
      }
    }

    if (!rangeStart || !rangeEnd) {
      const now = new Date();
      const year = now.getFullYear();
      rangeStart = `${year}-01-01`;
      rangeEnd = `${year}-12-31`;
    }

    const connection = await pool.getConnection();
    try {
      const accessCheck = await requireDutyScheduleManagementAccess(connection, req.user || {});
      if (!accessCheck.ok) {
        return res.status(accessCheck.status || 403).json({ success: false, error: accessCheck.error, code: accessCheck.code });
      }

      await ensureDutySchema(connection);

      // Holiday schedule CAN be re-assigned multiple times (no lock)
      // Just allow overwriting without checking auto_schedule_logs

      const holidaySet = await getHolidaySet(connection, rangeStart, rangeEnd);
      const dates = Array.from(holidaySet).sort();

      if (!dates.length) {
        return res.status(400).json({
          success: false,
          error: 'Không có ngày lễ trong khoảng được chọn',
          code: 'NO_HOLIDAY_IN_RANGE',
        });
      }

      const result = await assignDutyByDates({
        connection,
        dates,
        dutyType: DUTY_TYPES.HOLIDAY_DAILY,
        actor: req.user,
      });

      if (!result.ok) {
        return res.status(result.status || 400).json({
          success: false,
          error: result.error,
          code: result.code,
        });
      }

      // Note: Do NOT insert log for holiday_daily - allow re-scheduling multiple times

      return res.status(201).json({
        success: true,
        data: {
          ...result.data,
          fromDate: rangeStart,
          toDate: rangeEnd,
        },
        message: 'Đã tự động xếp trực lễ theo vòng công bằng.',
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Update duty schedule
export const updateDutySchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      officerId,
      dutyType,
      date,
      endDate,
      shift,
      location,
      dutyRole,
      slotNo,
      notes,
    } = req.body;

    const connection = await pool.getConnection();

    try {
      await ensureDutySchema(connection);

      const [checkRows] = await connection.execute(
        'SELECT * FROM duty_schedules WHERE id = ? LIMIT 1',
        [id]
      );
      if (!checkRows.length) {
        return res.status(404).json({ success: false, error: 'Duty schedule not found', code: 'SCHEDULE_NOT_FOUND' });
      }

      const current = checkRows[0];
      const nextDutyType = dutyType !== undefined ? dutyType : current.dutyType;
      const nextDate = toDateOnly(date !== undefined ? date : current.date);
      const nextLocation = normalizeLocation(location !== undefined ? location : current.location);
      const nextDutyRole = dutyRole !== undefined ? dutyRole : current.dutyRole;
      const nextSlotNo = Number(slotNo !== undefined ? slotNo : current.slotNo || 1);
      const nextWeekStartDate = nextDutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? getWeekStartDate(nextDate) : null;

      if (!Object.values(DUTY_TYPES).includes(nextDutyType)) {
        return res.status(400).json({ success: false, error: 'Invalid dutyType', code: 'INVALID_DUTY_TYPE' });
      }

      const assignmentGroup = await getAssignmentGroupForDate(connection, nextDate);
      if (nextDutyType === DUTY_TYPES.OFFICER_DAILY && assignmentGroup === 'holiday') {
        return res.status(400).json({
          success: false,
          error: 'Ngày lễ không được phép thêm trực cán bộ thông thường.',
          code: 'OFFICER_DUTY_BLOCKED_ON_HOLIDAY',
        });
      }
      if (nextDutyType === DUTY_TYPES.HOLIDAY_DAILY && assignmentGroup !== 'holiday') {
        return res.status(400).json({
          success: false,
          error: 'Trực lễ chỉ áp dụng cho ngày lễ.',
          code: 'HOLIDAY_DUTY_ONLY_ON_HOLIDAY',
        });
      }

      const slotCheck = validateSlot({ dutyType: nextDutyType, location: nextLocation, dutyRole: nextDutyRole, slotNo: nextSlotNo });
      if (!slotCheck.ok) {
        return res.status(400).json({ success: false, error: slotCheck.error, code: slotCheck.code });
      }

      const nextOfficerId = officerId !== undefined ? officerId : current.officerId;
      const officer = await getOfficerInfo(connection, nextOfficerId);
      const officerCheck = validateOfficerForSlot({ officer, location: nextLocation, dutyRole: nextDutyRole });
      if (!officerCheck.ok) {
        return res.status(officerCheck.status || 400).json({
          success: false,
          error: officerCheck.error,
          code: officerCheck.code,
        });
      }

      if (nextDutyType === DUTY_TYPES.DIRECTOR_WEEKLY && nextWeekStartDate) {
        const [dupeRows] = await connection.execute(
          `SELECT id
           FROM duty_schedules
           WHERE dutyType = ? AND weekStartDate = ? AND id <> ?
           LIMIT 1`,
          [DUTY_TYPES.DIRECTOR_WEEKLY, nextWeekStartDate, id]
        );
        if (dupeRows.length) {
          return res.status(409).json({
            success: false,
            error: 'Mỗi tuần chỉ được có một giám đốc trực.',
            code: 'DIRECTOR_WEEK_ALREADY_ASSIGNED',
          });
        }
      } else {
        const [dupeRows] = await connection.execute(
          `SELECT id
           FROM duty_schedules
           WHERE dutyType = ?
             AND date = ?
             AND location = ?
             AND dutyRole = ?
             AND slotNo = ?
             AND id <> ?
           LIMIT 1`,
          [nextDutyType, nextDate, nextLocation, nextDutyRole, nextSlotNo, id]
        );
        if (dupeRows.length) {
          return res.status(409).json({
            success: false,
            error: `Vị trí ${nextLocation} (${nextDutyRole} #${nextSlotNo}) đã có người trực`,
            code: 'DAILY_SLOT_ALREADY_ASSIGNED',
          });
        }
      }

      const fields = [];
      const params = [];

      if (officerId !== undefined) {
        fields.push('officerId = ?');
        params.push(officerId);
      }
      if (dutyType !== undefined) {
        fields.push('dutyType = ?');
        params.push(dutyType);
      }
      if (date !== undefined) {
        fields.push('date = ?');
        params.push(nextDate);
      }
      if (endDate !== undefined) {
        fields.push('endDate = ?');
        params.push(endDate ? toDateOnly(endDate) : null);
      }
      if (shift !== undefined) {
        fields.push('shift = ?');
        params.push(shift);
      }
      if (location !== undefined) {
        fields.push('location = ?');
        params.push(nextLocation);
      }
      if (dutyRole !== undefined) {
        fields.push('dutyRole = ?');
        params.push(nextDutyRole);
      }
      if (slotNo !== undefined) {
        fields.push('slotNo = ?');
        params.push(nextSlotNo);
      }
      if (notes !== undefined) {
        fields.push('notes = ?');
        params.push(notes || '');
      }

      fields.push('weekStartDate = ?');
      params.push(nextWeekStartDate);
      fields.push('assignmentGroup = ?');
      params.push(nextDutyType === DUTY_TYPES.DIRECTOR_WEEKLY ? null : assignmentGroup);

      if (!fields.length) {
        return res.status(400).json({ success: false, error: 'No fields to update', code: 'VALIDATION_ERROR' });
      }

      params.push(id);
      await connection.execute(`UPDATE duty_schedules SET ${fields.join(', ')} WHERE id = ?`, params);

      await ensureNotificationTargetingSchema(connection);
      const targetUserId = await resolveUserIdByOfficerId(connection, nextOfficerId);
      await createUserNotification(connection, {
        title: 'Lịch trực ban của bạn vừa được cập nhật',
        content: `Lịch ${id} vào ngày ${nextDate}`,
        type: 'info',
        module: 'lichtrucban',
        entityType: 'duty_schedule',
        entityId: id,
        targetUserId,
      });

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'update',
        entityType: 'duty_schedule',
        entityId: id,
        summary: `Cap nhat lich truc ban ${id}`,
      });

      return res.json({ success: true, message: 'Duty schedule updated successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Delete duty schedule
export const deleteDutySchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const accessCheck = await requireDutyScheduleManagementAccess(connection, req.user || {});
      if (!accessCheck.ok) {
        return res.status(accessCheck.status || 403).json({ success: false, error: accessCheck.error, code: accessCheck.code });
      }

      const [checkRows] = await connection.execute('SELECT id FROM duty_schedules WHERE id = ? LIMIT 1', [id]);
      if (!checkRows.length) {
        return res.status(404).json({ success: false, error: 'Duty schedule not found', code: 'SCHEDULE_NOT_FOUND' });
      }

      const [leaveRows] = await connection.execute(
        'SELECT id FROM leave_requests WHERE dutyScheduleId = ? LIMIT 1',
        [id]
      );

      if (leaveRows.length) {
        return res.status(409).json({
          success: false,
          error: 'Duty schedule is referenced by a leave request and cannot be deleted.',
          code: 'SCHEDULE_IN_USE',
        });
      }

      await connection.execute('DELETE FROM duty_schedules WHERE id = ?', [id]);

      await logActivity({
        actorUserId: req.user?.id,
        actorUsername: req.user?.username,
        actorRole: req.user?.role,
        module: 'lichtrucban',
        action: 'delete',
        entityType: 'duty_schedule',
        entityId: id,
        summary: `Xoa lich truc ban ${id}`,
      });

      return res.json({ success: true, message: 'Duty schedule deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};

// Check if a week has been auto-scheduled
export const checkAutoScheduled = async (req, res, next) => {
  try {
    const { weekStartDate, scheduleType = 'officer_daily' } = req.query;

    if (!weekStartDate) {
      return res.status(400).json({
        success: false,
        error: 'weekStartDate is required',
        code: 'MISSING_WEEK_START_DATE',
      });
    }

    const formattedDate = toDateOnly(weekStartDate);
    if (!formattedDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid weekStartDate format',
        code: 'INVALID_DATE_FORMAT',
      });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT id, createdAt, createdByUsername FROM auto_schedule_logs WHERE weekStartDate = ? AND scheduleType = ?',
        [formattedDate, scheduleType]
      );

      const isScheduled = rows.length > 0;
      return res.json({
        success: true,
        data: {
          isScheduled,
          weekStartDate: formattedDate,
          scheduleType,
          log: isScheduled ? rows[0] : null,
        },
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
};
