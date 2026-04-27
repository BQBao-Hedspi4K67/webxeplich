import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import {
  ensureAdminDelegationSchema,
  getDelegationByDelegateUserId,
} from '../utils/adminDelegation.js';

// Middleware: Verify JWT token
export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided',
      code: 'NO_TOKEN',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      ...decoded,
      effectiveRole: decoded.role,
      isDelegatedAdmin: false,
      isDelegatedManager: false,
      delegatedByUserId: null,
    };

    if (!['superadmin'].includes(decoded.role)) {
      const connection = await pool.getConnection();
      try {
        await ensureAdminDelegationSchema(connection);
        const delegation = await getDelegationByDelegateUserId(connection, decoded.id);
        if (delegation) {
          const delegatedRole = String(delegation.delegatorRole || '').toLowerCase();
          req.user.effectiveRole = delegatedRole === 'admin' || delegatedRole === 'manager'
            ? delegatedRole
            : req.user.effectiveRole;
          req.user.isDelegatedAdmin = delegatedRole === 'admin';
          req.user.isDelegatedManager = delegatedRole === 'manager';
          req.user.delegatedByUserId = delegation.delegatorUserId;
          req.user.delegatedOfficerId = delegation.delegateOfficerId || null;
        }
      } finally {
        connection.release();
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
};

// Middleware: Check role permission
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const expandedAllowedRoles = new Set(allowedRoles);
    if (expandedAllowedRoles.has('admin')) {
      expandedAllowedRoles.add('superadmin');
    }

    const effectiveRole = req.user.effectiveRole || req.user.role;
    if (!expandedAllowedRoles.has(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

// Utility: Generate JWT token
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};
