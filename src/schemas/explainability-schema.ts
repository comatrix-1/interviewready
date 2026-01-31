import { z } from 'zod';

// Contributor schema
export const ContributorSchema = z.object({
  feature: z.string(),
  impact: z.number(),
});

// Counterfactual schema
export const CounterfactualSchema = z.object({
  change: z.string(),
  expected_gain: z.number(),
});

// Section contributions schema
export const SectionContributionsSchema = z.object({
  summary: z.number(),
  experience: z.number(),
  skills: z.number(),
});

// Explainability result schema based on ARCHITECTURE.md specification
export const ExplainabilityResultSchema = z.object({
  positive_contributors: z.array(ContributorSchema),
  negative_contributors: z.array(ContributorSchema),
  section_contributions: SectionContributionsSchema,
  counterfactuals: z.array(CounterfactualSchema),
});

// Type inference
export type ExplainabilityResultType = z.infer<typeof ExplainabilityResultSchema>;
export type ContributorType = z.infer<typeof ContributorSchema>;
export type CounterfactualType = z.infer<typeof CounterfactualSchema>;
export type SectionContributionsType = z.infer<typeof SectionContributionsSchema>;
