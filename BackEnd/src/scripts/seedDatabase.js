const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '../.env' });

const seedDatabase = async () => {
  const connection = await mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'attendance_system'
});

  try {
    console.log('🌱 Starting database seeding...');

    // Get permission IDs for role assignments
    const [permissions] = await connection.execute('SELECT id, module, action FROM permissions');
    const permissionMap = {};
    permissions.forEach(p => {
      permissionMap[`${p.module}.${p.action}`] = p.id;
    });

    // Assign permissions to system roles
    const systemRolePermissions = {
      'employee-basic': ['dashboard.view', 'leaves.view'],
      'manager': [
        'dashboard.view', 'employees.view', 'attendance.view', 'attendance.reports',
        'leaves.view', 'leaves.approve', 'leaves.reject', 'payroll.view', 'payroll.reports'
      ],
      'hr-admin': [
        'dashboard.view', 'employees.view', 'employees.create', 'employees.edit', 'employees.delete',
        'attendance.view', 'attendance.edit', 'attendance.reports',
        'leaves.view', 'leaves.approve', 'leaves.reject',
        'payroll.view', 'payroll.process', 'payroll.edit', 'payroll.reports',
        'settings.view', 'settings.edit', 'rbac.view', 'rbac.create', 'rbac.edit', 'rbac.delete', 'rbac.assign'
      ]
    };

    // Insert role permissions
    for (const [roleId, rolePermissions] of Object.entries(systemRolePermissions)) {
      for (const permission of rolePermissions) {
        if (permissionMap[permission]) {
          await connection.execute(`
            INSERT IGNORE INTO role_permissions (id, role_id, permission_id)
            VALUES (?, ?, ?)
          `, [uuidv4(), roleId, permissionMap[permission]]);
        }
      }
    }

    // Create super admin role permissions (all permissions)
    const allPermissionIds = Object.values(permissionMap);
    for (const permissionId of allPermissionIds) {
      await connection.execute(`
        INSERT IGNORE INTO role_permissions (id, role_id, permission_id)
        VALUES (?, 'super-admin', ?)
      `, [uuidv4(), permissionId]);
    }

    // Create demo departments for demo client
    const demoClientId = 'demo-client-1';
    const departments = [
      { name: 'Human Resources', description: 'Manages employee relations and policies' },
      { name: 'Engineering', description: 'Software development and technical operations' },
      { name: 'Marketing', description: 'Brand promotion and customer acquisition' },
      { name: 'Sales', description: 'Revenue generation and client relations' },
      { name: 'Finance', description: 'Financial planning and accounting' }
    ];

    const departmentIds = {};
    for (const dept of departments) {
      const deptId = uuidv4();
      departmentIds[dept.name] = deptId;
      await connection.execute(`
        INSERT IGNORE INTO departments (id, client_id, name, description)
        VALUES (?, ?, ?, ?)
      `, [deptId, demoClientId, dept.name, dept.description]);
    }

    // Create demo designations
    const designations = [
      { title: 'HR Manager', department: 'Human Resources', min_salary: 80000, max_salary: 120000 },
      { title: 'Software Engineer', department: 'Engineering', min_salary: 70000, max_salary: 110000 },
      { title: 'Senior Developer', department: 'Engineering', min_salary: 90000, max_salary: 140000 },
      { title: 'Marketing Manager', department: 'Marketing', min_salary: 75000, max_salary: 115000 },
      { title: 'Sales Executive', department: 'Sales', min_salary: 50000, max_salary: 80000 }
    ];

    const designationIds = {};
    for (const desig of designations) {
      const desigId = uuidv4();
      designationIds[desig.title] = desigId;
      await connection.execute(`
        INSERT IGNORE INTO designations (id, client_id, title, department_id, min_salary, max_salary)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [desigId, demoClientId, desig.title, departmentIds[desig.department], desig.min_salary, desig.max_salary]);
    }

    // Create demo employees
    const employees = [
      {
        employee_code: 'EMP001',
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@demo.com',
        phone: '+1234567890',
        department: 'Human Resources',
        designation: 'HR Manager',
        base_salary: 85000,
        hire_date: '2022-01-15'
      },
      {
        employee_code: 'EMP002',
        first_name: 'Mike',
        last_name: 'Chen',
        email: 'mike.chen@demo.com',
        phone: '+1234567891',
        department: 'Engineering',
        designation: 'Senior Developer',
        base_salary: 95000,
        hire_date: '2021-08-20'
      },
      {
        employee_code: 'EMP003',
        first_name: 'Lisa',
        last_name: 'Garcia',
        email: 'lisa.garcia@demo.com',
        phone: '+1234567892',
        department: 'Marketing',
        designation: 'Marketing Manager',
        base_salary: 78000,
        hire_date: '2022-03-10'
      }
    ];

    const employeeIds = {};
    for (const emp of employees) {
      const empId = uuidv4();
      employeeIds[emp.employee_code] = empId;
      await connection.execute(`
        INSERT IGNORE INTO employees (
          id, client_id, employee_code, first_name, last_name, email, phone,
          department_id, designation_id, base_salary, hire_date, employment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        empId, demoClientId, emp.employee_code, emp.first_name, emp.last_name,
        emp.email, emp.phone, departmentIds[emp.department],
        designationIds[emp.designation], emp.base_salary, emp.hire_date
      ]);
    }

    // Create demo admin users
    const password = await bcrypt.hash('demo123', 12);
    
    const adminUsers = [
      {
        name: 'Sarah Johnson',
        email: 'sarah@demo.com',
        client_id: demoClientId,
        employee_id: employeeIds['EMP001'],
        role_id: 'hr-admin',
        department: 'Human Resources'
      },
      {
        name: 'Mike Chen',
        email: 'mike@demo.com',
        client_id: demoClientId,
        employee_id: employeeIds['EMP002'],
        role_id: 'manager',
        department: 'Engineering'
      }
    ];

    for (const user of adminUsers) {
      await connection.execute(`
        INSERT IGNORE INTO admin_users (
          id, client_id, employee_id, name, email, password_hash, role_id, department, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
      `, [uuidv4(), user.client_id, user.employee_id, user.name, user.email, password, user.role_id, user.department]);
    }

    // Create leave types
    const leaveTypes = [
      { name: 'Annual Leave', max_days_per_year: 21, is_paid: true },
      { name: 'Sick Leave', max_days_per_year: 10, is_paid: true },
      { name: 'Personal Leave', max_days_per_year: 5, is_paid: false },
      { name: 'Maternity Leave', max_days_per_year: 90, is_paid: true },
      { name: 'Emergency Leave', max_days_per_year: 3, is_paid: true }
    ];

    for (const leaveType of leaveTypes) {
      await connection.execute(`
        INSERT IGNORE INTO leave_types (id, client_id, name, max_days_per_year, is_paid, requires_approval)
        VALUES (?, ?, ?, ?, ?, TRUE)
      `, [uuidv4(), demoClientId, leaveType.name, leaveType.max_days_per_year, leaveType.is_paid]);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('Demo Login Credentials:');
    console.log('=======================');
    console.log('HR Admin: sarah@demo.com / demo123');
    console.log('Manager:  mike@demo.com / demo123');
    console.log('');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await connection.end();
  }
};

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;