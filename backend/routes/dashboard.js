import express from 'express';
import * as dashboardCtrl from '../controllers/dashboardController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.get('/overview', dashboardCtrl.getOverview);

export default router;
