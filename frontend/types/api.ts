import type { ResumeSchema } from "./resume";
import type { InterviewMessage } from "./workflow";

export interface ResumeFile {
  data: string;
  fileType: "pdf";
}

export interface ChatRequest {
  intent: "RESUME_CRITIC" | "CONTENT_STRENGTH" | "ALIGNMENT" | "INTERVIEW_COACH";
  resumeData?: ResumeSchema | null;
  jobDescription: string;
  messageHistory: InterviewMessage[];
  resumeFile?: ResumeFile;
  audioData?: Uint8Array | null;
}

export interface ChatResponse {
  agent?: string;
  payload?: unknown;
  agent_name?: string;
  content?: string;
  reasoning?: string;
  confidence_score?: number;
  transcription?: string;
  metadata?: {
    needs_review?: boolean;
    review_required?: boolean;
  };
  decision_trace?: string[];
  sharp_metadata?: Record<string, unknown>;
}

export interface InterviewCoachPayload {
  current_question_number?: number;
  total_questions?: number;
  interview_type?: string;
  question?: string;
  keywords?: string[];
  tip?: string;
  feedback?: string;
  answer_score?: number;
  can_proceed?: boolean;
  next_challenge?: string;
  interview_complete?: boolean;
  summary?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  overall_rating?: string;
  recommendations?: string[];
  final_feedback?: string;
}
