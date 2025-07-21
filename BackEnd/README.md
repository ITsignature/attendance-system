A comprehensive, multi-tenant HR Management System backend built with Node.js, Express, and MySQL. Features role-based access control (RBAC), JWT authentication, and complete HR modules.

## 🚀 Features

### Core Modules
- **Employee Management** - Complete CRUD operations with client isolation
- **Attendance Tracking** - Check-in/out, overtime calculation, bulk operations
- **Leave Management** - Request, approval workflow, leave types
- **Payroll Processing** - Salary calculation, bulk processing, payment tracking
- **Dashboard Analytics** - Real-time insights and reporting

### Security & Authentication
- **JWT Authentication** - Access & refresh tokens with session management
- **RBAC System** - Flat permission assignment with client isolation
- **Multi-tenant Architecture** - Complete data isolation per client
- **Super Admin Support** - Cross-client access for platform management
- **Role Switching** - Dynamic client context switching

### Technical Features
- **RESTful APIs** - Well-structured endpoints with validation
- **Database Transactions** - Data consistency and rollback support
- **Audit Logging** - Complete activity tracking
- **Error Handling** - Comprehensive error management
- **Rate Limiting** - API protection and abuse prevention
- **File Upload Support** - Document management capabilities

## 📋 Prerequisites

- Node.js 16+ 
- MySQL 5.7+ (with JSON support)
- npm or yarn

## 🛠️ Installation & Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd hrms-backend
npm install
```

### 2. Database Setup
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE hrms_system;

# Run the schema (use the provided SQL schema)
mysql -u root -p hrms_system < schema.sql
```

### 3. Environment Configuration
Create `.env` file:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=hrms_app
DB_PASSWORD=your_secure_password
DB_NAME=hrms_system

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=15

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 4. Initialize Database
```bash
# Seed sample data
npm run seed

# Create super admin (interactive)
node scripts/createSuperAdmin.js
```

### 5. Start Development Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Authentication
```
POST /auth/login              - User login
POST /auth/refresh            - Refresh access token
POST /auth/logout             - Logout current session
POST /auth/logout-all         - Logout all sessions
GET  /auth/me                 - Get current user profile
POST /auth/switch-client      - Switch client context (super admin)
PUT  /auth/change-password    - Change password
```

### Employee Management
```
GET    /api/employees         - Get employees (with pagination & filters)
GET    /api/employees/:id     - Get single employee
POST   /api/employees         - Create new employee
PUT    /api/employees/:id     - Update employee
DELETE /api/employees/:id     - Terminate employee
```

### Attendance Management
```
GET    /api/attendance        - Get attendance records
POST   /api/attendance        - Create attendance record
PUT    /api/attendance/:id    - Update attendance record
```

### Leave Management
```
GET    /api/leaves/requests   - Get leave requests
POST   /api/leaves/requests   - Create leave request
PATCH  /api/leaves/requests/:id/review - Approve/reject leave
```

### Payroll Management
```
GET    /api/payroll           - Get payroll records
POST   /api/payroll           - Create payroll record
POST   /api/payroll/bulk-process - Bulk payroll processing
PATCH  /api/payroll/:id/payment-status - Update payment status
```

### Dashboard & Analytics
```
GET    /api/dashboard/overview           - Dashboard statistics
GET    /api/dashboard/attendance-overview - Weekly attendance data
GET    /api/dashboard/employee-distribution - Department distribution
GET    /api/dashboard/recent-activities  - Recent system activities
GET    /api/dashboard/attendance-trends  - Monthly attendance trends
```

### RBAC Management
```
GET    /api/rbac/permissions  - Get all permissions
GET    /api/rbac/roles        - Get roles for client
GET    /api/rbac/roles/:id    - Get role with permissions
POST   /api/rbac/roles        - Create custom role
```

## 🔐 Permission System

### Permission Format
Permissions follow `module.action` format:
- `employees.view` - View employees
- `employees.create` - Create employees
- `attendance.edit` - Edit attendance
- `payroll.process` - Process payroll
- `rbac.assign` - Assign roles

### Default Roles
- **Employee** - Basic access (dashboard.view, leaves.view)
- **Manager** - Team management, leave approval
- **HR Admin** - Full HR access, RBAC management
- **Super Admin** - Cross-client system access

### Client Isolation
- Each client has completely isolated data
- Users can only access their client's data
- Super admin can switch between clients
- All APIs enforce client-based filtering

## 🧪 Testing

```bash
# Run tests
npm test

# Test specific endpoint
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah@demo.com","password":"demo123"}'
```

## 📊 Monitoring & Logging

### Health Check
```
GET /health - Server health status
```

### Audit Logging
All sensitive operations are automatically logged to `audit_logs` table:
- User actions (create, update, delete)
- IP address and user agent tracking
- Timestamp and entity details

### Request Logging
- Development: Console logging
- Production: File-based logging
- Configurable log levels

## 🔧 Configuration

### Rate Limiting
- 100 requests per 15-minute window
- Configurable via environment variables

### Session Management
- JWT tokens with configurable expiry
- Refresh token rotation
- Session tracking in database
- Multiple device support

### File Uploads
- Configurable upload directory
- File size limits
- Type validation

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure proper CORS origins
4. Set up SSL/TLS
5. Configure reverse proxy (nginx)
6. Set up database backups
7. Monitor logs and performance

### Docker Setup
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Follow code style guidelines
4. Add tests for new features
5. Submit pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Check the documentation
- Review API endpoints
- Check server logs
- Verify database connection
- Confirm environment variables

---

**Happy Coding!** 🎉

# =============================================
# SETUP COMPLETION COMMANDS
# =============================================

# After creating all files, run these commands:

# 1. Install dependencies
npm install

# 2. Create uploads directory
mkdir uploads logs

# 3. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Run database schema
mysql -u root -p hrms_system < path/to/schema.sql

# 5. Seed sample data
npm run seed

# 6. Create super admin
node scripts/createSuperAdmin.js

# 7. Start development server
npm run dev

# 8. Test the API
curl http://localhost:5000/health

echo "🎉 HRMS Backend setup completed successfully!"
echo "📡 Server running on: http://localhost:5000"
echo "🔗 Health check: http://localhost:5000/health"
echo "📚 API Documentation: Check README.md" HRMS Backend Setup Instructions
# =============================================

# 1. CREATE PROJECT DIRECTORY
mkdir hrms-backend
cd hrms-backend

# 2. INITIALIZE NODE PROJECT
npm init -y

# 3. INSTALL DEPENDENCIES
npm install express mysql2 bcryptjs jsonwebtoken cors dotenv express-validator express-rate-limit helmet morgan multer moment uuid nodemailer compression express-fileupload

# 4. INSTALL DEV DEPENDENCIES
npm install --save-dev nodemon jest supertest

# 5. CREATE FOLDER STRUCTURE
mkdir -p config middleware routes scripts uploads
mkdir -p logs tests

# =============================================
# PROJECT FOLDER STRUCTURE
# =============================================

hrms-backend/
├── config/
│   ├── database.js
│   └── jwt.js
├── middleware/
│   ├── auth.js
│   ├── rbac.js
│   ├── errorHandler.js
│   └── requestLogger.js
├── routes/
│   ├── auth.js
│   ├── employees.js
│   ├── attendance.js
│   ├── leaves.js
│   ├── payroll.js
│   ├── dashboard.js
│   ├── rbac.js
│   └── clients.js
├── scripts/
│   ├── seedDatabase.js
│   └── createSuperAdmin.js
├── uploads/
├── logs/
├── tests/
├── .env
├── .gitignore
├── server.js
├── package.json
└── README.md

# =============================================
# .gitignore
# =============================================
node_modules/
.env
.env.local
.env.development
.env.test
.env.production
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
.vscode/
.idea/
uploads/
logs/
*.log
coverage/
.nyc_output/

# =============================================
#