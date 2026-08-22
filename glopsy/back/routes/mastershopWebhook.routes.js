import { Router } from 'express';
import { mastershopWebhookController } from '../controllers/mastershopWebhook.controller.js';
import { reverseLogisticsWebhook } from '../controllers/returns.controller.js';

const router = Router();

router.post('/mastershop', mastershopWebhookController);
router.post('/mastershop/reverse-logistics', reverseLogisticsWebhook);

export default router;
