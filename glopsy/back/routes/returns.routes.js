import { Router } from 'express';
import {
  requestReturn,
  getReturnByOrder,
  listReturns,
} from '../controllers/returns.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';

const router = Router();

// Listado de devoluciones del usuario autenticado
router.get('/', requireAuth, listReturns);

// Solicitud de devolución (usuario autenticado o invitado)
router.post('/', optionalAuth, requestReturn);

// Consultar estado de devolución por orden
router.get('/:orderId', getReturnByOrder);

export default router;
