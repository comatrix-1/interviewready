
export interface Experience {
  company: string;
  role: string;
  duration: string;
  achievements: string[];
}

export interface Education {
  institution: string;
  degree: string;
  year: string;
}

export interface ResumeSchema {
  id: string;
  name: string;
  email: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  timestamp: string;
}

export interface StructuralAssessment {
  score: number;
  readability: string;
  formattingRecommendations: string[];
  suggestions: string[];
}

export interface ContentAnalysisReport {
  strengths: string[];
  gaps: string[];
  skillImprovements: string[];
  quantifiedImpactScore: number;
}

export interface AlignmentReport {
  overallScore: number;
  matchingKeywords: string[];
  missingKeywords: string[];
  roleFitAnalysis: string;
}

export enum WorkflowStatus {
  IDLE = 'IDLE',
  EXTRACTING = 'EXTRACTING',
  ROUTING = 'ROUTING',
  CRITIQUING = 'CRITIQUING',
  AWAITING_CRITIC_APPROVAL = 'AWAITING_CRITIC_APPROVAL',
  ANALYZING_CONTENT = 'ANALYZING_CONTENT',
  AWAITING_CONTENT_APPROVAL = 'AWAITING_CONTENT_APPROVAL',
  ALIGNING_JD = 'ALIGNING_JD',
  AWAITING_ALIGNMENT_APPROVAL = 'AWAITING_ALIGNMENT_APPROVAL',
  INTERVIEWING = 'INTERVIEWING',
  COMPLETED = 'COMPLETED'
}

export interface SharedState {
  currentResume: ResumeSchema | null;
  history: ResumeSchema[];
  jobDescription: string;
  status: WorkflowStatus;
  criticReport: StructuralAssessment | null;
  contentReport: ContentAnalysisReport | null;
  alignmentReport: AlignmentReport | null;
  interviewHistory: { role: 'user' | 'agent'; text: string }[];
}
