import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import questionsRoutes from './questions.routes.js';
import subjectsRoutes from './subjects.routes.js';
import revisionsRoutes from './revisions.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import settingsRoutes from './settings.routes.js';
import notificationsRoutes from './notifications.routes.js';
import assistantRoutes from './assistant.routes.js';
import whatsappRoutes from './whatsapp.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/questions', questionsRoutes);
router.use('/subjects', subjectsRoutes);
router.use('/revisions', revisionsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/assistant', assistantRoutes);
router.use('/whatsapp', whatsappRoutes);

export default router;
