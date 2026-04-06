import express from 'express';
import * as leaveRequestsCtrl from '../controllers/leaveRequestsController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', leaveRequestsCtrl.getLeaveRequests);
router.get('/:id', leaveRequestsCtrl.getLeaveRequestById);
router.post('/', leaveRequestsCtrl.createLeaveRequest);
router.put('/:id', requireRole('admin', 'manager'), leaveRequestsCtrl.updateLeaveRequestStatus);
router.delete('/:id', requireRole('admin'), leaveRequestsCtrl.deleteLeaveRequest);

export default router;
