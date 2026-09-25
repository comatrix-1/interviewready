import type { SavedResume } from "../types/resume";
import { API_BASE_URL } from "../config/env";
import { apiFetch, parseErrorDetail } from "./fetch";

const RESUMES_URL = `${API_BASE_URL}/api/v1/resumes`;

export const listSavedResumes = async (): Promise<SavedResume[]> => {
  const response = await apiFetch(RESUMES_URL, { method: "GET" });

  if (!response.ok) {
    throw await parseErrorDetail(
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
  const response = await apiFetch(RESUMES_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Failed to save resume: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as SavedResume;
};
