const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/database');
const { verifyToken } = require('../config/jwt');
const { asyncHandler } = require('./errorHandlerMiddleware');

// Middleware to verify JWT token
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    // Verify token
    const decoded = verifyToken(token);
    
    // Check if token exists in sessions table (for logout functionality)
    const db = getDB();
    const [sessions] = await db.execute(`
      SELECT us.*, au.is_active as user_active 
      FROM user_sessions us
      JOIN admin_users au ON us.admin_user_id = au.id
      WHERE us.token_jti = ? AND us.is_active = TRUE AND us.expires_at > NOW()
    `, [decoded.jti]);

    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const session = sessions[0];
    
    
    // Check if user is still active
    if (!session.user_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Get user details with role and permissions
    const [users] = await db.execute(`
      SELECT 
        au.*,
        r.name as role_name,
        r.access_level,
        r.is_system_role,
        c.name as client_name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      LEFT JOIN clients c ON au.client_id = c.id
      WHERE au.id = ? AND au.is_active = TRUE
    `, [decoded.userId]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const user = users[0];

    // Get user permissions
    const [permissions] = await db.execute(`
      SELECT DISTINCT p.module, p.action, p.name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE au.id = ? AND au.is_active = TRUE AND r.is_active = TRUE AND p.is_active = TRUE
    `, [user.id]);

    // Format permissions for easy checking
    const userPermissions = permissions.map(p => `${p.module}.${p.action}`);

    // Attach user info to request
    req.user = {
      userId: user.id,
      name: user.name,
      email: user.email,
      clientId: user.client_id,
      clientName: user.client_name,
      roleId: user.role_id,
      roleName: user.role_name,
      accessLevel: user.access_level,
      isSystemRole: user.is_system_role,
      isSuperAdmin: user.is_super_admin,
      permissions: userPermissions,
      sessionJti: decoded.jti
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Middleware to check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }
  next();
};

module.exports = {
  authenticate,
  requireSuperAdmin
};