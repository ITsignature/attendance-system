const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

const checkPermissionModules = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('📊 Checking how permissions are grouped by module:\n');

    const [modules] = await connection.execute(`
      SELECT DISTINCT module FROM permissions ORDER BY module
    `);

    console.table(modules);

    console.log('\n📋 Leave-related permissions:\n');
    const [leavePerms] = await connection.execute(`
      SELECT module, action, name FROM permissions
      WHERE module IN ('leaves', 'leave_types', 'settings')
      ORDER BY module, action
    `);

    console.table(leavePerms);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
};

checkPermissionModules()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
