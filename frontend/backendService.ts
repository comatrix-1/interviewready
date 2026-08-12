import {
  type Resume,
  type ResumeCriticReport,
  type ResumeCriticIssue,
  type AlignmentReport,
  type ChatRequest,
  type ATSReport,
} from "./types";
import { callChatEndpoint as repoCallChatEndpoint } from "./api";
import { initSession } from "./api/session";
import {
  alignmentAgent as alignmentService,
  resumeCriticAgent as resumeCriticService,
} from "./api/analysis";
import { interviewCoachAgent as interviewCoachService } from "@/api/chat-endpoints/interviewCoach";
import { atsEngineAnalyze as atsEngineAnalyzeFn } from "./api/ats";
import { formatInterviewCoachPayload as formatPayload } from "./utils/parseUtils";

export interface ExtractorFileData {
  data: string;
  mimeType: string;
}

class BackendService {
  private sessionId: string = "";
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.sessionId = await initSession();
    this.initialized = true;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  formatInterviewCoachPayload(payload: unknown): string {
    return formatPayload(payload);
  }

  async callChatEndpoint(request: ChatRequest) {
    return repoCallChatEndpoint(this.sessionId, request);
  }

  async resumeCriticAgent(resume: Resume): Promise<ResumeCriticReport> {
    return resumeCriticService(resume);
  }

  async atsEngineAnalyze(resume: Resume, criticIssues?: ResumeCriticIssue[]): Promise<ATSReport> {
    return atsEngineAnalyzeFn(resume, criticIssues);
  }

  async alignmentAgent(resume: Resume | null | undefined, jd: string): Promise<AlignmentReport> {
    return alignmentService(resume, jd);
  }

  async interviewCoachAgent(
    resume: Resume | null | undefined,
    jobDescription: string,
    history: { role: "user" | "agent"; text: string }[],
  ): Promise<string> {
    return interviewCoachService(this.sessionId, resume, jobDescription, history);
  }
}

export const backendService = new BackendService();

export const resumeCriticAgent = (resume: Resume) => backendService.resumeCriticAgent(resume);
export const atsEngineAnalyzeService = (resume: Resume, criticIssues?: ResumeCriticIssue[]) =>
  backendService.atsEngineAnalyze(resume, criticIssues);
export const alignmentAgent = (resume: Resume | null | undefined, jd: string) =>
  backendService.alignmentAgent(resume, jd);
export const interviewCoachAgent = (
  resume: Resume | null | undefined,
  jobDescription: string,
  history: { role: "user" | "agent"; text: string }[],
) => backendService.interviewCoachAgent(resume, jobDescription, history);

export { formatInterviewCoachPayload } from "./utils/parseUtils";
