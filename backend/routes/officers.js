import express from 'express';
import * as officersCtrl from '../controllers/officersController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get officers (all roles can view)
router.get('/', officersCtrl.getOfficers);

// Get single officer
router.get('/:id', officersCtrl.getOfficerById);

// Create officer (admin, manager)
router.post('/', requireRole('admin', 'manager'), officersCtrl.createOfficer);

// Update officer (admin, manager)
router.put('/:id', requireRole('admin', 'manager'), officersCtrl.updateOfficer);

// Delete officer (admin, manager)
router.delete('/:id', requireRole('admin', 'manager'), officersCtrl.deleteOfficer);

export default router;
