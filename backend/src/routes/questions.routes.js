import { Router } from 'express';
import { questionsController } from '../controllers/questions.controller.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  queryQuestionsSchema
} from '../schemas/question.schema.js';

const router = Router();

router.get('/', validateQuery(queryQuestionsSchema), questionsController.getAllQuestions);
router.get('/:id', questionsController.getQuestionById);
router.post('/', validateBody(createQuestionSchema), questionsController.createQuestion);
router.put('/:id', validateBody(updateQuestionSchema), questionsController.updateQuestion);
router.patch('/:id/bookmark', questionsController.toggleBookmark);
router.delete('/:id', questionsController.deleteQuestion);

export default router;
