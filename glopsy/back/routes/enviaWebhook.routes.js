import { Router } from 'express';
import { enviaWebhookController } from '../controllers/enviaWebhook.controller.js';

const router = Router();

router.post('/envia', enviaWebhookController);

export default router;
