import { Router } from 'express';
import { mercadopagoWebhookController } from '../controllers/mercadopagoWebhook.controller.js';

const router = Router();

router.post('/mercadopago/webhook', mercadopagoWebhookController);

export default router;
