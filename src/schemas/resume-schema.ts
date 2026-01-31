import { z } from 'zod';

// Experience entry schema
export const ExperienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  role: z.string().min(1, 'Role is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}$/, 'Start date must be in YYYY-MM format'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'End date must be in YYYY-MM format')
    .or(z.literal('present')),
  bullets: z.array(z.string().min(1, 'Bullet point cannot be empty')),
});

// Resume schema based on ARCHITECTURE.md specification
export const ResumeSchema = z.object({
  summary: z.string().min(1, 'Summary is required'),
  experience: z.array(ExperienceSchema).min(1, 'At least one experience entry is required'),
  skills: z.array(z.string().min(1, 'Skill cannot be empty')),
  education: z.array(z.string().min(1, 'Education entry cannot be empty')),
  certifications: z.array(z.string().min(1, 'Certification cannot be empty')),
});

// Type inference
export type ResumeType = z.infer<typeof ResumeSchema>;
export type ExperienceType = z.infer<typeof ExperienceSchema>;
