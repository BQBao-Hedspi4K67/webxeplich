import express from 'express';
import * as opinionsCtrl from '../controllers/opinionsController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', opinionsCtrl.getOpinions);
router.get('/:id', opinionsCtrl.getOpinionById);
router.post('/', opinionsCtrl.createOpinion);
router.put('/:id', requireRole('admin', 'manager'), opinionsCtrl.updateOpinionStatus);
router.delete('/:id', requireRole('admin'), opinionsCtrl.deleteOpinion);

export default router;
