import { z } from 'zod';

export const completeRevisionSchema = z.object({
  recallRating: z.enum(['easy', 'difficult', 'forgot'], {
    errorMap: () => ({ message: "Recall rating must be 'easy', 'difficult', or 'forgot'" })
  }).optional().default('easy'),
  notes: z.string().optional().default('')
});

export const rescheduleRevisionSchema = z.object({
  newDueDate: z.string({ required_error: 'newDueDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'newDueDate must be a valid date in YYYY-MM-DD format')
});

export const skipRevisionSchema = z.object({
  reason: z.string().optional().default('')
});

export const createCustomRevisionSchema = z.object({
  questionId: z.string({ required_error: 'questionId is required' }).min(1),
  milestoneDay: z.number({ required_error: 'milestoneDay is required' }).int().positive(),
  dueDate: z.string({ required_error: 'dueDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be a valid date in YYYY-MM-DD format'),
  notes: z.string().optional().default('')
});
