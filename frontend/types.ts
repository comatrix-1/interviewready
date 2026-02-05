
export interface Experience {
  company: string;
  role: string;
  duration: string;
  bullets: string[];
}

export interface ResumeSchema {
  id: string;
  name: string;
  email: string;
  summary: string;
  skills: string[]; // Original raw skills list
  taggedSkills: string[]; // Refined key skills tags
  yearsOfExperience: number; // Quantitative years of experience
  experience: Experience[];
  timestamp: number;
}

export interface GapReport {
  overallScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  experienceGaps: string[];
  impactScore: Record<string, number>; // Mock SHAP values
}

export interface OptimizationSuggestion {
  id: string;
  originalBullet: string;
  suggestedBullet: string;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
}

export enum PipelineStep {
  IDLE = 'IDLE',
  EXTRACTING = 'EXTRACTING',
  ROUTING = 'ROUTING',
  SCORING = 'SCORING',
  AWAITING_ANALYSIS_CONFIRMATION = 'AWAITING_ANALYSIS_CONFIRMATION',
  OPTIMIZING = 'OPTIMIZING',
  AWAITING_EDIT_REVIEW = 'AWAITING_EDIT_REVIEW',
  INTERVIEWING = 'INTERVIEWING',
  COMPLETED = 'COMPLETED'
}

export interface InterviewMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface AppState {
  resumes: ResumeSchema[];
  selectedResumeId: string | null;
  currentJD: string;
  currentStep: PipelineStep;
  gapReport: GapReport | null;
  suggestions: OptimizationSuggestion[];
  interviewHistory: InterviewMessage[];
  isStale: boolean;
}
