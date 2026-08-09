import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  discordLogin,
  discordCallback,
  getCurrentUser,
  logout,
} from '../controllers/auth.controller.js';
import { authLimiter } from '../middlewares/limiters.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Rutas de Google OAuth
router.get('/google', authLimiter, googleLogin);
router.get('/google/callback', authLimiter, googleCallback);

// Rutas de Discord OAuth
router.get('/discord', authLimiter, discordLogin);
router.get('/discord/callback', authLimiter, discordCallback);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logout);

export default router;
