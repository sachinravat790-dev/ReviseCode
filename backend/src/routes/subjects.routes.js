import { Router } from 'express';
import { subjectsController } from '../controllers/subjects.controller.js';
import { validateBody } from '../middleware/validate.js';
import { createSubjectSchema, updateSubjectSchema } from '../schemas/subject.schema.js';

const router = Router();

router.get('/', subjectsController.getAllSubjects);
router.get('/:id', subjectsController.getSubjectById);
router.post('/', validateBody(createSubjectSchema), subjectsController.createSubject);
router.put('/:id', validateBody(updateSubjectSchema), subjectsController.updateSubject);
router.delete('/:id', subjectsController.deleteSubject);

export default router;
