import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import * as departmentsCtrl from '../controllers/departmentsController.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', departmentsCtrl.getDepartments);
router.post('/', requireRole('admin'), departmentsCtrl.createDepartment);
router.put('/:id', requireRole('admin'), departmentsCtrl.updateDepartment);
router.delete('/:id', requireRole('admin'), departmentsCtrl.deleteDepartment);

export default router;
