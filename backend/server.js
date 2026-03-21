import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     HVKTCNAN Schedule Management API Server                ║
║                                                            ║
║     ✓ Server is running at: http://localhost:${PORT}
║     ✓ Environment: ${process.env.NODE_ENV || 'development'}
║     ✓ Database: ${process.env.DB_NAME}
║     ✓ API Base URL: http://localhost:${PORT}/api
║                                                            ║
║     Available endpoints:                                   ║
║     - POST   /api/auth/login                              ║
║     - GET    /api/officers                                ║
║     - GET    /api/work-schedules                          ║
║     - GET    /api/duty-schedules                          ║
║     - GET    /api/opinions                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
