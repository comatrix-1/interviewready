import { z } from 'zod';

// Seniority level enum
export const SeniorityEnum = z.enum(['junior', 'mid', 'senior', 'lead']);

// Job description schema based on ARCHITECTURE.md specification
export const JobDescriptionSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  required_skills: z.array(z.string().min(1, 'Required skill cannot be empty')),
  preferred_skills: z.array(z.string().min(1, 'Preferred skill cannot be empty')),
  seniority: SeniorityEnum,
  responsibilities: z.array(z.string().min(1, 'Responsibility cannot be empty')),
  keywords: z.array(z.string().min(1, 'Keyword cannot be empty')),
});

// Type inference
export type JobDescriptionType = z.infer<typeof JobDescriptionSchema>;
export type SeniorityType = z.infer<typeof SeniorityEnum>;
