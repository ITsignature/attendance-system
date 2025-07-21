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

const createSuperAdmin = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔐 Creating Super Admin User');
    console.log('============================');

    const name = await question('Enter full name: ');
    const email = await question('Enter email: ');
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

    // Create super admin
    const userId = uuidv4();
    await connection.execute(`
      INSERT INTO admin_users (
        id, name, email, password_hash, role_id, is_super_admin, is_active
      ) VALUES (?, ?, ?, ?, 'super-admin', TRUE, TRUE)
    `, [userId, name, email, hashedPassword]);

    console.log('');
    console.log('✅ Super Admin created successfully!');
    console.log('');
    console.log('Credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('');
    console.log('⚠️  Please save these credentials securely and change the password after first login.');

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
  } finally {
    await connection.end();
    rl.close();
  }
};

createSuperAdmin();
