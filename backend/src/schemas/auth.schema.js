import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name cannot be empty').max(100).optional(),
  name: z.string().trim().min(1, 'Full name cannot be empty').max(100).optional(),
  email: z.string({ required_error: 'Email is required' }).trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters long')
}).refine(data => Boolean(data.fullName || data.name), {
  message: 'Full name is required',
  path: ['fullName']
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password cannot be empty')
});
