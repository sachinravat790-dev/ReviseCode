import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', notificationsController.getNotifications);
router.patch('/:id/read', notificationsController.markAsRead);

export default router;
