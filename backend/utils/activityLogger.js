import pool from '../config/database.js';

export const logActivity = async ({
  actorUserId = null,
  actorUsername = null,
  actorRole = null,
  module,
  action,
  entityType,
  entityId = null,
  summary,
  metadata = null,
}) => {
  if (!module || !action || !entityType || !summary) return;

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO activity_logs
      (actorUserId, actorUsername, actorRole, module, action, entityType, entityId, summary, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorUserId,
        actorUsername,
        actorRole,
        module,
        action,
        entityType,
        entityId,
        summary,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } finally {
    connection.release();
  }
};
