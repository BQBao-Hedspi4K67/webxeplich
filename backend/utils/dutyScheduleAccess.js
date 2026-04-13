const PRIVILEGED_DUTY_SCHEDULE_DEPARTMENTS = ['Ban Giám đốc', 'Phòng hành chính tổng hợp'];

const hasOfficersUserIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'userId'");
  return rows.length > 0;
};

const hasOfficersDepartmentIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'departmentId'");
  return rows.length > 0;
};

export const ensureDutyScheduleAccessSchema = async (connection) => {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS duty_schedule_permissions (
      officerId VARCHAR(10) PRIMARY KEY,
      canManageDutySchedules TINYINT(1) NOT NULL DEFAULT 1,
      grantedByUserId INT NULL,
      grantedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
      FOREIGN KEY (grantedByUserId) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_canManageDutySchedules (canManageDutySchedules),
      INDEX idx_grantedByUserId (grantedByUserId)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

export const resolveRequesterOfficer = async (connection, reqUser = {}) => {
  const hasUserIdColumn = await hasOfficersUserIdColumn(connection);
  const hasDepartmentIdColumn = await hasOfficersDepartmentIdColumn(connection);
  const selectDepartment = hasDepartmentIdColumn ? 'departmentId, department,' : 'NULL AS departmentId, department,';

  if (hasUserIdColumn) {
    const [rows] = await connection.execute(
      `SELECT id, ${selectDepartment} role, position
       FROM officers
       WHERE userId = ?
       LIMIT 1`,
      [reqUser.id]
    );
    if (rows[0]) return rows[0];
  }

  const [rows] = await connection.execute(
    `SELECT id, ${selectDepartment} role, position
     FROM officers
     WHERE (email = ? AND ? <> '') OR fullName = ?
     LIMIT 1`,
    [reqUser.email || '', reqUser.email || '', reqUser.fullName || '']
  );
  return rows[0] || null;
};

export const hasDutySchedulePermission = async (connection, officerId) => {
  if (!officerId) return false;
  const [rows] = await connection.execute(
    'SELECT officerId FROM duty_schedule_permissions WHERE officerId = ? LIMIT 1',
    [officerId]
  );
  return rows.length > 0;
};

export const getDutyScheduleAccessState = async (connection, reqUser = {}) => {
  await ensureDutyScheduleAccessSchema(connection);

  if (reqUser?.role === 'admin') {
    return {
      officer: null,
      canManageDutySchedules: true,
      canManageDutySchedulesByDepartment: true,
      canManageDutySchedulesByPermission: false,
      canGrantDutySchedulePermissions: true,
    };
  }

  const officer = await resolveRequesterOfficer(connection, reqUser);
  const departmentName = String(officer?.department || '').trim();
  const canManageDutySchedulesByDepartment = PRIVILEGED_DUTY_SCHEDULE_DEPARTMENTS.includes(departmentName);
  const canManageDutySchedulesByPermission = await hasDutySchedulePermission(connection, officer?.id);

  return {
    officer,
    canManageDutySchedules: canManageDutySchedulesByDepartment || canManageDutySchedulesByPermission,
    canManageDutySchedulesByDepartment,
    canManageDutySchedulesByPermission,
    canGrantDutySchedulePermissions: canManageDutySchedulesByDepartment,
  };
};

export const canGrantDutySchedulePermissions = async (connection, reqUser = {}) => {
  if (reqUser?.role === 'admin') return true;
  const accessState = await getDutyScheduleAccessState(connection, reqUser);
  return Boolean(accessState.canGrantDutySchedulePermissions);
};
