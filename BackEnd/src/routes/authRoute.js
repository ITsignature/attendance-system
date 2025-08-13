const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { generateTokens, verifyToken } = require('../config/jwt');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// =============================================
// LOGIN ENDPOINT
// =============================================
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }).trim()
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;
  const db = getDB();

  try {
    // Get user with role and client info
    const [users] = await db.execute(`
      SELECT 
        au.*,
        r.name as role_name,
        r.access_level,
        c.name as client_name,
        c.is_active as client_active
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      LEFT JOIN clients c ON au.client_id = c.id
      WHERE au.email = ?
    `, [email]);

    console.log('🔍 Debug - Users found:', users.length);
    console.log('🔍 Debug - Email searched:', email);
    if (users.length > 0) {
        console.log('🔍 Debug - User found:', users[0].email, users[0].name);
    }     

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if client is active (skip for super admin)
    if (!user.is_super_admin && !user.client_active) {
      return res.status(401).json({
        success: false,
        message: 'Client account is deactivated'
      });
    }

    // Check account lockout
    if (user.account_locked_until && new Date() < new Date(user.account_locked_until)) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts',
        lockedUntil: user.account_locked_until
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    console.log('🔍 Debug - Password from request:', password);
    console.log('🔍 Debug - Password hash from DB:', user.password_hash);
    console.log('🔍 Debug - Password valid?', isPasswordValid);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
      const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 15; // minutes

      let updateQuery = 'UPDATE admin_users SET failed_login_attempts = ?';
      let updateParams = [newFailedAttempts];

      // Lock account if max attempts reached
      if (newFailedAttempts >= maxAttempts) {
        const lockUntil = new Date(Date.now() + lockoutTime * 60 * 1000);
        updateQuery += ', account_locked_until = ?';
        updateParams.push(lockUntil);
      }

      updateQuery += ' WHERE id = ?';
      updateParams.push(user.id);

      await db.execute(updateQuery, updateParams);

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        remainingAttempts: Math.max(0, maxAttempts - newFailedAttempts)
      });
    }

    // Reset failed login attempts on successful login
    await db.execute(`
      UPDATE admin_users 
      SET failed_login_attempts = 0, 
          account_locked_until = NULL, 
          last_login_at = NOW() 
      WHERE id = ?
    `, [user.id]);

    // Get user permissions
    const [permissions] = await db.execute(`
      SELECT DISTINCT p.module, p.action, p.name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE au.id = ? AND r.is_active = TRUE AND p.is_active = TRUE
    `, [user.id]);

    // Generate JWT tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      clientId: user.client_id,
      roleId: user.role_id,
      isSuperAdmin: user.is_super_admin
    };

    const { accessToken, refreshToken, jti } = generateTokens(tokenPayload);

    // Store session in database
    const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.execute(`
      INSERT INTO user_sessions (admin_user_id, client_id, token_jti, ip_address, user_agent, expires_at,created_at)
      VALUES (?, ?, ?, ?, ?, ?,NOW())
    `, [
      user.id,
      user.client_id,
      jti,
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent'),
      sessionExpiry
    ]);

    // Prepare response data
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      clientId: user.client_id,
      clientName: user.client_name,
      roleId: user.role_id,
      roleName: user.role_name,
      accessLevel: user.access_level,
      isSuperAdmin: user.is_super_admin,
      permissions: permissions.map(p => `${p.module}.${p.action}`),
      lastLogin: user.last_login_at
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed due to server error'
    });
  }
}));

// =============================================
// REFRESH TOKEN ENDPOINT
// =============================================
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    // Verify refresh token
    const decoded = verifyToken(refreshToken, 'refresh');
    const db = getDB();

    // Check if session exists and is active
    const [sessions] = await db.execute(`
      SELECT us.*, au.is_active as user_active
      FROM user_sessions us
      JOIN admin_users au ON us.admin_user_id = au.id
      WHERE us.token_jti = ? AND us.is_active = TRUE AND us.expires_at > NOW()
    `, [decoded.jti]);

    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Get fresh user data
    const [users] = await db.execute(`
      SELECT 
        au.*,
        r.name as role_name,
        r.access_level,
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

    // Generate new tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      clientId: user.client_id,
      roleId: user.role_id,
      isSuperAdmin: user.is_super_admin
    };

    const { accessToken, refreshToken: newRefreshToken, jti } = generateTokens(tokenPayload);

    // Update session with new JTI
    await db.execute(`
      UPDATE user_sessions 
      SET token_jti = ?, expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)
      WHERE token_jti = ?
    `, [jti, decoded.jti]);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
}));

// =============================================
// LOGOUT ENDPOINT
// =============================================
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  try {
    const db = getDB();

    console.log('🔍 Debug - Session JTI:', req.user.sessionJti);
    
    // Deactivate current session
    await db.execute(`
      UPDATE user_sessions 
      SET is_active = FALSE 
      WHERE token_jti = ?
    `, [req.user.sessionJti]);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
}));

// =============================================
// GET CURRENT USER PROFILE
// =============================================
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  try {
    const db = getDB();
    
    // Get fresh user data with permissions
    const [users] = await db.execute(`
      SELECT 
        au.id,
        au.name,
        au.email,
        au.client_id,
        au.department,
        au.last_login_at,
        au.is_super_admin,
        r.id as role_id,
        r.name as role_name,
        r.access_level,
        c.name as client_name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      LEFT JOIN clients c ON au.client_id = c.id
      WHERE au.id = ?
    `, [req.user.userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Get user permissions
    const [permissions] = await db.execute(`
      SELECT DISTINCT 
        p.module, 
        p.action, 
        p.name,
        p.description
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE au.id = ? AND r.is_active = TRUE AND p.is_active = TRUE
      ORDER BY p.module, p.action
    `, [user.id]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...user,
          permissions: permissions.map(p => ({
            key: `${p.module}.${p.action}`,
            module: p.module,
            action: p.action,
            name: p.name,
            description: p.description
          }))
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
}));

module.exports = router;