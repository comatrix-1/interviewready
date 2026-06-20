export type ResumeCriticIssueType = "ats" | "structure" | "impact" | "readability";
export type ResumeCriticSeverity = "HIGH" | "MEDIUM" | "LOW";

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

// --- ATS Report Types ---

export type ATSPassStatus = "ok" | "no" | "min";

export interface ATSCheck {
  pass: ATSPassStatus;
  bullet_to_highlight: number[] | null;
  message: string | null;
  suggestions: string[] | null;
}

export interface ATSSection {
  section: string;
  checks: Record<string, ATSCheck>;
}

export interface ATSScoreBreakdown {
  section_presence: number;
  bullet_quality: number;
  jd_keyword_match: number;
  semantic_match: number;
  bonuses: number;
  penalties: number;
  raw_score: number;
  max_possible: number;
}

export interface ATSReport {
  ats_score: number;
  sections: ATSSection[];
  score_breakdown: ATSScoreBreakdown | null;
  keyword_match: {
    match_percentage: number;
    matched_keywords: string[];
    missing_keywords: string[];
  } | null;
  validation_warnings: string[];
}
