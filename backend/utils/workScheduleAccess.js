const hasOfficersUserIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'userId'");
  return rows.length > 0;
};

const hasOfficersDepartmentIdColumn = async (connection) => {
  const [rows] = await connection.execute("SHOW COLUMNS FROM officers LIKE 'departmentId'");
  return rows.length > 0;
};

export const ensureWorkScheduleAccessSchema = async (connection) => {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS work_schedule_permissions (
      officerId VARCHAR(10) PRIMARY KEY,
      canCreateWorkSchedules TINYINT(1) NOT NULL DEFAULT 1,
      canApproveWorkSchedules TINYINT(1) NOT NULL DEFAULT 1,
      grantedByUserId INT NULL,
      grantedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
      FOREIGN KEY (grantedByUserId) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_canCreateWorkSchedules (canCreateWorkSchedules),
      INDEX idx_canApproveWorkSchedules (canApproveWorkSchedules),
      INDEX idx_work_schedule_grantedByUserId (grantedByUserId)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

export const resolveRequesterOfficer = async (connection, reqUser = {}) => {
  if (!reqUser?.id && !reqUser?.email && !reqUser?.fullName) {
    return null;
  }

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

const getWorkSchedulePermissionState = async (connection, officerId) => {
  if (!officerId) {
    return {
      canCreateWorkSchedulesByPermission: false,
      canApproveWorkSchedulesByPermission: false,
    };
  }

  const [rows] = await connection.execute(
    `SELECT
       COALESCE(canCreateWorkSchedules, 0) AS canCreateWorkSchedulesByPermission,
       COALESCE(canApproveWorkSchedules, 0) AS canApproveWorkSchedulesByPermission
     FROM work_schedule_permissions
     WHERE officerId = ?
     LIMIT 1`,
    [officerId]
  );

  if (!rows.length) {
    return {
      canCreateWorkSchedulesByPermission: false,
      canApproveWorkSchedulesByPermission: false,
    };
  }

  return {
    canCreateWorkSchedulesByPermission: Boolean(rows[0].canCreateWorkSchedulesByPermission),
    canApproveWorkSchedulesByPermission: Boolean(rows[0].canApproveWorkSchedulesByPermission),
  };
};

export const getWorkScheduleAccessState = async (connection, reqUser = {}) => {
  const officer = await resolveRequesterOfficer(connection, reqUser);
  const effectiveRole = reqUser?.effectiveRole || reqUser?.role;
  const isAdminRole = effectiveRole === 'admin' || effectiveRole === 'superadmin';
  const isManagerRole = effectiveRole === 'manager';
  const canCreateWorkSchedulesByRole = isAdminRole || isManagerRole;
  const canApproveWorkSchedulesByRole = isAdminRole;

  return {
    officer,
    canCreateWorkSchedules: canCreateWorkSchedulesByRole,
    canApproveWorkSchedules: canApproveWorkSchedulesByRole,
    canCreateWorkSchedulesByRole,
    canApproveWorkSchedulesByRole,
    canCreateWorkSchedulesByPermission: false,
    canApproveWorkSchedulesByPermission: false,
    canGrantWorkSchedulePermissions: false,
  };
};

export const canGrantWorkSchedulePermissions = async (connection, reqUser = {}) => {
  const accessState = await getWorkScheduleAccessState(connection, reqUser);
  return Boolean(accessState.canGrantWorkSchedulePermissions);
};
