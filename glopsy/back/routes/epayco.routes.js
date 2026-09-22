import { Router } from 'express';
import express from 'express';
import { epaycoStart, epaycoWebhook, epaycoStatus } from '../controllers/epayco.controller.js';
import { optionalAuth } from '../middlewares/auth.js';

const router = Router();

// Confirmación de ePayco: llega como application/x-www-form-urlencoded.
router.post(
  '/epayco/webhook',
  express.urlencoded({ extended: false }),
  express.json({ limit: '1mb' }),
  epaycoWebhook
);

// Checkout Onpage: crea la orden pendiente y entrega los parámetros de ePayco.
router.post('/epayco/checkout', optionalAuth, epaycoStart);
router.get('/epayco/status/:reference', epaycoStatus);

export default router;
