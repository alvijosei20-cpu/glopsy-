import { Router } from 'express';
import { mastershopWebhookController } from '../controllers/mastershopWebhook.controller.js';

const router = Router();

router.post('/mastershop', mastershopWebhookController);

export default router;
