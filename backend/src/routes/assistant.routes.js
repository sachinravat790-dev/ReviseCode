import { Router } from 'express';
import { assistantController } from '../controllers/assistant.controller.js';

const router = Router();

router.get('/capabilities', assistantController.getCapabilities);
router.get('/status', assistantController.getStatus);
router.post('/test', assistantController.testConnection);
router.post('/configure', assistantController.configureKey);
router.delete('/configure', (req, res, next) => {
  req.body = { apiKey: '', persist: true };
  assistantController.configureKey(req, res, next);
});
router.post('/command', assistantController.executeCommand);
router.post('/chat', assistantController.handleChat);

export default router;
