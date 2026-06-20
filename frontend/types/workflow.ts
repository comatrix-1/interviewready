import type { ResumeSchema } from "./resume";
import type { ATSReport, ResumeCriticIssue, AlignmentReport } from "./reports";

export enum WorkflowStatus {
  IDLE = "IDLE",
  EXTRACTING = "EXTRACTING",
  ROUTING = "ROUTING",
  ATS_CHECKING = "ATS_CHECKING",
  AWAITING_ATS_APPROVAL = "AWAITING_ATS_APPROVAL",
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
  atsReport: ATSReport | null;
  criticIssues: ResumeCriticIssue[];
  alignmentReport: AlignmentReport | null;
  interviewHistory: InterviewMessage[];
  interviewMode?: InterviewMode;
}
