import type { ChatRequest, ChatResponse } from "../types/api";
import { API_BASE_URL } from "../config/env";

export const callChatEndpoint = async (
  sessionId: string,
  authToken: string,
  request: ChatRequest,
): Promise<ChatResponse> => {
  let audioDataBase64: string | null = null;
  if (request.audioData) {
    const bytes = new Uint8Array(request.audioData);
    const binary = String.fromCodePoint(...bytes);
    audioDataBase64 = btoa(binary);
  }

  const requestBody = { ...request, audioData: audioDataBase64 };

  const response = await fetch(`${API_BASE_URL}/api/v1/chat?sessionId=${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ChatResponse;
};
