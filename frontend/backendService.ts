import {
  type Resume,
  type ResumeCriticReport,
  type ContentStrengthReport,
  type AlignmentReport,
  type ChatRequest,
} from "./types";
import {
  callChatEndpoint as repoCallChatEndpoint,
  fetchCurrentResume as repoFetchCurrentResume,
} from "./api";
import { initSession } from "./api/session";
import { resumeCriticAgent as resumeCriticService } from "@/api/chat-endpoints/resumeCritic";
import { contentStrengthAgent as contentStrengthService } from "@/api/chat-endpoints/contentStrength";
import { alignmentAgent as alignmentService } from "@/api/chat-endpoints/alignment";
import { interviewCoachAgent as interviewCoachService } from "@/api/chat-endpoints/interviewCoach";
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
    const token = this.getAuthToken();
    this.sessionId = await initSession(token);
    this.initialized = true;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  formatInterviewCoachPayload(payload: unknown): string {
    return formatPayload(payload);
  }

  async callChatEndpoint(request: ChatRequest) {
    return repoCallChatEndpoint(this.sessionId, this.getAuthToken(), request);
  }

  async fetchCurrentResume(): Promise<Resume | null> {
    return repoFetchCurrentResume(this.sessionId, this.getAuthToken());
  }

  private getAuthToken(): string {
    return localStorage.getItem("authToken") || "";
  }

  async resumeCriticAgent(resume: Resume): Promise<ResumeCriticReport> {
    return resumeCriticService(this.sessionId, this.getAuthToken(), resume);
  }

  async contentStrengthAgent(resume?: Resume | null): Promise<ContentStrengthReport> {
    return contentStrengthService(this.sessionId, this.getAuthToken(), resume);
  }

  async alignmentAgent(resume: Resume | null | undefined, jd: string): Promise<AlignmentReport> {
    return alignmentService(this.sessionId, this.getAuthToken(), resume, jd);
  }

  async interviewCoachAgent(
    resume: Resume | null | undefined,
    jobDescription: string,
    history: { role: "user" | "agent"; text: string }[],
  ): Promise<string> {
    return interviewCoachService(
      this.sessionId,
      this.getAuthToken(),
      resume,
      jobDescription,
      history,
    );
  }
}

export const backendService = new BackendService();

export const resumeCriticAgent = (resume: Resume) => backendService.resumeCriticAgent(resume);
export const contentStrengthAgent = (resume?: Resume | null) =>
  backendService.contentStrengthAgent(resume);
export const alignmentAgent = (resume: Resume | null | undefined, jd: string) =>
  backendService.alignmentAgent(resume, jd);
export const interviewCoachAgent = (
  resume: Resume | null | undefined,
  jobDescription: string,
  history: { role: "user" | "agent"; text: string }[],
) => backendService.interviewCoachAgent(resume, jobDescription, history);

export { formatInterviewCoachPayload } from "./utils/parseUtils";
