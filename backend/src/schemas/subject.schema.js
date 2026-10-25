import { z } from 'zod';

export const createSubjectSchema = z.object({
  name: z.string({ required_error: 'Subject name is required' }).trim().min(1, 'Name cannot be empty').max(100),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#7c3aed'),
  icon: z.string().optional().default('folder'),
  topics: z.union([z.array(z.string()), z.string()]).optional().transform(v => {
    if (Array.isArray(v)) return v.map(t => String(t).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return v.split(',').map(t => t.trim()).filter(Boolean);
    return [];
  })
});

export const updateSubjectSchema = createSubjectSchema.partial();
