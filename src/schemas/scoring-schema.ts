import { z } from 'zod';

// Feature vector schema
export const FeatureVectorSchema = z.record(z.string(), z.number());

// Scoring result schema based on ARCHITECTURE.md specification
export const ScoringResultSchema = z.object({
  overall_fit: z.number().min(0).max(100),
  skill_coverage: z.number().min(0).max(100),
  seniority_alignment: z.number().min(0).max(100),
  keyword_alignment: z.number().min(0).max(100),
  feature_vector: FeatureVectorSchema,
});

// Type inference
export type ScoringResultType = z.infer<typeof ScoringResultSchema>;
export type FeatureVectorType = z.infer<typeof FeatureVectorSchema>;
