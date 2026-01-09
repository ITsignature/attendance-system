/**
 * Create Employee User Script
 *
 * This script helps you create an employee user account linked to an existing employee record.
 *
 * Usage:
 *   node create-employee-user.js
 *
 * The script will prompt you for:
 *   - Employee email (must exist in employees table)
 *   - Password for login
 *   - Client ID (auto-detected from employee record)
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createEmployeeUser() {
  let connection;

  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  CREATE EMPLOYEE USER ACCOUNT         ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Connected to database\n');

    // Step 1: Get employee email
    const email = await question('Enter employee email: ');

    // Check if employee exists
    const [employees] = await connection.execute(
      `SELECT id, client_id, first_name, last_name, email, department_id
       FROM employees
       WHERE email = ? AND employment_status = 'active'`,
      [email]
    );

    if (employees.length === 0) {
      console.log('\n❌ Error: No active employee found with this email');
      console.log('   Please ensure the employee exists in the employees table first.\n');
      rl.close();
      if (connection) await connection.end();
      return;
    }

    const employee = employees[0];
    console.log(`\n✅ Found employee: ${employee.first_name} ${employee.last_name}`);

    // Check if admin_user already exists for this employee
    const [existingUsers] = await connection.execute(
      'SELECT id, email FROM admin_users WHERE employee_id = ?',
      [employee.id]
    );

    if (existingUsers.length > 0) {
      console.log('\n⚠️  Warning: An admin user already exists for this employee');
      console.log(`   Email: ${existingUsers[0].email}`);
      const confirm = await question('   Do you want to create another one? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('\n❌ Cancelled\n');
        rl.close();
        if (connection) await connection.end();
        return;
      }
    }

    // Get department name
    let departmentName = null;
    if (employee.department_id) {
      const [departments] = await connection.execute(
        'SELECT name FROM departments WHERE id = ?',
        [employee.department_id]
      );
      if (departments.length > 0) {
        departmentName = departments[0].name;
      }
    }

    // Step 2: Get password
    const password = await question('Enter password for login: ');
    if (password.length < 8) {
      console.log('\n❌ Error: Password must be at least 8 characters long\n');
      rl.close();
      if (connection) await connection.end();
      return;
    }

    // Step 3: Hash password
    console.log('\n⏳ Hashing password...');
    const passwordHash = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed');

    // Step 4: Get Employee role ID
    const [roles] = await connection.execute(
      "SELECT id FROM roles WHERE name = 'Employee' AND is_system_role = 1 LIMIT 1"
    );

    if (roles.length === 0) {
      console.log('\n❌ Error: Employee role not found');
      console.log('   Please run the setup_employee_role.sql script first:\n');
      console.log('   mysql -u root -p your_database < src/scripts/setup_employee_role.sql\n');
      rl.close();
      if (connection) await connection.end();
      return;
    }

    const employeeRoleId = roles[0].id;

    // Step 5: Create admin_user
    const adminUserId = uuidv4();
    const fullName = `${employee.first_name} ${employee.last_name}`;

    await connection.execute(
      `INSERT INTO admin_users (
        id, client_id, employee_id, name, email, password_hash,
        role_id, department, is_super_admin, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        adminUserId,
        employee.client_id,
        employee.id,
        fullName,
        email,
        passwordHash,
        employeeRoleId,
        departmentName
      ]
    );

    console.log('\n✅ Employee user account created successfully!\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ACCOUNT DETAILS                       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`Name:       ${fullName}`);
    console.log(`Email:      ${email}`);
    console.log(`Password:   ${password}`);
    console.log(`Role:       Employee`);
    console.log(`Department: ${departmentName || 'N/A'}`);
    console.log(`Client ID:  ${employee.client_id}`);
    console.log('\n✅ The employee can now log in using these credentials\n');
    console.log('Test the login:');
    console.log(`curl -X POST http://localhost:5000/auth/login \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"email": "${email}", "password": "${password}"}'\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.code === 'ER_DUP_ENTRY') {
      console.log('\n⚠️  This email is already in use for another admin user');
      console.log('   Each employee can have multiple admin accounts with different emails\n');
    }
  } finally {
    rl.close();
    if (connection) await connection.end();
  }
}

// Run the script
createEmployeeUser().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
