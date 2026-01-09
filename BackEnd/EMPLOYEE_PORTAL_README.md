# Employee Portal - Read-Only Employee Interface

## Overview

The Employee Portal is a restricted interface designed for regular employees to access their own data without the ability to edit, delete, or access other employees' information. This interface provides a clean separation between admin functionality and employee self-service features.

## Features

### ✅ What Employees CAN Do:

1. **View Own Profile** (Read-Only)
   - View personal details
   - View employment information
   - View department and designation
   - View manager information
   - **Cannot edit** any profile information

2. **View Own Attendance** (Read-Only)
   - View attendance records
   - View attendance summary (present, absent, late days)
   - View check-in/check-out times
   - View overtime hours
   - **Cannot add, edit, or delete** attendance records

3. **View Own Payroll** (Read-Only)
   - View payroll history
   - Download payslips
   - View earnings breakdown (salary, allowances, overtime, bonus)
   - View deductions (tax, PF, insurance, loans)
   - View net salary and payment status
   - **Cannot edit** any payroll information

4. **Manage Leaves** (Apply Only)
   - View available leave types
   - View leave balance
   - View own leave requests
   - **Apply for new leaves**
   - **Cannot approve or reject** leave requests (even own requests)

5. **View Financial Records** (Read-Only)
   - View loans and deductions
   - View advances
   - View bonuses
   - **Cannot apply for loans, advances, or bonuses**

### ❌ What Employees CANNOT Do:

1. Access admin dashboard
2. View other employees' data
3. Edit own profile information
4. Add/Edit/Delete attendance records
5. Process payroll
6. Approve/Reject leave requests
7. Apply for loans, advances, or bonuses
8. Access RBAC or system settings
9. Manage departments or designations
10. Access client management features

---

## API Endpoints

All employee portal endpoints are prefixed with `/api/employee-portal` and require authentication.

### Authentication

Employees log in using the same authentication endpoint as admins:
```http
POST /auth/login
Content-Type: application/json

{
  "email": "employee@company.com",
  "password": "employee_password"
}
```

The response includes a JWT token that must be included in all subsequent requests:
```
Authorization: Bearer <token>
```

---

## Endpoint Reference

### 1. Profile

#### Get My Profile
```http
GET /api/employee-portal/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": "uuid",
      "employee_code": "EMP001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@company.com",
      "phone": "+1234567890",
      "date_of_birth": "1990-01-15",
      "gender": "male",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001",
      "nationality": "American",
      "marital_status": "single",
      "hire_date": "2020-01-01",
      "employee_type": "permanent",
      "work_location": "office",
      "employment_status": "active",
      "base_salary": 75000,
      "currency": "USD",
      "in_time": "09:00",
      "out_time": "17:00",
      "follows_company_schedule": true,
      "department_name": "Engineering",
      "designation_title": "Software Engineer",
      "manager_name": "Jane Smith",
      "years_of_service": 4
    }
  }
}
```

---

### 2. Attendance

#### Get My Attendance Records
```http
GET /api/employee-portal/attendance?date_from=2024-01-01&date_to=2024-01-31&page=1&limit=30
Authorization: Bearer <token>
```

**Query Parameters:**
- `date_from` (optional): Start date (YYYY-MM-DD)
- `date_to` (optional): End date (YYYY-MM-DD)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "attendance": [
      {
        "id": "uuid",
        "date": "2024-01-15",
        "check_in_time": "09:05:00",
        "check_out_time": "17:30:00",
        "total_hours": 8.42,
        "overtime_hours": 0.5,
        "status": "present",
        "arrival_status": "late",
        "is_weekend": false,
        "work_type": "office",
        "scheduled_in_time": "09:00",
        "scheduled_out_time": "17:00",
        "payable_duration": 510,
        "notes": null,
        "employee_code": "EMP001",
        "employee_name": "John Doe"
      }
    ],
    "summary": {
      "total_days": 22,
      "present_days": 20,
      "absent_days": 2,
      "late_days": 3,
      "avg_hours": 8.25,
      "total_overtime_hours": 5.5
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalRecords": 22,
      "recordsPerPage": 30
    }
  }
}
```

---

### 3. Payroll

#### Get My Payroll History
```http
GET /api/employee-portal/payroll/history?limit=12&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Records per page (default: 12)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "pay_period_start": "2024-01-01",
        "pay_period_end": "2024-01-31",
        "base_salary": 75000,
        "allowances": 5000,
        "overtime_amount": 2000,
        "bonus": 0,
        "commission": 0,
        "gross_salary": 82000,
        "tax_deduction": 12300,
        "provident_fund": 3750,
        "insurance": 500,
        "loan_deduction": 1000,
        "other_deductions": 0,
        "total_deductions": 17550,
        "net_salary": 64450,
        "payment_status": "paid",
        "payment_method": "bank_transfer",
        "payment_date": "2024-02-01",
        "payment_reference": "PAY-2024-01-001",
        "created_at": "2024-01-31T10:00:00Z"
      }
    ],
    "statistics": {
      "total_records": 12,
      "total_earned": 773400,
      "average_salary": 64450,
      "highest_salary": 70000,
      "lowest_salary": 60000
    },
    "pagination": {
      "total": 12,
      "limit": 12,
      "offset": 0,
      "pages": 1
    }
  }
}
```

#### Get Payslip
```http
GET /api/employee-portal/payroll/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "company": {
      "name": "ABC Corporation",
      "address": "456 Business Ave, NYC",
      "phone": "+1234567890",
      "email": "hr@abccorp.com"
    },
    "employee": {
      "id": "EMP001",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "phone": "+1234567890",
      "designation": "Software Engineer",
      "department": "Engineering",
      "hire_date": "2020-01-01",
      "bank_account": "1234567890",
      "bank_name": "Chase Bank"
    },
    "payroll": {
      "id": "uuid",
      "period": {
        "start": "2024-01-01",
        "end": "2024-01-31"
      },
      "earnings": {
        "basic_salary": 75000,
        "allowances": 5000,
        "overtime": 2000,
        "bonus": 0,
        "commission": 0,
        "gross_total": 82000
      },
      "deductions": {
        "tax": 12300,
        "provident_fund": 3750,
        "insurance": 500,
        "loan": 1000,
        "other": 0,
        "total": 17550
      },
      "net_salary": 64450,
      "payment": {
        "status": "paid",
        "method": "bank_transfer",
        "date": "2024-02-01",
        "reference": "PAY-2024-01-001"
      }
    },
    "generated_at": "2024-02-05T14:30:00Z"
  }
}
```

---

### 4. Leaves

#### Get Leave Types
```http
GET /api/employee-portal/leaves/types
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Annual Leave",
      "description": "Paid annual vacation leave",
      "max_days_per_year": 20,
      "max_consecutive_days": 15,
      "is_paid": true,
      "requires_approval": true,
      "notice_period_days": 7
    },
    {
      "id": "uuid",
      "name": "Sick Leave",
      "description": "Medical leave for illness",
      "max_days_per_year": 10,
      "max_consecutive_days": 5,
      "is_paid": true,
      "requires_approval": true,
      "notice_period_days": 0
    }
  ]
}
```

#### Get My Leave Balance
```http
GET /api/employee-portal/leaves/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "balances": [
      {
        "leave_type_id": "uuid",
        "leave_type_name": "Annual Leave",
        "is_paid": true,
        "max_days": 20,
        "days_taken": 8,
        "days_remaining": 12
      },
      {
        "leave_type_id": "uuid",
        "leave_type_name": "Sick Leave",
        "is_paid": true,
        "max_days": 10,
        "days_taken": 2,
        "days_remaining": 8
      }
    ]
  }
}
```

#### Get My Leave Requests
```http
GET /api/employee-portal/leaves/my-requests?status=pending&limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `start_date` (optional): Filter by start date (YYYY-MM-DD)
- `end_date` (optional): Filter by end date (YYYY-MM-DD)
- `status` (optional): Filter by status (pending|approved|rejected)
- `limit` (optional): Records per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "leave_type_id": "uuid",
      "leave_type_name": "Annual Leave",
      "start_date": "2024-03-15",
      "end_date": "2024-03-18",
      "leave_duration": "full_day",
      "start_time": null,
      "end_time": null,
      "days_requested": 4,
      "reason": "Family vacation to visit relatives",
      "status": "pending",
      "applied_at": "2024-03-01T10:00:00Z",
      "reviewed_at": null,
      "reviewer_comments": null,
      "supporting_documents": null,
      "is_paid": true,
      "reviewer_name": null
    }
  ]
}
```

#### Apply for Leave
```http
POST /api/employee-portal/leaves/apply
Authorization: Bearer <token>
Content-Type: application/json

{
  "leave_type_id": "uuid",
  "start_date": "2024-03-15",
  "end_date": "2024-03-18",
  "leave_duration": "full_day",
  "reason": "Family vacation to visit relatives",
  "notes": "Will be available on phone for emergencies",
  "supporting_documents": null
}
```

**Leave Duration Options:**
- `full_day` - Full day leave
- `half_day` - Half day leave
- `short_leave` - Short leave (requires start_time and end_time)

**For Short Leave:**
```json
{
  "leave_type_id": "uuid",
  "start_date": "2024-03-15",
  "end_date": "2024-03-15",
  "leave_duration": "short_leave",
  "start_time": "14:00",
  "end_time": "16:00",
  "reason": "Doctor appointment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Leave request submitted successfully",
  "data": {
    "id": "uuid",
    "employee_name": "John Doe",
    "leave_type": "Annual Leave",
    "leave_duration": "full_day",
    "start_date": "2024-03-15",
    "end_date": "2024-03-18",
    "days_requested": 4,
    "is_paid": true,
    "status": "pending"
  }
}
```

---

### 5. Financial Records

#### Get My Financial Records
```http
GET /api/employee-portal/financial-records?type=loan
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` (optional): Filter by type (loan|advance|bonus)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "loan",
      "loan_type": "personal",
      "amount": 10000,
      "interest_rate": 5.5,
      "tenure_months": 12,
      "monthly_deduction": 875,
      "total_paid": 4375,
      "remaining_amount": 5625,
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "status": "active",
      "notes": "Personal loan for emergency",
      "created_at": "2023-12-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "type": "bonus",
      "bonus_type": "performance",
      "amount": 5000,
      "description": "Q1 Performance Bonus",
      "bonus_period": "Q1 2024",
      "start_date": "2024-04-01",
      "payment_date": "2024-04-05",
      "payment_method": "bank_transfer",
      "status": "paid",
      "notes": "Excellent performance in Q1",
      "created_at": "2024-03-25T10:00:00Z"
    }
  ],
  "summary": {
    "total_records": 2,
    "loans": 1,
    "advances": 0,
    "bonuses": 1
  }
}
```

---

## Setup Instructions

### 1. Database Setup

Run the employee role setup script:

```bash
mysql -u root -p your_database < BackEnd/src/scripts/setup_employee_role.sql
```

This will:
- Create the "Employee" role
- Create employee-specific permissions
- Assign permissions to the Employee role

### 2. Create Employee User Account

For each employee who needs portal access:

```sql
-- 1. Ensure employee exists in employees table
SELECT id, email, first_name, last_name FROM employees WHERE email = 'employee@company.com';

-- 2. Create admin_user linked to employee
INSERT INTO admin_users (
  id,
  client_id,
  employee_id,
  name,
  email,
  password_hash,
  role_id,
  department,
  is_super_admin,
  is_active
) VALUES (
  UUID(),
  '<client_id>',  -- From employees.client_id
  '<employee_id>',  -- From employees.id
  'John Doe',
  'john.doe@company.com',
  '<bcrypt_hashed_password>',  -- Hash password with bcrypt
  (SELECT id FROM roles WHERE name = 'Employee' LIMIT 1),
  'Engineering',
  0,  -- NOT super admin
  1   -- Active
);
```

### 3. Generate Password Hash

Use bcrypt to hash the password (in Node.js):

```javascript
const bcrypt = require('bcryptjs');
const password = 'employee_password';
const hash = await bcrypt.hash(password, 12);
console.log(hash);  // Use this in password_hash field
```

### 4. Test Employee Login

```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@company.com",
    "password": "employee_password"
  }'
```

---

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Role-Based Access**: Only users with "Employee" role can access portal
3. **Data Isolation**: Employees can ONLY access their own data
4. **Read-Only Enforcement**: Most operations are read-only via middleware
5. **Resource Ownership**: Middleware validates that requested resources belong to the authenticated employee
6. **Multi-Tenancy**: Client isolation is enforced at database level

---

## Error Handling

### Common Error Responses

**401 Unauthorized** - No token or invalid token
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

**403 Forbidden** - Trying to access another employee's data
```json
{
  "success": false,
  "message": "Access denied. You can only access your own employee data."
}
```

**404 Not Found** - Resource doesn't exist
```json
{
  "success": false,
  "message": "Employee profile not found"
}
```

**400 Bad Request** - Invalid input
```json
{
  "success": false,
  "message": "Reason must be between 10 and 500 characters"
}
```

---

## Frontend Integration

### Example React Hook for Employee Portal

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/employee-portal';

export const useEmployeePortal = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return {
    // Profile
    getProfile: () => api.get('/profile'),

    // Attendance
    getAttendance: (params) => api.get('/attendance', { params }),

    // Payroll
    getPayrollHistory: (params) => api.get('/payroll/history', { params }),
    getPayslip: (id) => api.get(`/payroll/${id}`),

    // Leaves
    getLeaveTypes: () => api.get('/leaves/types'),
    getLeaveBalance: () => api.get('/leaves/balance'),
    getMyLeaves: (params) => api.get('/leaves/my-requests', { params }),
    applyLeave: (data) => api.post('/leaves/apply', data),

    // Financial Records
    getFinancialRecords: (params) => api.get('/financial-records', { params })
  };
};
```

---

## Troubleshooting

### Employee can't log in
- Verify employee exists in `employees` table
- Verify admin_user exists with correct `employee_id` link
- Verify admin_user has `is_active = 1`
- Verify password hash is correct (bcrypt)
- Check role assignment (should be "Employee" role)

### Employee gets 403 errors
- Verify `employee_id` is set in `admin_users` table
- Verify employee belongs to the correct client
- Check that role has correct permissions
- Ensure employee is trying to access only their own data

### Leave application fails
- Check leave type exists and is active
- Verify employee hasn't exceeded max days
- Check notice period requirements
- Ensure dates are valid

---

## Next Steps

1. Create frontend interface for employee portal
2. Add email notifications for leave applications
3. Add mobile app support
4. Implement employee document upload
5. Add employee performance reviews section

---

## Support

For issues or questions, contact your system administrator or IT support team.
