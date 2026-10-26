import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

export default router;
