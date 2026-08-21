import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  discordLogin,
  discordCallback,
  getCurrentUser,
  updateCurrentUser,
  getAddresses,
  getCheckoutDefaultsController,
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
  deleteBiometricCredentialController,
  biometricPaymentOptionsController,
  biometricPaymentVerifyController,
  biometricRegistrationOptionsController,
  biometricRegistrationVerifyController,
  biometricLoginOptionsController,
  biometricLoginVerifyController,
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
router.get('/checkout-defaults', requireAuth, getCheckoutDefaultsController);
router.post('/addresses', requireAuth, saveAddress);
router.delete('/addresses/:id', requireAuth, deleteAddress);
router.get('/cards', requireAuth, getCards);
router.post('/cards', requireAuth, saveCard);
router.delete('/cards/:id', requireAuth, deleteCard);
router.post('/logout', requireAuth, logout);
router.post('/push-subscription', requireAuth, savePushSubscriptionController);
router.post('/biometric', requireAuth, saveBiometricCredentialController);
router.delete('/biometric', requireAuth, deleteBiometricCredentialController);
router.post('/biometric/pay-options', requireAuth, biometricPaymentOptionsController);
router.post('/biometric/pay-verify', requireAuth, biometricPaymentVerifyController);
router.post('/biometric/register-options', requireAuth, biometricRegistrationOptionsController);
router.post('/biometric/register-verify', requireAuth, biometricRegistrationVerifyController);
router.post('/biometric/login-options', authLimiter, biometricLoginOptionsController);
router.post('/biometric/login-verify', authLimiter, biometricLoginVerifyController);

export default router;
