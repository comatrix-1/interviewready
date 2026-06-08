import type { ResumeSchema } from "./resume";
import type { ResumeCriticReport, ContentStrengthReport, AlignmentReport } from "./reports";

export enum WorkflowStatus {
  IDLE = "IDLE",
  EXTRACTING = "EXTRACTING",
  ROUTING = "ROUTING",
  CRITIQUING = "CRITIQUING",
  AWAITING_CRITIC_APPROVAL = "AWAITING_CRITIC_APPROVAL",
  ANALYZING_CONTENT = "ANALYZING_CONTENT",
  AWAITING_CONTENT_APPROVAL = "AWAITING_CONTENT_APPROVAL",
  ALIGNING_JD = "ALIGNING_JD",
  AWAITING_ALIGNMENT_APPROVAL = "AWAITING_ALIGNMENT_APPROVAL",
  INTERVIEWING = "INTERVIEWING",
  SELECTING_INTERVIEW_MODE = "SELECTING_INTERVIEW_MODE",
  DEBUG_VOICE = "DEBUG_VOICE",
  COMPLETED = "COMPLETED",
}

export type InterviewMode = "CHAT" | "VOICE";

export interface InterviewMessage {
  role: "user" | "agent";
  text: string;
}

export interface SharedState {
  currentResume: ResumeSchema | null;
  history: ResumeSchema[];
  jobDescription: string;
  status: WorkflowStatus;
  criticReport: ResumeCriticReport | null;
  contentReport: ContentStrengthReport | null;
  alignmentReport: AlignmentReport | null;
  interviewHistory: InterviewMessage[];
  interviewMode?: InterviewMode;
}
