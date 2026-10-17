import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.js';
import { glopsyPayStart, glopsyPayWebhook, glopsyPayStatus } from '../controllers/glopsyPay.controller.js';

const router = Router();

// Confirmación de Glopsy Pay: POST JSON firmado (X-Glopsy-Signature).
router.post('/glopsypay/webhook', glopsyPayWebhook);

// Inicia el checkout: crea la orden pendiente y devuelve la URL del cobro.
router.post('/glopsypay/checkout', optionalAuth, glopsyPayStart);
router.get('/glopsypay/status/:reference', glopsyPayStatus);

export default router;
