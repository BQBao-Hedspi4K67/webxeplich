import express from 'express';
import * as workCtrl from '../controllers/workSchedulesController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get work schedules (all roles can view)
router.get('/', workCtrl.getWorkSchedules);

// Get single schedule
router.get('/:id', workCtrl.getWorkScheduleById);

// Create schedule (all authenticated roles)
router.post('/', workCtrl.createWorkSchedule);

// Approve/reject schedule (admin/ban giam doc)
router.put('/:id/approve', requireRole('admin'), workCtrl.approveWorkSchedule);

// Update schedule (admin/manager only)
router.put('/:id', requireRole('admin', 'manager'), workCtrl.updateWorkSchedule);

// Delete schedule (admin/manager only)
router.delete('/:id', requireRole('admin', 'manager'), workCtrl.deleteWorkSchedule);

export default router;
