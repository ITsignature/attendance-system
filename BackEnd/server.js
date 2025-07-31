const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes and middleware
const authRoutes = require('./src/routes/authRoute');
const employeeRoutes = require('./src/routes/employeeRoute');
const attendanceRoutes = require('./src/routes/attendanceRoute');
const leaveRoutes = require('./src/routes/leavesRoute');
const payrollRoutes = require('./src/routes/payrollRoute');
const dashboardRoutes = require('./src/routes/dashboardRoute');
const rbacRoutes = require('./src/routes/rbacRoute');
const clientRoutes = require('./src/routes/clientsRoute');
const departments = require('./src/routes/departmentsRoute');
const designations = require('./src/routes/designationsRoute');
const settingsRoutes = require('./src/routes/settingsRoute');


const { errorHandler } = require('./src/middleware/errorHandlerMiddleware');
const { requestLogger } = require('./src/middleware/requestLoggerMiddleware');
const { connectDB } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================
// SECURITY MIDDLEWARE
// =============================================

// Helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS), // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: process.env.RATE_LIMIT_WINDOW + ' minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174'  // Add any other ports you use
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // If you're using cookies/sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization','X-Client-ID','X-Requested-With']
};

app.use(cors(corsOptions));

// =============================================
// GENERAL MIDDLEWARE
// =============================================

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom request logging
app.use(requestLogger);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// =============================================
// DATABASE CONNECTION
// =============================================
connectDB();

// =============================================
// HEALTH CHECK ENDPOINT
// =============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('./package.json').version
  });
});

// =============================================
// API ROUTES
// =============================================

// Authentication routes (no /api prefix for auth)
app.use('/auth', authRoutes);

// Protected API routes
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/departments', departments);
app.use('/api/designations', designations);
app.use('/api/settings', settingsRoutes);

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use(errorHandler);

// =============================================
// GRACEFUL SHUTDOWN
// =============================================
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// =============================================
// START SERVER
// =============================================
const server = app.listen(PORT, () => {
  console.log(`
🚀 HRMS Backend Server Started Successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running on: http://localhost:${PORT}
🔗 Health check: http://localhost:${PORT}/health
🌍 Environment: ${process.env.NODE_ENV}
📊 Database: ${process.env.DB_NAME}@${process.env.DB_HOST}
🛡️  RBAC: Multi-tenant with role switching
📁 Uploads: ${process.env.UPLOAD_PATH}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;