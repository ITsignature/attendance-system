const mysql = require('mysql2/promise');

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      // port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      acquireTimeout: 30000,
      timeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      reconnect: true,
      // MySQL specific options
      charset: 'utf8mb4',
      timezone: 'Z',
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      ssl: {
    rejectUnauthorized: false // For development only
  }
    });

    // Test the connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    connection.release();

    // Add event listeners AFTER successful pool creation
    pool.on('connection', function (connection) {
      console.log('🔗 New connection established as id ' + connection.threadId);
    });

    pool.on('error', function(err) {
      console.error('❌ Database pool error:', err.code, err.message);
      if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('🔄 Connection lost, will attempt to reconnect...');
      }
    });

    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return pool;
};

const closeDB = async () => {
  if (pool) {
    await pool.end();
    console.log('📴 Database connection closed');
  }
};

const testConnection = async () => {
  try {
    const db = getDB();
    const [result] = await db.execute('SELECT 1 as test');
    console.log('✅ Database connectivity test passed');
    return true;
  } catch (error) {
    console.error('❌ Database connectivity test failed:', error.message);
    return false;
  }
};

module.exports = {
  connectDB,
  getDB,
  closeDB,
  testConnection
};