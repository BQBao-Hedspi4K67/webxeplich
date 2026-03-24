let schemaEnsured = false;

const OFFICER_ROLE_TO_USER_ROLE = {
  leader: 'admin',
  manager: 'manager',
  officer: 'officer',
};

const normalizeRole = (role) => OFFICER_ROLE_TO_USER_ROLE[String(role || '').toLowerCase()] || 'officer';

export const ensureNotificationTargetingSchema = async (connection) => {
  if (schemaEnsured) return;

  const [columns] = await connection.execute('SHOW COLUMNS FROM notifications');
  const colNames = new Set(columns.map((c) => c.Field));

  if (!colNames.has('targetUserId')) {
    await connection.execute('ALTER TABLE notifications ADD COLUMN targetUserId INT NULL AFTER entityId');
  }

  if (!colNames.has('targetRole')) {
    await connection.execute("ALTER TABLE notifications ADD COLUMN targetRole VARCHAR(20) NULL AFTER targetUserId");
  }

  schemaEnsured = true;
};

export const createUserNotification = async (connection, payload) => {
  const {
    title,
    content,
    type = 'info',
    module = null,
    entityType = null,
    entityId = null,
    targetUserId,
  } = payload;

  if (!targetUserId) return;
  await ensureNotificationTargetingSchema(connection);

  await connection.execute(
    `INSERT INTO notifications (title, content, type, module, entityType, entityId, targetUserId, targetRole)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [title, content, type, module, entityType, entityId ? String(entityId) : null, targetUserId]
  );
};

export const createRoleNotification = async (connection, payload) => {
  const {
    title,
    content,
    type = 'info',
    module = null,
    entityType = null,
    entityId = null,
    targetRole,
  } = payload;

  if (!targetRole) return;
  await ensureNotificationTargetingSchema(connection);

  await connection.execute(
    `INSERT INTO notifications (title, content, type, module, entityType, entityId, targetUserId, targetRole)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    [title, content, type, module, entityType, entityId ? String(entityId) : null, String(targetRole)]
  );
};

const findUserIdByOfficer = async (connection, officer) => {
  if (!officer) return null;

  if (officer.email) {
    const [userByEmail] = await connection.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [officer.email]
    );
    if (userByEmail[0]?.id) return userByEmail[0].id;
  }

  const [userByNameRole] = await connection.execute(
    'SELECT id FROM users WHERE fullName = ? AND role = ? LIMIT 1',
    [officer.fullName, normalizeRole(officer.role)]
  );
  return userByNameRole[0]?.id || null;
};

export const resolveUserIdByOfficerId = async (connection, officerId) => {
  if (!officerId) return null;

  const [officers] = await connection.execute(
    'SELECT id, fullName, email, role FROM officers WHERE id = ? LIMIT 1',
    [officerId]
  );
  return findUserIdByOfficer(connection, officers[0]);
};

export const resolveUserIdsByAssignedTo = async (connection, assignedTo) => {
  const raw = String(assignedTo || '').trim();
  if (!raw) return [];

  const [officers] = await connection.execute(
    `SELECT id, fullName, email, role
     FROM officers
     WHERE id = ? OR fullName = ?`,
    [raw, raw]
  );

  const ids = new Set();
  for (const officer of officers) {
    const userId = await findUserIdByOfficer(connection, officer);
    if (userId) ids.add(userId);
  }

  return Array.from(ids);
};
