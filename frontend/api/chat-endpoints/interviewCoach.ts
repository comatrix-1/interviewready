import type { Resume } from "@/types/resume";
import type { InterviewMessage } from "@/types/workflow";
import type { ChatRequest } from "@/types/api";
import { callChatEndpoint } from "@/api/chat";
import { formatInterviewCoachPayload } from "@/utils/parseUtils";
import { hasResumeContent } from "./resumeCritic";

export const interviewCoachAgent = async (
  sessionId: string,
  authToken: string,
  resume: Resume | null | undefined,
  jobDescription: string,
  history: InterviewMessage[],
): Promise<string> => {
  const request: ChatRequest = {
    intent: "INTERVIEW_COACH",
    jobDescription,
    messageHistory: history,
  };
  if (hasResumeContent(resume)) request.resumeData = resume;

  const response = await callChatEndpoint(sessionId, authToken, request);
  return formatInterviewCoachPayload(response.payload ?? response.content);
};

export const sendAudioMessage = async (
  sessionId: string,
  authToken: string,
  resume: Resume | null | undefined,
  jobDescription: string,
  history: InterviewMessage[],
  audio: Uint8Array,
) => {
  const request: ChatRequest = {
    intent: "INTERVIEW_COACH",
    resumeData: hasResumeContent(resume) ? resume : undefined,
    jobDescription,
    messageHistory: history,
    audioData: audio,
  };

  const response = await callChatEndpoint(sessionId, authToken, request);
  const responseText = formatInterviewCoachPayload(response.payload ?? response.content);
  return { responseText, transcription: response.transcription };
};
