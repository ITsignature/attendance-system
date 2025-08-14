const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🧪 Testing database connection...');
  console.log('📋 Configuration:');
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   Port: ${process.env.DB_PORT || '3306'}`);
  console.log(`   User: ${process.env.DB_USER}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]'}`);
  console.log('');

  let connection;
  
  try {
    // Test 1: Basic connection
    console.log('🔌 Test 1: Creating connection...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timeout: 10000,
    });
    console.log('✅ Connection created successfully');

    // Test 2: Simple query
    console.log('🔍 Test 2: Running simple query...');
    const [result] = await connection.execute('SELECT 1 as test, CURRENT_TIMESTAMP as current_time');
    console.log('✅ Query successful:', result[0]);

    // Test 3: Check if tables exist
    console.log('🗂️ Test 3: Checking tables...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`✅ Found ${tables.length} tables:`, tables.map(t => Object.values(t)[0]));

    // Test 4: Check specific tables for leave system
    const requiredTables = ['employees', 'leave_types', 'leave_requests', 'admin_users'];
    console.log('🔍 Test 4: Checking required tables...');
    
    for (const table of requiredTables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
        console.log(`✅ Table '${table}' exists with ${rows[0].count} records`);
      } catch (error) {
        console.log(`❌ Table '${table}' missing or inaccessible: ${error.message}`);
      }
    }

    // Test 5: Connection pool
    console.log('🏊 Test 5: Testing connection pool...');
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 2,
      queueLimit: 0,
      acquireTimeout: 10000,
      timeout: 10000,
    });

    const [poolResult] = await pool.execute('SELECT "Pool connection works" as message');
    console.log('✅ Pool connection successful:', poolResult[0]);
    await pool.end();

  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(`   Error Code: ${error.code}`);
    console.error(`   Error Message: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState || 'N/A'}`);
    
    // Provide specific troubleshooting based on error
    if (error.code === 'ENOTFOUND') {
      console.error('🌐 DNS Resolution failed. Check your DB_HOST value.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused. Check if database server is running and port is correct.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('🔑 Access denied. Check your username and password.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('🗄️ Database does not exist. Check your DB_NAME.');
    } else if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('📡 Connection lost during operation. This suggests network instability.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔒 Connection closed');
    }
  }
}

// Run the test
testDatabaseConnection()
  .then(() => {
    console.log('\n🎉 Database connection test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
  });