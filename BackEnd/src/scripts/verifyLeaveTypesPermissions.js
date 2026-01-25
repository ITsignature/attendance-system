const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

const verifyLeaveTypesPermissions = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('📊 Verifying leave_types permissions in database...\n');

    const [permissions] = await connection.execute(`
      SELECT p.module, p.action, p.name, p.description, p.is_active
      FROM permissions p
      WHERE p.module = 'leave_types'
      ORDER BY p.action
    `);

    console.log('✅ Leave Types Permissions:');
    console.table(permissions);

    console.log('\n📋 Role assignments for leave_types permissions:\n');

    const [rolePerms] = await connection.execute(`
      SELECT r.name as role_name, p.action, p.name as permission_name
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE p.module = 'leave_types'
      ORDER BY r.name, p.action
    `);

    console.table(rolePerms);

    console.log('\n✅ Verification completed successfully!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

if (require.main === module) {
  verifyLeaveTypesPermissions()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = verifyLeaveTypesPermissions;
