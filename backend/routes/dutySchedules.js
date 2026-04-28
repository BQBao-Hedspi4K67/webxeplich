import express from 'express';
import * as dutyCtrl from '../controllers/dutySchedulesController.js';
import { optionalVerifyToken, verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get duty schedules (all roles can view)
router.get('/', optionalVerifyToken, dutyCtrl.getDutySchedules);

// Check if week has been auto-scheduled (MUST be before /:id)
router.get('/check-auto-scheduled', optionalVerifyToken, dutyCtrl.checkAutoScheduled);

// Get single schedule
router.get('/:id', optionalVerifyToken, dutyCtrl.getDutyScheduleById);

// Create schedule (admin/manager only)
router.post('/', verifyToken, requireRole('admin', 'manager'), dutyCtrl.createDutySchedule);

// Auto assign officer daily duty for selected week (admin only)
router.post('/auto-assign-week', verifyToken, requireRole('admin', 'manager'), dutyCtrl.autoAssignOfficerDailyWeek);

// Auto assign holiday duty (admin only)
router.post('/auto-assign-holiday', verifyToken, requireRole('admin', 'manager'), dutyCtrl.autoAssignHolidayDuty);

// Update schedule (admin/manager only)
router.put('/:id', verifyToken, requireRole('admin', 'manager'), dutyCtrl.updateDutySchedule);

// Delete schedule (admin/manager only)
router.delete('/:id', verifyToken, requireRole('admin', 'manager'), dutyCtrl.deleteDutySchedule);

export default router;
