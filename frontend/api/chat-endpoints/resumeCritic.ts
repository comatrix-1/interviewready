import type { Resume } from "@/types/resume";
import type { ResumeCriticReport } from "@/types/reports";
import type { ChatRequest } from "@/types/api";
import { callChatEndpoint } from "@/api/chat";

const hasResumeContent = (resume?: Resume | null): boolean => {
  if (!resume) return false;
  return Object.values(resume).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
};

export const resumeCriticAgent = async (
  sessionId: string,
  authToken: string,
  resume: Resume,
): Promise<ResumeCriticReport> => {
  const request: ChatRequest = {
    intent: "RESUME_CRITIC",
    resumeData: resume,
    jobDescription: "",
    messageHistory: [],
  };

  const response = await callChatEndpoint(sessionId, authToken, request);

  try {
    if (response.payload && typeof response.payload === "object") {
      return response.payload as ResumeCriticReport;
    }
    return JSON.parse(response.content || "{}");
  } catch (error) {
    console.error("Failed to parse resume critic response:", error);
    throw new Error("Invalid response from resume critic agent", { cause: error });
  }
};

export { hasResumeContent };
