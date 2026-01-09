# Quick Setup Guide - Employee Portal

## Summary

I've successfully created a complete employee-facing portal with read-only access. Here's what was implemented:

## ✅ What's Been Created

### 1. **Middleware** ([employeeAuthMiddleware.js](src/middleware/employeeAuthMiddleware.js))
   - `ensureOwnEmployeeAccess` - Ensures employees only access their own profile
   - `ensureOwnAttendance` - Restricts attendance view to own records
   - `ensureOwnPayroll` - Restricts payroll view to own records
   - `ensureOwnLeaves` - Restricts leave requests to own records
   - `ensureOwnFinancialRecords` - Restricts financial records to own data
   - `enforceReadOnly` - Prevents write operations except leave applications

### 2. **Controller** ([employeePortalController.js](src/controllers/employeePortalController.js))
   - `getMyProfile` - View own employee details
   - `getMyAttendance` - View own attendance with summary
   - `getMyPayrollHistory` - View payroll history
   - `getMyPayslip` - Download/view specific payslip
   - `getMyLeaveRequests` - View own leave requests
   - `applyForLeave` - Apply for new leave
   - `getLeaveTypes` - View available leave types
   - `getMyLeaveBalance` - View leave balance
   - `getMyFinancialRecords` - View loans, advances, bonuses (read-only)

### 3. **Routes** ([employeePortalRoute.js](src/routes/employeePortalRoute.js))
   All routes are under `/api/employee-portal/`:
   - `GET /profile` - Own profile
   - `GET /attendance` - Own attendance
   - `GET /payroll/history` - Payroll history
   - `GET /payroll/:id` - Specific payslip
   - `GET /leaves/types` - Leave types
   - `GET /leaves/balance` - Leave balance
   - `GET /leaves/my-requests` - Leave requests
   - `POST /leaves/apply` - Apply for leave
   - `GET /financial-records` - Financial records

### 4. **Database Setup** ([setup_employee_role.sql](src/scripts/setup_employee_role.sql))
   - Creates "Employee" role
   - Creates employee-specific permissions
   - Assigns permissions to role

### 5. **Documentation** ([EMPLOYEE_PORTAL_README.md](EMPLOYEE_PORTAL_README.md))
   - Complete API documentation
   - Setup instructions
   - Example requests/responses
   - Security features
   - Troubleshooting guide

---

## 🚀 How to Set Up

### Step 1: Run Database Script

```bash
# Navigate to the backend directory
cd BackEnd

# Run the SQL script to create Employee role and permissions
mysql -u root -p your_database_name < src/scripts/setup_employee_role.sql
```

Or run directly in MySQL:
```bash
mysql -u root -p your_database_name
source src/scripts/setup_employee_role.sql
```

### Step 2: Create Employee User Accounts

For each employee who needs portal access:

```sql
-- First, check if employee exists
SELECT id, email, first_name, last_name, client_id
FROM employees
WHERE email = 'employee@company.com';

-- Create admin_user linked to employee
INSERT INTO admin_users (
  id,
  client_id,
  employee_id,
  name,
  email,
  password_hash,
  role_id,
  is_super_admin,
  is_active
) VALUES (
  UUID(),
  'YOUR_CLIENT_ID',  -- From employee's client_id
  'EMPLOYEE_ID',     -- From employee's id
  'John Doe',
  'john.doe@company.com',
  '$2a$12$hashpassword...',  -- See password hashing below
  (SELECT id FROM roles WHERE name = 'Employee' LIMIT 1),
  0,
  1
);
```

### Step 3: Generate Password Hash

**Option A: Using Node.js script**
```javascript
// Create a file: generate-hash.js
const bcrypt = require('bcryptjs');

async function generateHash(password) {
  const hash = await bcrypt.hash(password, 12);
  console.log('Password hash:', hash);
}

generateHash('employee_password');
```

Run it:
```bash
node generate-hash.js
```

**Option B: Using backend route (create temporary endpoint)**
```javascript
// Add to server.js temporarily
app.post('/api/temp/hash-password', async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  res.json({ hash });
});
```

### Step 4: Start the Server

```bash
npm start
```

### Step 5: Test Employee Login

```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@company.com",
    "password": "employee_password"
  }'
```

You should get a response with a token:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "name": "John Doe",
      "email": "employee@company.com",
      "roleName": "Employee"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Step 6: Test Employee Portal Endpoints

```bash
# Set the token
TOKEN="your_token_here"

# Test profile
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/employee-portal/profile

# Test attendance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/employee-portal/attendance

# Test payroll history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/employee-portal/payroll/history

# Test leave types
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/employee-portal/leaves/types

# Apply for leave
curl -X POST http://localhost:5000/api/employee-portal/leaves/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type_id": "YOUR_LEAVE_TYPE_ID",
    "start_date": "2024-03-15",
    "end_date": "2024-03-18",
    "leave_duration": "full_day",
    "reason": "Family vacation to visit relatives"
  }'
```

---

## 🔒 Security Features Implemented

1. ✅ **Authentication Required** - All endpoints require JWT token
2. ✅ **Role-Based Access** - Only "Employee" role can access portal
3. ✅ **Data Isolation** - Employees ONLY see their own data
4. ✅ **Read-Only Enforcement** - Cannot edit/delete (except leave application)
5. ✅ **Resource Ownership Validation** - Database-level checks
6. ✅ **Multi-Tenancy** - Client isolation enforced

---

## 📋 Employee Capabilities

### ✅ CAN DO:
- ✅ View own profile (read-only)
- ✅ View own attendance records (read-only)
- ✅ View own payroll and payslips (read-only)
- ✅ View and apply for leaves (apply only)
- ✅ View own financial records (read-only)

### ❌ CANNOT DO:
- ❌ Edit profile
- ❌ Add/edit/delete attendance
- ❌ Edit payroll
- ❌ Approve/reject leaves
- ❌ Apply for loans/advances/bonuses
- ❌ Access admin dashboard
- ❌ View other employees' data
- ❌ Access RBAC settings

---

## 🎨 Frontend Integration Example

```javascript
// Example: Fetch employee profile
const getEmployeeProfile = async () => {
  const token = localStorage.getItem('token');

  const response = await fetch('http://localhost:5000/api/employee-portal/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (data.success) {
    console.log('Employee:', data.data.employee);
  }
};

// Example: Apply for leave
const applyForLeave = async (leaveData) => {
  const token = localStorage.getItem('token');

  const response = await fetch('http://localhost:5000/api/employee-portal/leaves/apply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(leaveData)
  });

  const data = await response.json();
  return data;
};
```

---

## 🐛 Troubleshooting

### Problem: Employee can't log in
**Solution:**
```sql
-- Check if admin_user exists
SELECT * FROM admin_users WHERE email = 'employee@company.com';

-- Check if employee_id is linked
SELECT au.*, e.id as emp_id
FROM admin_users au
LEFT JOIN employees e ON au.employee_id = e.id
WHERE au.email = 'employee@company.com';

-- Check if role is correct
SELECT au.email, r.name as role_name
FROM admin_users au
JOIN roles r ON au.role_id = r.id
WHERE au.email = 'employee@company.com';
```

### Problem: Employee gets 403 Forbidden
**Causes:**
1. `employee_id` not set in `admin_users` table
2. Trying to access another employee's data
3. Wrong role assigned

**Solution:**
```sql
-- Update employee_id if missing
UPDATE admin_users
SET employee_id = (
  SELECT id FROM employees WHERE email = admin_users.email LIMIT 1
)
WHERE email = 'employee@company.com';
```

### Problem: Leave application fails
**Check:**
1. Leave type exists and is active
2. Employee hasn't exceeded max days
3. Notice period is met
4. Dates are valid

```sql
-- Check leave types
SELECT * FROM leave_types WHERE client_id = 'YOUR_CLIENT_ID' AND is_active = 1;

-- Check leave balance
SELECT lt.name, SUM(lr.days_requested) as days_taken
FROM leave_requests lr
JOIN leave_types lt ON lr.leave_type_id = lt.id
WHERE lr.employee_id = 'EMPLOYEE_ID'
  AND lr.status = 'approved'
  AND YEAR(lr.start_date) = YEAR(CURDATE())
GROUP BY lt.id, lt.name;
```

---

## 📝 Next Steps

1. **Create Frontend UI**
   - Build employee dashboard
   - Create leave application form
   - Display attendance calendar
   - Show payslip viewer

2. **Add Features (Optional)**
   - Email notifications for leave status
   - Mobile app integration
   - Employee document upload
   - Performance review section
   - Company announcements

3. **Testing**
   - Test all endpoints with different employees
   - Test access control (try accessing other employee's data)
   - Test leave application workflow
   - Load testing

---

## 📞 Support

For questions or issues:
1. Check [EMPLOYEE_PORTAL_README.md](EMPLOYEE_PORTAL_README.md) for detailed API docs
2. Review middleware in [employeeAuthMiddleware.js](src/middleware/employeeAuthMiddleware.js)
3. Check controller logic in [employeePortalController.js](src/controllers/employeePortalController.js)

---

## Files Created

1. `src/middleware/employeeAuthMiddleware.js` - Security middleware
2. `src/controllers/employeePortalController.js` - Business logic
3. `src/routes/employeePortalRoute.js` - API routes
4. `src/scripts/setup_employee_role.sql` - Database setup
5. `EMPLOYEE_PORTAL_README.md` - Full documentation
6. `EMPLOYEE_SETUP_GUIDE.md` - This file

All files are ready to use! 🚀
