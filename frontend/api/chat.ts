import type { ChatRequest, ChatResponse } from "../types/api";
import { API_BASE_URL } from "../config/env";
import { uint8ArrayToBase64 } from "../utils/base64";
import { apiFetch, parseErrorDetail } from "./fetch";

export const callChatEndpoint = async (
  sessionId: string,
  request: ChatRequest,
): Promise<ChatResponse> => {
  let audioDataBase64: string | null = null;
  if (request.audioData) {
    const bytes = new Uint8Array(request.audioData);
    audioDataBase64 = uint8ArrayToBase64(bytes);
  }

  const requestBody = { ...request, audioData: audioDataBase64 };

  const response = await apiFetch(`${API_BASE_URL}/api/v1/chat?sessionId=${sessionId}`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Backend API error: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as ChatResponse;
};
