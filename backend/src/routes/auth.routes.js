import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/exchange-token', authController.exchangeToken);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/logout', authController.logout);
router.get('/oauth-url/:provider', authController.getOAuthUrl);

export default router;
