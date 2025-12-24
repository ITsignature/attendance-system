const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const createEduzonAdmin = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔐 Creating Admin User for Eduzon');
    console.log('==================================');

    // First, check if Eduzon client exists
    const [clients] = await connection.execute(
      'SELECT id, name FROM clients WHERE name = ?',
      ['Eduzon']
    );

    if (clients.length === 0) {
      throw new Error('Eduzon client not found! Please run insert_eduzon_client.sql first.');
    }

    const eduzonClientId = clients[0].id;
    console.log(`✓ Found Eduzon client (ID: ${eduzonClientId})`);
    console.log('');

    // Get admin role
    const [roles] = await connection.execute(
      'SELECT id, name FROM roles WHERE client_id = ? OR is_system_role = TRUE LIMIT 1',
      [eduzonClientId]
    );

    let roleId;
    if (roles.length === 0) {
      // Create a default admin role for Eduzon
      roleId = uuidv4();
      await connection.execute(`
        INSERT INTO roles (id, client_id, name, description, access_level, is_system_role, is_active)
        VALUES (?, ?, 'Admin', 'Administrator role for Eduzon', 'full', FALSE, TRUE)
      `, [roleId, eduzonClientId]);
      console.log('✓ Created default Admin role for Eduzon');
    } else {
      roleId = roles[0].id;
      console.log(`✓ Using existing role: ${roles[0].name}`);
    }
    console.log('');

    // Get admin user details
    const name = await question('Enter admin full name: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter password (min 8 chars): ');

    if (!name || !email || password.length < 8) {
      throw new Error('Invalid input. Please provide valid name, email, and password (min 8 chars).');
    }

    // Check if email already exists
    const [existing] = await connection.execute(
      'SELECT id FROM admin_users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      throw new Error('Email already exists!');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const userId = uuidv4();
    await connection.execute(`
      INSERT INTO admin_users (
        id, client_id, name, email, password_hash, role_id, is_super_admin, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE)
    `, [userId, eduzonClientId, name, email, hashedPassword, roleId]);

    console.log('');
    console.log('✅ Eduzon Admin User created successfully!');
    console.log('');
    console.log('Client: Eduzon');
    console.log(`Client ID: ${eduzonClientId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('');
    console.log('⚠️  Please save these credentials securely and change the password after first login.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await connection.end();
    rl.close();
  }
};

createEduzonAdmin();
