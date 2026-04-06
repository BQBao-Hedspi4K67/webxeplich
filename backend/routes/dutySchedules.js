import express from 'express';
import * as dutyCtrl from '../controllers/dutySchedulesController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get duty schedules (all roles can view)
router.get('/', dutyCtrl.getDutySchedules);

// Get single schedule
router.get('/:id', dutyCtrl.getDutyScheduleById);

// Create schedule (admin/manager only)
router.post('/', requireRole('admin', 'manager'), dutyCtrl.createDutySchedule);

// Auto assign officer daily duty for selected week (admin only)
router.post('/auto-assign-week', requireRole('admin'), dutyCtrl.autoAssignOfficerDailyWeek);

// Auto assign holiday duty (admin only)
router.post('/auto-assign-holiday', requireRole('admin'), dutyCtrl.autoAssignHolidayDuty);

// Update schedule (admin/manager only)
router.put('/:id', requireRole('admin', 'manager'), dutyCtrl.updateDutySchedule);

// Delete schedule (admin/manager only)
router.delete('/:id', requireRole('admin', 'manager'), dutyCtrl.deleteDutySchedule);

export default router;
