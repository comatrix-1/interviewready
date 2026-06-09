import type { ChatRequest, ChatResponse } from "../types/api";
import { API_BASE_URL } from "../config/env";
import { uint8ArrayToBase64 } from "../utils/base64";

export const callChatEndpoint = async (
  sessionId: string,
  authToken: string,
  request: ChatRequest,
): Promise<ChatResponse> => {
  let audioDataBase64: string | null = null;
  if (request.audioData) {
    const bytes = new Uint8Array(request.audioData);
    audioDataBase64 = uint8ArrayToBase64(bytes);
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
