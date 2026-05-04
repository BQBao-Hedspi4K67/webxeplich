import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Parse database configuration from DATABASE_URL or individual env vars
let dbConfig = {};

if (process.env.DATABASE_URL) {
  // Parse connection string: mysql://user:password@host:port/database
  try {
    const url = new URL(process.env.DATABASE_URL);
    dbConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading '/'
    };
    
    // TiDB Cloud requires SSL/TLS
    if (url.hostname.includes('tidbcloud') || url.hostname.includes('tidb')) {
      dbConfig.ssl = {}; // Use default TLS settings (no cert verification needed for TiDB Cloud public endpoint)
    }
  } catch (err) {
    console.error('✗ Failed to parse DATABASE_URL:', err.message);
    process.exit(1);
  }
} else {
  // Fall back to individual environment variables (for local development)
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hvktcnan_schedule',
  };
}

// Create connection pool with pool-specific configuration
const pool = mysql.createPool({
  ...dbConfig,
  // Keep DATE/DATETIME values as strings to avoid timezone day-shift in API JSON.
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
});

// Test connection
pool.getConnection()
  .then((conn) => {
    console.log('✓ MySQL database connected successfully!');
    console.log(`  Host: ${dbConfig.host}:${dbConfig.port}, Database: ${dbConfig.database}`);
    conn.release();
  })
  .catch((err) => {
    console.error('✗ MySQL database connection failed:', err.message);
    console.error(`  Attempted connection to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    process.exit(1);
  });

export default pool;
