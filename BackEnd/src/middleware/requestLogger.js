const { getDB } = require('../config/database');

const requestLogger = async (req, res, next) => {
  // Log API requests for audit purposes
  const startTime = Date.now();
  
  // Capture original end function
  const originalEnd = res.end;
  
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);
    
    const duration = Date.now() - startTime;
    
    // Log request details (you can store this in database for audit)
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }
    
    // Store in audit log if it's a sensitive operation
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.user) {
      logAuditEntry(req, res, duration);
    }
  };
  
  next();
};

const logAuditEntry = async (req, res, duration) => {
  try {
    const db = getDB();
    
    // Extract entity type from URL
    const pathParts = req.originalUrl.split('/');
    const entityType = pathParts[2] || 'unknown'; // /api/employees -> employees
    
    const auditData = {
      client_id: req.user?.clientId || null,
      admin_user_id: req.user?.userId || null,
      entity_type: entityType,
      entity_id: req.params.id || null,
      action: getActionFromMethod(req.method),
      new_values: req.method !== 'DELETE' ? JSON.stringify(req.body) : null,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent') || null
    };
    
    await db.execute(`
      INSERT INTO audit_logs (client_id, admin_user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(auditData));
    
  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't fail the request if audit logging fails
  }
};

const getActionFromMethod = (method) => {
  switch (method) {
    case 'POST': return 'create';
    case 'GET': return 'read';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'unknown';
  }
};

module.exports = {
  requestLogger
};