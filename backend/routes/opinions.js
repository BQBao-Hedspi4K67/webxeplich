import express from 'express';
import * as opinionsCtrl from '../controllers/opinionsController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get opinions (all roles can view)
router.get('/', opinionsCtrl.getOpinions);

// Get single opinion
router.get('/:id', opinionsCtrl.getOpinionById);

// Create opinion (officers on duty)
router.post('/', opinionsCtrl.createOpinion);

// Update opinion status (admin only)
router.put('/:id', requireRole('admin'), opinionsCtrl.updateOpinionStatus);

// Delete opinion (admin only)
router.delete('/:id', requireRole('admin'), opinionsCtrl.deleteOpinion);

export default router;
