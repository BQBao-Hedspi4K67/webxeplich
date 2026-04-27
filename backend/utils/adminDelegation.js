export const ensureAdminDelegationSchema = async (connection) => {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS admin_delegations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      delegatorUserId INT NOT NULL,
      delegateUserId INT NOT NULL,
      delegateOfficerId VARCHAR(10) NULL,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_delegator_delegate (delegatorUserId, delegateUserId),
      INDEX idx_delegate_user (delegateUserId),
      INDEX idx_delegator_user (delegatorUserId),
      FOREIGN KEY (delegatorUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (delegateUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (delegateOfficerId) REFERENCES officers(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

export const getDelegationByDelegateUserId = async (connection, delegateUserId) => {
  if (!delegateUserId) return null;
  await ensureAdminDelegationSchema(connection);

  const [rows] = await connection.execute(
    `SELECT ad.delegatorUserId,
            ad.delegateUserId,
            ad.delegateOfficerId,
            delegator.role AS delegatorRole
     FROM admin_delegations ad
     INNER JOIN users delegator ON delegator.id = ad.delegatorUserId
     WHERE ad.delegateUserId = ?
       AND ad.isActive = 1
       AND delegator.role IN ('admin', 'manager')
       AND delegator.status = 'active'
     ORDER BY CASE delegator.role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
     LIMIT 1`,
    [delegateUserId]
  );

  return rows[0] || null;
};

export const listDelegatedOfficerIdsByAdmin = async (connection, delegatorUserId) => {
  if (!delegatorUserId) return [];
  await ensureAdminDelegationSchema(connection);

  const [rows] = await connection.execute(
    `SELECT delegateOfficerId
     FROM admin_delegations
     WHERE delegatorUserId = ?
       AND isActive = 1
       AND delegateOfficerId IS NOT NULL`,
    [delegatorUserId]
  );

  return rows.map((row) => row.delegateOfficerId).filter(Boolean);
};

export const listDelegatedOfficerIdsByDelegator = listDelegatedOfficerIdsByAdmin;
