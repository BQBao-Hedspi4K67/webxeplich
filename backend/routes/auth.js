import express from 'express';
import * as authCtrl from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', authCtrl.login);
router.post('/logout', authCtrl.logout);

// Protected routes
router.get('/profile', verifyToken, authCtrl.getProfile);
router.put('/profile/contact', verifyToken, authCtrl.updateMyContact);
router.post('/users', verifyToken, requireRole('admin', 'manager'), authCtrl.createUserAccount);

export default router;
