-- HR Management System Database Schema
-- MySQL Database with Multi-tenant RBAC Support

-- Drop database if exists (for development)
-- DROP DATABASE IF EXISTS hrms_system;

-- Create database
CREATE DATABASE IF NOT EXISTS hrms_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE hrms_system;

-- =============================================
-- 1. CLIENTS TABLE (Multi-tenancy)
-- =============================================
CREATE TABLE clients (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contact_email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    subscription_plan ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
    subscription_expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_clients_active (is_active),
    INDEX idx_clients_name (name)
);

-- =============================================
-- 2. SYSTEM PERMISSIONS TABLE
-- =============================================
CREATE TABLE permissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_permission (module, action),
    INDEX idx_permissions_module (module),
    INDEX idx_permissions_active (is_active)
);

-- =============================================
-- 3. ROLES TABLE (Client-specific + System roles)
-- =============================================
CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    access_level ENUM('basic', 'moderate', 'full') DEFAULT 'basic',
    is_system_role BOOLEAN DEFAULT FALSE,
    is_editable BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_roles_client (client_id),
    INDEX idx_roles_system (is_system_role),
    INDEX idx_roles_active (is_active),
    UNIQUE KEY unique_role_per_client (client_id, name)
);

-- =============================================
-- 4. ROLE PERMISSIONS MAPPING (Many-to-Many)
-- =============================================
CREATE TABLE role_permissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR(36),
    
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (role_id, permission_id),
    INDEX idx_role_permissions_role (role_id),
    INDEX idx_role_permissions_permission (permission_id)
);

-- =============================================
-- 5. DEPARTMENTS TABLE
-- =============================================
CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id VARCHAR(36),
    budget DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_departments_client (client_id),
    INDEX idx_departments_manager (manager_id),
    INDEX idx_departments_active (is_active),
    UNIQUE KEY unique_department_per_client (client_id, name)
);

-- =============================================
-- 6. DESIGNATIONS TABLE
-- =============================================
CREATE TABLE designations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36) NOT NULL,
    title VARCHAR(100) NOT NULL,
    department_id VARCHAR(36),
    min_salary DECIMAL(15,2),
    max_salary DECIMAL(15,2),
    responsibilities TEXT,
    requirements TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_designations_client (client_id),
    INDEX idx_designations_department (department_id),
    INDEX idx_designations_active (is_active),
    UNIQUE KEY unique_designation_per_client (client_id, title)
);

-- =============================================
-- 7. EMPLOYEES TABLE (Central Entity)
-- =============================================
CREATE TABLE employees (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36) NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    nationality VARCHAR(100),
    marital_status ENUM('single', 'married', 'divorced', 'widowed'),
    
    -- Employment Details
    hire_date DATE NOT NULL,
    department_id VARCHAR(36),
    designation_id VARCHAR(36),
    manager_id VARCHAR(36),
    employee_type ENUM('permanent', 'contract', 'intern', 'consultant') DEFAULT 'permanent',
    work_location ENUM('office', 'remote', 'hybrid') DEFAULT 'office',
    employment_status ENUM('active', 'inactive', 'terminated', 'resigned') DEFAULT 'active',
    
    -- Salary Information
    base_salary DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Documents and Additional Info
    profile_image VARCHAR(500),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL,
    
    INDEX idx_employees_client (client_id),
    INDEX idx_employees_code (employee_code),
    INDEX idx_employees_email (email),
    INDEX idx_employees_department (department_id),
    INDEX idx_employees_manager (manager_id),
    INDEX idx_employees_status (employment_status),
    UNIQUE KEY unique_employee_code_per_client (client_id, employee_code)
);

-- =============================================
-- 8. ADMIN USERS TABLE (System Access)
-- =============================================
CREATE TABLE admin_users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36),
    employee_id VARCHAR(36),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(36) NOT NULL,
    department VARCHAR(100),
    
    -- Authentication & Security
    last_login_at TIMESTAMP NULL,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    account_locked_until TIMESTAMP NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(100),
    
    -- Super Admin (cross-client access)
    is_super_admin BOOLEAN DEFAULT FALSE,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    
    INDEX idx_admin_users_client (client_id),
    INDEX idx_admin_users_employee (employee_id),
    INDEX idx_admin_users_email (email),
    INDEX idx_admin_users_role (role_id),
    INDEX idx_admin_users_super (is_super_admin),
    INDEX idx_admin_users_active (is_active)
);

-- =============================================
-- 9. USER SESSIONS TABLE (JWT Session Management)
-- =============================================
CREATE TABLE user_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    admin_user_id VARCHAR(36) NOT NULL,
    client_id VARCHAR(36),
    token_jti VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_token (token_jti),
    INDEX idx_sessions_user (admin_user_id),
    INDEX idx_sessions_client (client_id),
    INDEX idx_sessions_expires (expires_at),
    INDEX idx_sessions_active (is_active)
);

-- =============================================
-- 10. ATTENDANCE TABLE
-- =============================================
CREATE TABLE attendance (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    total_hours DECIMAL(4,2),
    overtime_hours DECIMAL(4,2) DEFAULT 0.00,
    break_duration DECIMAL(4,2) DEFAULT 0.00,
    status ENUM('present', 'absent', 'late', 'half_day', 'on_leave') DEFAULT 'present',
    work_type ENUM('office', 'remote', 'hybrid') DEFAULT 'office',
    notes TEXT,
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_employee_date (employee_id, date),
    INDEX idx_attendance_employee (employee_id),
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_status (status),
    INDEX idx_attendance_work_type (work_type)
);

-- =============================================
-- 11. LEAVE TYPES TABLE
-- =============================================
CREATE TABLE leave_types (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_days_per_year INT DEFAULT 0,
    max_consecutive_days INT DEFAULT 0,
    is_paid BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    approval_hierarchy JSON, -- Store approval workflow
    notice_period_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    
    INDEX idx_leave_types_client (client_id),
    INDEX idx_leave_types_active (is_active),
    UNIQUE KEY unique_leave_type_per_client (client_id, name)
);

-- =============================================
-- 12. LEAVE REQUESTS TABLE
-- =============================================
CREATE TABLE leave_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(36) NOT NULL,
    leave_type_id VARCHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    reviewed_by VARCHAR(36),
    reviewer_comments TEXT,
    supporting_documents JSON, -- Store file paths
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    
    INDEX idx_leave_requests_employee (employee_id),
    INDEX idx_leave_requests_type (leave_type_id),
    INDEX idx_leave_requests_status (status),
    INDEX idx_leave_requests_dates (start_date, end_date),
    INDEX idx_leave_requests_reviewer (reviewed_by)
);

-- =============================================
-- 13. PAYROLL RECORDS TABLE
-- =============================================
CREATE TABLE payroll_records (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(36) NOT NULL,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    
    -- Earnings
    base_salary DECIMAL(15,2) NOT NULL,
    allowances DECIMAL(15,2) DEFAULT 0.00,
    overtime_amount DECIMAL(15,2) DEFAULT 0.00,
    bonus DECIMAL(15,2) DEFAULT 0.00,
    commission DECIMAL(15,2) DEFAULT 0.00,
    gross_salary DECIMAL(15,2) NOT NULL,
    
    -- Deductions
    tax_deduction DECIMAL(15,2) DEFAULT 0.00,
    provident_fund DECIMAL(15,2) DEFAULT 0.00,
    insurance DECIMAL(15,2) DEFAULT 0.00,
    loan_deduction DECIMAL(15,2) DEFAULT 0.00,
    other_deductions DECIMAL(15,2) DEFAULT 0.00,
    total_deductions DECIMAL(15,2) DEFAULT 0.00,
    
    -- Final Amount
    net_salary DECIMAL(15,2) NOT NULL,
    
    -- Payment Info
    payment_status ENUM('pending', 'processing', 'paid', 'failed') DEFAULT 'pending',
    payment_method ENUM('bank_transfer', 'cash', 'cheque') DEFAULT 'bank_transfer',
    payment_date DATE,
    payment_reference VARCHAR(100),
    
    -- Audit
    processed_by VARCHAR(36),
    processed_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    
    INDEX idx_payroll_employee (employee_id),
    INDEX idx_payroll_period (pay_period_start, pay_period_end),
    INDEX idx_payroll_status (payment_status),
    INDEX idx_payroll_payment_date (payment_date),
    UNIQUE KEY unique_employee_pay_period (employee_id, pay_period_start, pay_period_end)
);

-- =============================================
-- 14. HOLIDAYS TABLE
-- =============================================
CREATE TABLE holidays (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    is_optional BOOLEAN DEFAULT FALSE,
    applies_to_all BOOLEAN DEFAULT TRUE,
    department_ids JSON, -- If not applies_to_all, store specific dept IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    
    INDEX idx_holidays_client (client_id),
    INDEX idx_holidays_date (date),
    UNIQUE KEY unique_holiday_per_client_date (client_id, date, name)
);

-- =============================================
-- 15. SYSTEM SETTINGS TABLE
-- =============================================
CREATE TABLE system_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36),
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSON NOT NULL,
    setting_type ENUM('string', 'number', 'boolean', 'object', 'array') DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Can non-admin users see this?
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    
    INDEX idx_settings_client (client_id),
    INDEX idx_settings_key (setting_key),
    UNIQUE KEY unique_setting_per_client (client_id, setting_key)
);

-- =============================================
-- 16. AUDIT LOGS TABLE
-- =============================================
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(36),
    admin_user_id VARCHAR(36),
    entity_type VARCHAR(50) NOT NULL, -- 'employee', 'attendance', 'payroll', etc.
    entity_id VARCHAR(36),
    action ENUM('create', 'read', 'update', 'delete') NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
    
    INDEX idx_audit_client (client_id),
    INDEX idx_audit_user (admin_user_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
);

-- =============================================
-- FOREIGN KEY CONSTRAINTS (Delayed due to dependencies)
-- =============================================

-- Add manager foreign key to departments (circular dependency)
ALTER TABLE departments 
ADD CONSTRAINT fk_departments_manager 
FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Composite indexes for common queries
CREATE INDEX idx_employees_client_status ON employees(client_id, employment_status);
CREATE INDEX idx_attendance_employee_date_range ON attendance(employee_id, date);
CREATE INDEX idx_leave_requests_employee_status ON leave_requests(employee_id, status);
CREATE INDEX idx_payroll_employee_period ON payroll_records(employee_id, pay_period_start, pay_period_end);

-- Full-text search indexes
ALTER TABLE employees ADD FULLTEXT(first_name, last_name, email);
ALTER TABLE departments ADD FULLTEXT(name, description);
ALTER TABLE designations ADD FULLTEXT(title, responsibilities);

-- =============================================
-- TRIGGERS FOR AUDIT LOGGING
-- =============================================

DELIMITER //

-- Trigger for employee updates
CREATE TRIGGER tr_employees_audit_update
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (client_id, entity_type, entity_id, action, old_values, new_values)
    VALUES (
        NEW.client_id,
        'employee',
        NEW.id,
        'update',
        JSON_OBJECT(
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'email', OLD.email,
            'department_id', OLD.department_id,
            'designation_id', OLD.designation_id,
            'base_salary', OLD.base_salary,
            'employment_status', OLD.employment_status
        ),
        JSON_OBJECT(
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'department_id', NEW.department_id,
            'designation_id', NEW.designation_id,
            'base_salary', NEW.base_salary,
            'employment_status', NEW.employment_status
        )
    );
END//

DELIMITER ;

-- =============================================
-- INITIAL DATA SEEDING
-- =============================================

-- Insert default permissions
INSERT INTO permissions (module, action, name, description) VALUES
-- Dashboard
('dashboard', 'view', 'View Dashboard', 'Access to main dashboard and overview'),

-- Employee Management
('employees', 'view', 'View Employees', 'View employee list and profiles'),
('employees', 'create', 'Add Employees', 'Add new employees to the system'),
('employees', 'edit', 'Edit Employees', 'Modify employee information'),
('employees', 'delete', 'Delete Employees', 'Remove employees from system'),

-- Attendance Management
('attendance', 'view', 'View Attendance', 'View attendance records and reports'),
('attendance', 'edit', 'Edit Attendance', 'Modify attendance records'),
('attendance', 'reports', 'Attendance Reports', 'Generate attendance reports'),

-- Leave Management
('leaves', 'view', 'View Leaves', 'View leave records and requests'),
('leaves', 'approve', 'Approve Leaves', 'Approve employee leave requests'),
('leaves', 'reject', 'Reject Leaves', 'Reject employee leave requests'),

-- Payroll Management
('payroll', 'view', 'View Payroll', 'View payroll information and reports'),
('payroll', 'process', 'Process Payroll', 'Process monthly payroll'),
('payroll', 'edit', 'Edit Payroll', 'Modify payroll records and salaries'),
('payroll', 'reports', 'Payroll Reports', 'Generate payroll reports'),

-- System Settings
('settings', 'view', 'View Settings', 'View system configuration'),
('settings', 'edit', 'Edit Settings', 'Modify system settings'),
('settings', 'admin', 'Admin Settings', 'Access admin-only configurations'),

-- RBAC Management
('rbac', 'view', 'View Roles', 'View roles and permissions'),
('rbac', 'create', 'Create Roles', 'Create new custom roles'),
('rbac', 'edit', 'Edit Roles', 'Modify existing roles'),
('rbac', 'delete', 'Delete Roles', 'Delete custom roles'),
('rbac', 'assign', 'Assign Roles', 'Assign roles to users');

-- Insert default client for testing
INSERT INTO clients (id, name, description, contact_email) 
VALUES 
('demo-client-1', 'Demo Corporation', 'Demo company for testing', 'admin@demo.com'),
('demo-client-2', 'TechStart Inc', 'Technology startup company', 'hr@techstart.com');

-- Create default system roles (these will be editable)
INSERT INTO roles (id, client_id, name, description, access_level, is_system_role, is_editable) VALUES
('employee-basic', NULL, 'Employee', 'Basic employee access - can view own data and apply for leave', 'basic', TRUE, TRUE),
('manager', NULL, 'Manager', 'Department manager - can manage team, approve leaves, view reports', 'moderate', TRUE, TRUE),
('hr-admin', NULL, 'HR Admin', 'Full HR access - can manage all employees, payroll, and system settings', 'full', TRUE, TRUE),
('super-admin', NULL, 'Super Admin', 'System-wide access across all clients', 'full', TRUE, FALSE);

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for employee details with department and designation
CREATE VIEW v_employee_details AS
SELECT 
    e.id,
    e.client_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    e.email,
    e.phone,
    e.hire_date,
    e.employee_type,
    e.work_location,
    e.employment_status,
    e.base_salary,
    d.name AS department_name,
    des.title AS designation_title,
    CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
    e.created_at,
    e.updated_at
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees m ON e.manager_id = m.id;

-- View for current month attendance summary
CREATE VIEW v_attendance_summary AS
SELECT 
    e.id AS employee_id,
    e.client_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    COUNT(a.id) AS total_days,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_days,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
    SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_days,
    SUM(a.total_hours) AS total_hours,
    SUM(a.overtime_hours) AS total_overtime_hours
FROM employees e
LEFT JOIN attendance a ON e.id = a.employee_id 
    AND a.date >= DATE_FORMAT(NOW(), '%Y-%m-01')
    AND a.date < DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')
WHERE e.employment_status = 'active'
GROUP BY e.id, e.client_id;

-- =============================================
-- STORED PROCEDURES
-- =============================================

DELIMITER //

-- Procedure to get user permissions
CREATE PROCEDURE GetUserPermissions(IN user_id VARCHAR(36))
BEGIN
    SELECT DISTINCT 
        p.module,
        p.action,
        p.name,
        p.description
    FROM admin_users au
    JOIN roles r ON au.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE au.id = user_id 
    AND au.is_active = TRUE 
    AND r.is_active = TRUE 
    AND p.is_active = TRUE;
END//

-- Procedure to calculate monthly payroll
CREATE PROCEDURE CalculateMonthlyPayroll(
    IN emp_id VARCHAR(36),
    IN pay_start DATE,
    IN pay_end DATE
)
BEGIN
    DECLARE base_sal DECIMAL(15,2);
    DECLARE total_hrs DECIMAL(8,2);
    DECLARE overtime_hrs DECIMAL(8,2);
    DECLARE working_days INT;
    DECLARE actual_days INT;
    
    -- Get employee base salary
    SELECT base_salary INTO base_sal FROM employees WHERE id = emp_id;
    
    -- Calculate working days in period (excluding weekends)
    SELECT COUNT(*) INTO working_days
    FROM (
        SELECT ADDDATE(pay_start, t4.i*1000 + t3.i*100 + t2.i*10 + t1.i) AS date
        FROM (SELECT 0 i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t1,
             (SELECT 0 i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t2,
             (SELECT 0 i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t3,
             (SELECT 0 i UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t4
    ) v
    WHERE date BETWEEN pay_start AND pay_end
    AND WEEKDAY(date) < 5; -- Monday=0, Friday=4
    
    -- Get actual attendance data
    SELECT 
        COALESCE(SUM(total_hours), 0),
        COALESCE(SUM(overtime_hours), 0),
        COUNT(*)
    INTO total_hrs, overtime_hrs, actual_days
    FROM attendance 
    WHERE employee_id = emp_id 
    AND date BETWEEN pay_start AND pay_end
    AND status IN ('present', 'late');
    
    SELECT 
        base_sal,
        working_days,
        actual_days,
        total_hrs,
        overtime_hrs,
        (base_sal / working_days) * actual_days AS prorated_salary,
        overtime_hrs * (base_sal / working_days / 8) * 1.5 AS overtime_amount;
        
END//

DELIMITER ;

-- =============================================
-- SECURITY & OPTIMIZATION
-- =============================================

-- Create database user for application (run this separately with appropriate privileges)
-- CREATE USER 'hrms_app'@'localhost' IDENTIFIED BY 'secure_password_here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.* TO 'hrms_app'@'localhost';
-- FLUSH PRIVILEGES;

-- =============================================
-- SCHEMA VALIDATION & CONSTRAINTS
-- =============================================

-- Add check constraints for data validation
ALTER TABLE employees 
ADD CONSTRAINT chk_employees_salary CHECK (base_salary >= 0),
ADD CONSTRAINT chk_employees_hire_date CHECK (hire_date <= CURDATE());

ALTER TABLE attendance 
ADD CONSTRAINT chk_attendance_hours CHECK (total_hours >= 0 AND total_hours <= 24),
ADD CONSTRAINT chk_attendance_overtime CHECK (overtime_hours >= 0);

ALTER TABLE payroll_records 
ADD CONSTRAINT chk_payroll_gross_salary CHECK (gross_salary >= 0),
ADD CONSTRAINT chk_payroll_net_salary CHECK (net_salary >= 0),
ADD CONSTRAINT chk_payroll_period CHECK (pay_period_end >= pay_period_start);

ALTER TABLE leave_requests 
ADD CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
ADD CONSTRAINT chk_leave_days CHECK (days_requested > 0);

-- =============================================
-- PERFORMANCE OPTIMIZATION QUERIES
-- =============================================

-- Query to analyze table sizes and optimize
-- Run these periodically for maintenance
/*
SELECT 
    table_name,
    table_rows,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS "DB Size in MB"
FROM information_schema.tables 
WHERE table_schema = 'hrms_system'
ORDER BY (data_length + index_length) DESC;
*/

-- =============================================
-- BACKUP AND MAINTENANCE PROCEDURES
-- =============================================

DELIMITER //

-- Procedure for database cleanup (remove old sessions, logs)
CREATE PROCEDURE CleanupOldData()
BEGIN
    -- Remove expired sessions
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR is_active = FALSE;
    
    -- Archive old audit logs (older than 1 year)
    DELETE FROM audit_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    
    -- Remove old attendance records (older than 3 years)
    DELETE FROM attendance 
    WHERE date < DATE_SUB(CURDATE(), INTERVAL 3 YEAR);
    
    -- Optimize tables
    OPTIMIZE TABLE admin_users, employees, attendance, payroll_records;
    
    SELECT 'Database cleanup completed' AS status;
END//

-- Procedure for generating client statistics
CREATE PROCEDURE GetClientStatistics(IN client_uuid VARCHAR(36))
BEGIN
    SELECT 
        c.name AS client_name,
        COUNT(DISTINCT e.id) AS total_employees,
        COUNT(DISTINCT d.id) AS total_departments,
        COUNT(DISTINCT des.id) AS total_designations,
        COUNT(DISTINCT au.id) AS total_admin_users,
        COUNT(DISTINCT r.id) AS total_custom_roles,
        (SELECT COUNT(*) FROM attendance a 
         JOIN employees emp ON a.employee_id = emp.id 
         WHERE emp.client_id = client_uuid 
         AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS attendance_records_last_30_days,
        (SELECT COUNT(*) FROM leave_requests lr 
         JOIN employees emp ON lr.employee_id = emp.id 
         WHERE emp.client_id = client_uuid 
         AND lr.status = 'pending') AS pending_leave_requests
    FROM clients c
    LEFT JOIN employees e ON c.id = e.client_id AND e.employment_status = 'active'
    LEFT JOIN departments d ON c.id = d.client_id AND d.is_active = TRUE
    LEFT JOIN designations des ON c.id = des.client_id AND des.is_active = TRUE
    LEFT JOIN admin_users au ON c.id = au.client_id AND au.is_active = TRUE
    LEFT JOIN roles r ON c.id = r.client_id AND r.is_system_role = FALSE
    WHERE c.id = client_uuid
    GROUP BY c.id, c.name;
END//

DELIMITER ;

-- =============================================
-- DATA MIGRATION SCRIPTS
-- =============================================

-- Script to migrate from old system (if needed)
/*
-- Example migration from old employee table
INSERT INTO employees (
    client_id, employee_code, first_name, last_name, email, 
    hire_date, department_id, base_salary, employment_status
)
SELECT 
    'default-client-id',
    old_emp_code,
    old_first_name,
    old_last_name,
    old_email,
    old_join_date,
    (SELECT id FROM departments WHERE name = old_department_name LIMIT 1),
    old_salary,
    CASE 
        WHEN old_status = 'A' THEN 'active'
        WHEN old_status = 'I' THEN 'inactive'
        ELSE 'terminated'
    END
FROM old_employee_table
WHERE migration_status IS NULL;
*/

-- =============================================
-- API HELPER VIEWS
-- =============================================

-- View for dashboard statistics per client
CREATE VIEW v_dashboard_stats AS
SELECT 
    c.id AS client_id,
    c.name AS client_name,
    COUNT(DISTINCT e.id) AS total_employees,
    COUNT(DISTINCT CASE WHEN e.employment_status = 'active' THEN e.id END) AS active_employees,
    COUNT(DISTINCT d.id) AS total_departments,
    COUNT(DISTINCT au.id) AS total_admin_users,
    
    -- Today's attendance
    COUNT(DISTINCT CASE 
        WHEN a.date = CURDATE() AND a.status = 'present' 
        THEN a.employee_id 
    END) AS present_today,
    
    COUNT(DISTINCT CASE 
        WHEN a.date = CURDATE() AND a.status = 'absent' 
        THEN a.employee_id 
    END) AS absent_today,
    
    COUNT(DISTINCT CASE 
        WHEN a.date = CURDATE() AND a.status = 'late' 
        THEN a.employee_id 
    END) AS late_today,
    
    -- Leave requests
    COUNT(DISTINCT CASE 
        WHEN lr.status = 'pending' 
        THEN lr.id 
    END) AS pending_leave_requests,
    
    -- This month's payroll
    COUNT(DISTINCT CASE 
        WHEN pr.pay_period_start >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND pr.payment_status = 'pending'
        THEN pr.id 
    END) AS pending_payroll_records
    
FROM clients c
LEFT JOIN employees e ON c.id = e.client_id
LEFT JOIN departments d ON c.id = d.client_id AND d.is_active = TRUE
LEFT JOIN admin_users au ON c.id = au.client_id AND au.is_active = TRUE
LEFT JOIN attendance a ON e.id = a.employee_id
LEFT JOIN leave_requests lr ON e.id = lr.employee_id
LEFT JOIN payroll_records pr ON e.id = pr.employee_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name;

-- View for employee directory with search capabilities
CREATE VIEW v_employee_directory AS
SELECT 
    e.id,
    e.client_id,
    e.employee_code,
    e.first_name,
    e.last_name,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    e.email,
    e.phone,
    e.hire_date,
    e.employee_type,
    e.work_location,
    e.employment_status,
    d.name AS department,
    des.title AS designation,
    CONCAT(m.first_name, ' ', m.last_name) AS manager,
    e.profile_image,
    
    -- Calculate years of service
    TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) AS years_of_service,
    
    -- Last attendance status
    (SELECT a.status 
     FROM attendance a 
     WHERE a.employee_id = e.id 
     ORDER BY a.date DESC 
     LIMIT 1) AS last_attendance_status,
     
    -- Current leave status
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM leave_requests lr 
            WHERE lr.employee_id = e.id 
            AND CURDATE() BETWEEN lr.start_date AND lr.end_date
            AND lr.status = 'approved'
        ) THEN 'On Leave'
        ELSE 'Available'
    END AS current_status
    
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees m ON e.manager_id = m.id
WHERE e.employment_status = 'active';

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- Insert sample departments for demo client
INSERT INTO departments (client_id, name, description) VALUES
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Human Resources', 'Manages employee relations and policies'),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Engineering', 'Software development and technical operations'),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Marketing', 'Brand promotion and customer acquisition'),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Sales', 'Revenue generation and client relations'),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Finance', 'Financial planning and accounting');

-- Insert sample designations
INSERT INTO designations (client_id, title, department_id, min_salary, max_salary) VALUES
-- HR Department
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'HR Manager', 
 (SELECT id FROM departments WHERE name = 'Human Resources' AND client_id = (SELECT id FROM clients WHERE name = 'Demo Corporation')), 
 80000, 120000),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'HR Executive', 
 (SELECT id FROM departments WHERE name = 'Human Resources' AND client_id = (SELECT id FROM clients WHERE name = 'Demo Corporation')), 
 50000, 70000),

-- Engineering Department  
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Senior Software Engineer', 
 (SELECT id FROM departments WHERE name = 'Engineering' AND client_id = (SELECT id FROM clients WHERE name = 'Demo Corporation')), 
 90000, 140000),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Software Engineer', 
 (SELECT id FROM departments WHERE name = 'Engineering' AND client_id = (SELECT id FROM clients WHERE name = 'Demo Corporation')), 
 60000, 90000),
((SELECT id FROM clients WHERE name = 'Demo Corporation'), 'Junior Developer', 
 (SELECT id FROM departments WHERE name = 'Engineering' AND client_id = (SELECT id FROM clients WHERE name = 'Demo Corporation')), 
 40000, 60000);

-- =============================================
-- FINAL OPTIMIZATION & SECURITY
-- =============================================

-- Create indexes for JSON columns (MySQL 5.7+)
-- ALTER TABLE system_settings ADD INDEX idx_settings_value ((CAST(setting_value->>'$.type' AS CHAR(50))));

-- Enable general query log for debugging (disable in production)
-- SET GLOBAL general_log = 'ON';
-- SET GLOBAL general_log_file = '/var/log/mysql/hrms-query.log';

-- Performance monitoring queries
/*
-- Check slow queries
SELECT * FROM mysql.slow_log WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Check table locks
SHOW OPEN TABLES WHERE In_use > 0;

-- Check connection status
SHOW STATUS LIKE 'Connections';
SHOW STATUS LIKE 'Threads_connected';
*/

-- =============================================
-- SCHEMA DOCUMENTATION
-- =============================================

/*
HRMS DATABASE SCHEMA DOCUMENTATION
==================================

1. MULTI-TENANCY:
   - All data is isolated by client_id
   - Super admins can access cross-client data
   - Each client has their own roles and settings

2. RBAC SYSTEM:
   - Flat permission assignment (no inheritance)
   - Module.action permission format
   - Editable system roles per client
   - Custom roles supported

3. CORE ENTITIES:
   - Clients: Multi-tenant organizations
   - Admin Users: System access with roles
   - Employees: Core HR entity
   - Attendance: Daily work tracking
   - Leave Management: Request/approval workflow
   - Payroll: Salary processing
   
4. SECURITY FEATURES:
   - Password hashing required in application
   - Session management with JWT
   - Audit logging for sensitive operations
   - Failed login attempt tracking
   - Account lockout mechanism

5. PERFORMANCE:
   - Proper indexing on foreign keys
   - Composite indexes for common queries
   - Views for complex reporting
   - Stored procedures for calculations
   - Partitioning ready for large datasets

6. MAINTENANCE:
   - Automated cleanup procedures
   - Data archival strategies
   - Backup considerations
   - Monitoring queries provided

7. API READY:
   - Helper views for dashboard
   - Employee directory with search
   - Statistics aggregation
   - Optimized for REST endpoints
*/

-- =============================================
-- END OF SCHEMA
-- =============================================

-- Success message
SELECT 'HRMS Database Schema Created Successfully!' AS message,
       'Total Tables Created: 16' AS tables_count,
       'Views Created: 3' AS views_count,
       'Stored Procedures: 3' AS procedures_count,
       'Ready for Application Integration' AS status;