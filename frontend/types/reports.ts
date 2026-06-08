export type EvidenceStrength = "HIGH" | "MEDIUM" | "LOW";
export type ResumeCriticIssueType = "ats" | "structure" | "impact" | "readability";
export type ResumeCriticSeverity = "HIGH" | "MEDIUM" | "LOW";
export type ContentSuggestionType = "action_verb" | "specificity" | "structure" | "redundancy";

export interface ResumeCriticIssue {
  location: string;
  type: ResumeCriticIssueType;
  severity: ResumeCriticSeverity;
  description: string;
}

export interface ResumeCriticReport {
  issues: ResumeCriticIssue[];
  summary: string;
  score?: number;
}

export interface ContentSuggestion {
  location: string;
  original: string;
  suggested: string;
  evidenceStrength: EvidenceStrength;
  type: ContentSuggestionType;
}

export interface ContentStrengthReport {
  suggestions: ContentSuggestion[];
  summary: string;
  score?: number;
}

export interface AlignmentReport {
  skillsMatch: string[];
  missingSkills: string[];
  experienceMatch: string[];
  summary: string;
}

export type ResumeLookupResult = {
  isValid: boolean;
  display?: string;
  topLevel?: string;
  usedSectionAsEvidence?: boolean;
};
