import express from 'express';
import * as exportsCtrl from '../controllers/exportsController.js';
import { optionalVerifyToken, verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/preview', optionalVerifyToken, exportsCtrl.getExportPreview);
router.get('/download', optionalVerifyToken, exportsCtrl.downloadExport);
router.get('/history', verifyToken, exportsCtrl.getExportHistory);

export default router;
