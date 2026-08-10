import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  discordLogin,
  discordCallback,
  getCurrentUser,
  updateCurrentUser,
  getAddresses,
  saveAddress,
  deleteAddress,
  getCards,
  saveCard,
  deleteCard,
  logout,
  registerEmail,
  loginEmail,
  savePushSubscriptionController,
  saveBiometricCredentialController,
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

// Rutas de Email / Contraseña
router.post('/register', authLimiter, registerEmail);
router.post('/login', authLimiter, loginEmail);
router.get('/me', requireAuth, getCurrentUser);
router.put('/me', requireAuth, updateCurrentUser);
router.get('/addresses', requireAuth, getAddresses);
router.post('/addresses', requireAuth, saveAddress);
router.delete('/addresses/:id', requireAuth, deleteAddress);
router.get('/cards', requireAuth, getCards);
router.post('/cards', requireAuth, saveCard);
router.delete('/cards/:id', requireAuth, deleteCard);
router.post('/logout', requireAuth, logout);
router.post('/push-subscription', requireAuth, savePushSubscriptionController);
router.post('/biometric', requireAuth, saveBiometricCredentialController);

export default router;
