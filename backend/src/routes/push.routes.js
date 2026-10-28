/**
 * Push Notification Routes (src/routes/push.routes.js)
 */

import { Router } from 'express';
import { pushController } from '../controllers/push.controller.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

router.get('/public-key', pushController.getPublicKey);
router.post('/subscribe', optionalAuthenticate, pushController.subscribe);
router.post('/test', optionalAuthenticate, pushController.testPush);
router.post('/unsubscribe', optionalAuthenticate, pushController.unsubscribe);

export default router;
