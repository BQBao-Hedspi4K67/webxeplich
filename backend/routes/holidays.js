import express from 'express';
import { optionalVerifyToken, verifyToken, requireRole } from '../middleware/auth.js';
import * as holidaysCtrl from '../controllers/holidaysController.js';

const router = express.Router();

router.get('/', optionalVerifyToken, holidaysCtrl.getHolidays);
router.post('/', verifyToken, requireRole('admin'), holidaysCtrl.createHoliday);
router.put('/:id', verifyToken, requireRole('admin'), holidaysCtrl.updateHoliday);
router.delete('/:id', verifyToken, requireRole('admin'), holidaysCtrl.deleteHoliday);

export default router;
