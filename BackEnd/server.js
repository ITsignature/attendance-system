const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes and middleware
const authRoutes = require('./src/routes/authRoute');
const { router: employeeRoutes } = require('./src/routes/employeeRoute');
const attendanceRoutes = require('./src/routes/attendanceRoute');
const leaveRoutes = require('./src/routes/leavesRoute');
const payrollRoutes = require('./src/routes/payrollRoute');
const payrollRunRoutes = require('./src/routes/payrollRunRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoute');
const rbacRoutes = require('./src/routes/rbacRoute');
const clientRoutes = require('./src/routes/clientsRoute');
const departments = require('./src/routes/departmentsRoute');
const designations = require('./src/routes/designationsRoute');
const settingsRoutes = require('./src/routes/settingsRoute');
const holidaysRoutes = require('./src/routes/holidaysRoute');
const sessionCleanup = require('./src/services/sessionCleanup');


const { errorHandler } = require('./src/middleware/errorHandlerMiddleware');
const { requestLogger } = require('./src/middleware/requestLoggerMiddleware');
const { connectDB, closeDB } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      '*'  // Add any other ports you use
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization','X-Client-ID','X-Requested-With']
};

app.use(cors(corsOptions));

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
connectDB().then(() => {
  // Start session cleanup service after database is connected
  // sessionCleanup.start(30);  
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

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
app.use('/api/payroll-runs', payrollRunRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/departments', departments);
app.use('/api/designations', designations);
app.use('/api/settings', settingsRoutes);
app.use('/api/holidays', holidaysRoutes);

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
const gracefulShutdown = async (signal) => {  
  console.log(`${signal} received. Shutting down gracefully...`);
  
  // Stop session cleanup service
  sessionCleanup.stop(); 
  
  server.close(async () => {
    // Close database connection
    await closeDB();  
    console.log('Process terminated');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));  
process.on('SIGINT', () => gracefulShutdown('SIGINT'));    
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
🔄 Session Cleanup: Running every 30 minutes 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;