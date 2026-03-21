import express from 'express';
import * as exportsCtrl from '../controllers/exportsController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/preview', exportsCtrl.getExportPreview);
router.get('/download', exportsCtrl.downloadExport);
router.get('/history', exportsCtrl.getExportHistory);

export default router;
