import express from 'express';
import * as notificationsCtrl from '../controllers/notificationsController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', notificationsCtrl.getNotifications);
router.patch('/:id/read', notificationsCtrl.markNotificationAsRead);
router.post('/mark-all-read', notificationsCtrl.markAllNotificationsAsRead);

export default router;
