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
      connectionLimit: 20, // Increased from 10
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // MySQL specific options
      charset: 'utf8mb4',
      timezone: 'Z',
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      decimalNumbers: true,
      rowsAsArray: false,
      multipleStatements: false
    });

    let retries = 3;
    while(retries>0){
      try{
        const connection = await pool.getConnection();
        console.log('✅ MySQL Database connected successfully');

        await connection.execute("SET SESSION wait_timeout = 28800"); // 8 hours
        await connection.execute("SET SESSION interactive_timeout = 28800"); // 8 hours

        connection.release();
        break;
      }catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.log(`⚠️ Connection attempt failed, retrying... (${3 - retries}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Add event listeners AFTER successful pool creation
    pool.on('connection', (connection) => {
      // Set session variables for each new connection
      connection.execute("SET SESSION sql_mode = 'TRADITIONAL'");
      connection.execute("SET SESSION wait_timeout = 28800");
      connection.execute("SET SESSION interactive_timeout = 28800");
    });

    pool.on('error', (err) => {
      console.error('Database pool error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        console.log('Attempting to reconnect to database...');
        connectDB();
      }
    });

    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    // Retry connection after 5 seconds
    console.log('Retrying database connection in 5 seconds...');
    setTimeout(() => connectDB(), 5000);
    
    throw error;
  }
};

const getDB = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return pool;
};

const executeQuery = async (query, params = []) => {
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const db = getDB();
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error
      if (error.code === 'ECONNRESET' || 
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ETIMEDOUT') {
        retries--;
        
        if (retries > 0) {
          console.log(`Query failed with ${error.code}, retrying... (${3 - retries}/3)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        // For non-connection errors, throw immediately
        throw error;
      }
    }
  }
  
  throw lastError;
};

const closeDB = async () => {
  if (pool) {
    await pool.end();
    console.log('📴 Database connection closed');
  }
};

const checkDatabaseHealth = async () => {
  try {
    const db = getDB();
    const [result] = await db.execute('SELECT 1');
    return { healthy: true, message: 'Database is responsive' };
  } catch (error) {
    return { healthy: false, message: error.message };
  }
};

module.exports = {
  connectDB,
  getDB,
  executeQuery,
  closeDB,
  checkDatabaseHealth
};