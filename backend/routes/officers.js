import express from 'express';
import * as officersCtrl from '../controllers/officersController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get officers (all roles can view)
router.get('/', officersCtrl.getOfficers);

// Get delegation list for current delegator (admin/manager/delegated admin manager)
router.get('/admin-delegations', officersCtrl.getAdminDelegations);

// Get single officer
router.get('/:id', officersCtrl.getOfficerById);

// Create officer (superadmin only)
router.post('/', requireRole('superadmin'), officersCtrl.createOfficer);

// Update officer (superadmin only)
router.put('/:id', requireRole('superadmin'), officersCtrl.updateOfficer);

// Grant/revoke duty schedule management permission
router.put('/:id/duty-schedule-permission', officersCtrl.updateDutySchedulePermission);

// Grant/revoke work schedule create/approve permissions
router.put('/:id/work-schedule-permission', officersCtrl.updateWorkSchedulePermission);

// Update delegation (admin/manager/delegated admin manager via controller checks)
router.put('/:id/admin-delegation', officersCtrl.updateAdminDelegation);

// Delete officer (superadmin only)
router.delete('/:id', requireRole('superadmin'), officersCtrl.deleteOfficer);

export default router;
