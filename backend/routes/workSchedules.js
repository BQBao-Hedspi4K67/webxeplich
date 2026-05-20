import express from 'express';
import * as workCtrl from '../controllers/workSchedulesController.js';
import { optionalVerifyToken, verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get work schedules (all roles can view)
router.get('/', optionalVerifyToken, workCtrl.getWorkSchedules);

// Get single schedule
router.get('/:id', optionalVerifyToken, workCtrl.getWorkScheduleById);

// Create schedule (all authenticated roles)
router.post('/', verifyToken, workCtrl.createWorkSchedule);

// Approve/reject schedule (director or explicitly granted officers)
router.put('/:id/approve', verifyToken, workCtrl.approveWorkSchedule);

// Update schedule (admin/manager only)
router.put('/:id', verifyToken, requireRole('admin', 'manager'), workCtrl.updateWorkSchedule);

// Delete schedule (admin/manager only)
router.delete('/:id', verifyToken, workCtrl.deleteWorkSchedule);

export default router;
