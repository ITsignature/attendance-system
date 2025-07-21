const { getDB } = require('../config/database');

// Middleware to check specific permission
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Check if user has the required permission
    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${requiredPermission}`,
        userPermissions: req.user.permissions // For debugging in development
      });
    }

    next();
  };
};

// Middleware to check multiple permissions (OR logic)
const checkAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required one of: ${requiredPermissions.join(', ')}`,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

// Middleware to check multiple permissions (AND logic)
const checkAllPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(permission => 
        !req.user.permissions.includes(permission)
      );

      return res.status(403).json({
        success: false,
        message: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
        missingPermissions,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

// Middleware to ensure client isolation (multi-tenancy)
const ensureClientAccess = (req, res, next) => {
  // Super admin can access any client
  if (req.user?.isSuperAdmin) {
    return next();
  }

  // Check if client ID is provided in request
  const requestedClientId = req.headers['x-client-id'] || req.params.clientId || req.body.clientId;
  
  // If no client ID in request, use user's client ID
  if (!requestedClientId) {
    req.clientId = req.user.clientId;
    return next();
  }

  // Ensure user can only access their own client's data
  if (requestedClientId !== req.user.clientId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cannot access other client data.',
      allowedClientId: req.user.clientId,
      requestedClientId
    });
  }

  req.clientId = requestedClientId;
  next();
};

// Middleware to check resource ownership (for employee-specific access)
const checkResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const db = getDB();
      const resourceId = req.params.id;
      
      if (!resourceId) {
        return next(); // No specific resource, continue
      }

      let query;
      let params;

      switch (resourceType) {
        case 'employee':
          query = 'SELECT client_id FROM employees WHERE id = ?';
          params = [resourceId];
          break;
        case 'attendance':
          query = `
            SELECT e.client_id 
            FROM attendance a 
            JOIN employees e ON a.employee_id = e.id 
            WHERE a.id = ?
          `;
          params = [resourceId];
          break;
        case 'leave_request':
          query = `
            SELECT e.client_id 
            FROM leave_requests lr 
            JOIN employees e ON lr.employee_id = e.id 
            WHERE lr.id = ?
          `;
          params = [resourceId];
          break;
        case 'payroll':
          query = `
            SELECT e.client_id 
            FROM payroll_records pr 
            JOIN employees e ON pr.employee_id = e.id 
            WHERE pr.id = ?
          `;
          params = [resourceId];
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type for ownership check'
          });
      }

      const [results] = await db.execute(query, params);

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      const resourceClientId = results[0].client_id;

      // Super admin can access any resource
      if (req.user.isSuperAdmin) {
        req.resourceClientId = resourceClientId;
        return next();
      }

      // Check if resource belongs to user's client
      if (resourceClientId !== req.user.clientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Resource belongs to different client.'
        });
      }

      req.resourceClientId = resourceClientId;
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership'
      });
    }
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  ensureClientAccess,
  checkResourceOwnership
};