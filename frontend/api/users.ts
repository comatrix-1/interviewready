import { API_BASE_URL } from "../config/env";

export interface LoginResponse {
  username: string;
  created: boolean;
}

export const loginUser = async (username: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      // Ignore parse errors; fall back to the status text.
    }
    throw new Error(`Login failed: ${detail}`);
  }

  return (await response.json()) as LoginResponse;
};
