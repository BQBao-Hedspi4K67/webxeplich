import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hvktcnan_schedule',
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
    conn.release();
  })
  .catch((err) => {
    console.error('✗ MySQL database connection failed:', err.message);
    console.error('  Make sure XAMPP MySQL is running and .env is configured correctly.');
    process.exit(1);
  });

export default pool;
