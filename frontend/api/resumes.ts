import type { SavedResume } from "../types/resume";
import { API_BASE_URL } from "../config/env";
import { getUserHeaders } from "../utils/identity";

const RESUMES_URL = `${API_BASE_URL}/api/v1/resumes`;

const toApiError = async (response: Response, fallback: string): Promise<Error> => {
  let detail: unknown;
  try {
    detail = ((await response.json()) as { detail?: unknown }).detail;
  } catch {
    // Body is not JSON; fall back to the status-based message below.
  }
  return new Error(typeof detail === "string" && detail ? detail : fallback);
};

export const listSavedResumes = async (): Promise<SavedResume[]> => {
  const response = await fetch(RESUMES_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getUserHeaders(),
    },
  });

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to load saved resumes: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { resumes: SavedResume[] };
  return data.resumes;
};

export const createSavedResume = async (
  payload: Pick<SavedResume, "filename" | "resume">,
): Promise<SavedResume> => {
  const response = await fetch(RESUMES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getUserHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await toApiError(
      response,
      `Failed to save resume: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as SavedResume;
};
