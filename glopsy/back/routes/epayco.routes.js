import { Router } from 'express';
import express from 'express';
import { optionalAuth } from '../middlewares/auth.js';
import { epaycoStart, epaycoConfirmation, epaycoStatus } from '../controllers/epayco.controller.js';

const router = Router();

// Confirmación de ePayco (GET o POST, query/form).
router.all(
  '/epayco/confirmation',
  express.urlencoded({ extended: false }),
  express.json({ limit: '1mb' }),
  epaycoConfirmation
);

// Inicia el checkout: crea la orden pendiente y la sesión de ePayco.
router.post('/epayco/checkout', optionalAuth, epaycoStart);
router.get('/epayco/status/:reference', epaycoStatus);

export default router;
