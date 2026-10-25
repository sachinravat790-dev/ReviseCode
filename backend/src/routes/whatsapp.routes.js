import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller.js';

const router = Router();

router.get('/status', whatsappController.getStatus);
router.post('/test', whatsappController.sendTestMessage);
router.post('/dispatch', whatsappController.dispatchReminders);
router.get('/logs', whatsappController.getLogs);

export default router;
