import { Router } from 'express';
import { revisionsController } from '../controllers/revisions.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  completeRevisionSchema,
  rescheduleRevisionSchema,
  skipRevisionSchema,
  createCustomRevisionSchema
} from '../schemas/revision.schema.js';

const router = Router();

router.use(authenticate);

// Filtered lists (declared before parameterized :id route)
router.get('/', revisionsController.getAllRevisions);
router.get('/today', revisionsController.getTodayRevisions);
router.get('/upcoming', revisionsController.getUpcomingRevisions);
router.get('/overdue', revisionsController.getOverdueRevisions);
router.get('/completed', revisionsController.getCompletedRevisions);

// Custom milestone creation
router.post('/custom', validateBody(createCustomRevisionSchema), revisionsController.createCustomRevision);

// Specific revision actions
router.get('/:id', revisionsController.getRevisionById);
router.post('/:id/complete', validateBody(completeRevisionSchema), revisionsController.completeRevision);
router.post('/:id/reschedule', validateBody(rescheduleRevisionSchema), revisionsController.rescheduleRevision);
router.post('/:id/skip', validateBody(skipRevisionSchema), revisionsController.skipRevision);

export default router;
