import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import officersRoutes from './routes/officers.js';
import workSchedulesRoutes from './routes/workSchedules.js';
import dutySchedulesRoutes from './routes/dutySchedules.js';
import opinionsRoutes from './routes/opinions.js';
import leaveRequestsRoutes from './routes/leaveRequests.js';
import holidaysRoutes from './routes/holidays.js';
import departmentsRoutes from './routes/departments.js';
import notificationsRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import exportsRoutes from './routes/exports.js';

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  // Allow non-browser requests (curl/postman) with no origin header.
  if (!origin) return callback(null, true);

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS configuration: allow all origins
app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  })
);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/officers', officersRoutes);
app.use('/api/work-schedules', workSchedulesRoutes);
app.use('/api/duty-schedules', dutySchedulesRoutes);
app.use('/api/leave-requests', leaveRequestsRoutes);
app.use('/api/opinions', opinionsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exports', exportsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
