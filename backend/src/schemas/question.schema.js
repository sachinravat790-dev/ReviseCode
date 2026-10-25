import { z } from 'zod';

export const createQuestionSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title cannot be empty').max(300),
  platform: z.string({ required_error: 'Platform is required' }).trim().min(1, 'Platform cannot be empty'),
  problemNumber: z.union([z.string(), z.number()]).optional().transform(v => v !== undefined && v !== null ? String(v).trim() : ''),
  problemUrl: z.string().trim().url('Must be a valid URL').or(z.literal('')).optional().default(''),
  subjectId: z.string().trim().optional(),
  subject: z.string().trim().optional(), // allow subject name or id for flexibility with frontend
  topic: z.string().trim().optional().default('General'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'], {
    errorMap: () => ({ message: 'Difficulty must be Easy, Medium, or Hard' })
  }).default('Medium'),
  dateSolved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date solved must be in YYYY-MM-DD format').optional(),
  description: z.string().optional().default(''),
  summary: z.string().optional(), // alias used by frontend
  approach: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  code: z.string().optional().default(''),
  codeSolution: z.string().optional(), // alias used by frontend
  programmingLanguage: z.string().optional().default('javascript'),
  codeLanguage: z.string().optional(), // alias used by frontend
  timeComplexity: z.string().optional().default('O(n)'),
  spaceComplexity: z.string().optional().default('O(1)'),
  tags: z.union([z.array(z.string()), z.string()]).optional().transform(v => {
    if (Array.isArray(v)) return v.map(t => String(t).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return v.split(',').map(t => t.trim()).filter(Boolean);
    return [];
  }),
  bookmarked: z.boolean().optional().default(false),
  isBookmarked: z.boolean().optional(),
  attachments: z.array(z.any()).optional().default([])
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const queryQuestionsSchema = z.object({
  search: z.string().optional(),
  subject: z.string().optional(),
  subjectId: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.string().optional(),
  platform: z.string().optional(),
  bookmarked: z.union([z.string(), z.boolean()]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50)
});
