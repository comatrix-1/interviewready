import type { Resume } from "@/types/resume";
import type { AlignmentReport } from "@/types/reports";
import type { ChatRequest } from "@/types/api";
import { callChatEndpoint } from "@/api/chat";
import { isRecord, asStringArray } from "@/utils/parseUtils";
import { hasResumeContent } from "./resumeCritic";

export const alignmentAgent = async (
  sessionId: string,
  authToken: string,
  resume: Resume | null | undefined,
  jd: string,
): Promise<AlignmentReport> => {
  const request: ChatRequest = {
    intent: "ALIGNMENT",
    jobDescription: jd,
    messageHistory: [],
  };
  if (hasResumeContent(resume)) request.resumeData = resume;

  const response = await callChatEndpoint(sessionId, authToken, request);

  try {
    let data: unknown = response.payload;
    if (!isRecord(data)) {
      data = JSON.parse(response.content || "{}");
    }
    const parsed = isRecord(data) ? data : {};
    return {
      skillsMatch: asStringArray(parsed.skillsMatch),
      missingSkills: asStringArray(parsed.missingSkills),
      experienceMatch: asStringArray(parsed.experienceMatch),
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch (error) {
    console.error("Failed to parse alignment response:", error);
    throw new Error("Invalid response from alignment agent", { cause: error });
  }
};
