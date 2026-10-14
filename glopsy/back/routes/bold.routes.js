import { Router } from 'express';
import express from 'express';
import { boldStart, boldWebhook, boldStatus, boldQrStart, boldQrStatus, boldQrWebhook } from '../controllers/bold.controller.js';
import { optionalAuth } from '../middlewares/auth.js';

const router = Router();

// Confirmación de Bold: llega como application/x-www-form-urlencoded (o JSON).
router.post(
  '/bold/webhook',
  express.urlencoded({ extended: false }),
  express.json({ limit: '1mb' }),
  boldWebhook
);

// Checkout Onpage: crea la orden pendiente y entrega los parámetros de Bold.
router.post('/bold/checkout', optionalAuth, boldStart);
router.get('/bold/status/:reference', boldStatus);

// Cobro por QR Bre-B (API de Pagos en Línea).
router.post('/bold/qr/start', optionalAuth, boldQrStart);
router.get('/bold/qr/status/:reference', boldQrStatus);
router.post('/bold/qr/webhook', boldQrWebhook);

export default router;