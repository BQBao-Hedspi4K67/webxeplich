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

// Create officer (admin only)
router.post('/', requireRole('admin'), officersCtrl.createOfficer);

// Update officer (admin only)
router.put('/:id', requireRole('admin'), officersCtrl.updateOfficer);

// Delete officer (admin only)
router.delete('/:id', requireRole('admin'), officersCtrl.deleteOfficer);

export default router;
