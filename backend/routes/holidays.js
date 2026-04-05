import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import * as holidaysCtrl from '../controllers/holidaysController.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', holidaysCtrl.getHolidays);
router.post('/', requireRole('admin'), holidaysCtrl.createHoliday);
router.put('/:id', requireRole('admin'), holidaysCtrl.updateHoliday);
router.delete('/:id', requireRole('admin'), holidaysCtrl.deleteHoliday);

export default router;
