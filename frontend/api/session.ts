import type { Resume } from "../types/resume";
import { API_BASE_URL } from "../config/env";

export const initSession = async (authToken: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sessions/new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { session_id: string };
  return data.session_id;
};

export const fetchCurrentResume = async (
  sessionId: string,
  authToken: string,
): Promise<Resume | null> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/resume`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as Resume;
};
