import type { Resume } from "@/types/resume";
import type { ContentStrengthReport } from "@/types/reports";
import type { ChatRequest } from "@/types/api";
import { callChatEndpoint } from "@/api/chat";
import { hasResumeContent } from "./resumeCritic";

export const contentStrengthAgent = async (
  sessionId: string,
  authToken: string,
  resume?: Resume | null,
): Promise<ContentStrengthReport> => {
  const request: ChatRequest = {
    intent: "CONTENT_STRENGTH",
    jobDescription: "",
    messageHistory: [],
  };
  if (hasResumeContent(resume)) request.resumeData = resume;

  const response = await callChatEndpoint(sessionId, authToken, request);

  try {
    if (response.payload && typeof response.payload === "object") {
      return response.payload as ContentStrengthReport;
    }
    return JSON.parse(response.content || "{}");
  } catch (error) {
    console.error("Failed to parse content strength response:", error);
    throw new Error("Invalid response from content strength agent", { cause: error });
  }
};
