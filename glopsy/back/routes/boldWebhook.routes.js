import { Router } from 'express';
import { boldWebhookController } from '../controllers/boldWebhook.controller.js';
import {
  boldStart,
  boldIntent,
  boldPay,
  boldStatus,
  boldRefund,
  boldBanks,
} from '../controllers/boldCheckout.controller.js';
import { optionalAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/bold/webhook', boldWebhookController);

// Checkout transparente (la tarjeta se captura en la web de glopsy).
router.post('/bold/checkout', optionalAuth, boldStart);
router.post('/bold/intent', boldIntent);
router.post('/bold/pay', boldPay);
router.get('/bold/status/:reference', boldStatus);
router.post('/bold/refund/:reference', boldRefund);
router.get('/bold/pse/banks', boldBanks);

export default router;
