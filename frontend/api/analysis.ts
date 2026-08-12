import type { Resume } from "../types/resume";
import type { AlignmentReport, ResumeCriticReport } from "../types/reports";
import { API_BASE_URL } from "../config/env";
import { apiFetch, parseErrorDetail } from "./fetch";

const ANALYSIS_URL = `${API_BASE_URL}/api/v1/analysis`;

// Moved here from the deleted chat-endpoints/resumeCritic.ts (interviewCoach.ts imports it).
export const hasResumeContent = (resume?: Resume | null): boolean => {
  if (!resume) return false;
  return Object.values(resume).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
};

export interface ParseResumeResult {
  resume: Resume | null;
  needsReview: boolean;
  confidenceScore: number;
  lowConfidenceFields: string[];
  validationErrors: string[];
}

export const parseResumeFile = async (file: {
  data: string;
  fileType: "pdf";
}): Promise<ParseResumeResult> => {
  const response = await apiFetch(`${ANALYSIS_URL}/parse`, {
    method: "POST",
    body: JSON.stringify({ file }),
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Failed to parse resume: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as ParseResumeResult;
};

export const resumeCriticAgent = async (resume: Resume): Promise<ResumeCriticReport> => {
  const response = await apiFetch(`${ANALYSIS_URL}/critique`, {
    method: "POST",
    body: JSON.stringify({ resume }),
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Resume critique failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as ResumeCriticReport;
};

export const alignmentAgent = async (
  resume: Resume | null | undefined,
  jobDescription: string,
): Promise<AlignmentReport> => {
  const response = await apiFetch(`${ANALYSIS_URL}/alignment`, {
    method: "POST",
    body: JSON.stringify({ resume, jobDescription }),
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Alignment analysis failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as Partial<AlignmentReport>;
  return {
    skillsMatch: Array.isArray(data.skillsMatch) ? data.skillsMatch : [],
    missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
    experienceMatch: Array.isArray(data.experienceMatch) ? data.experienceMatch : [],
    summary: typeof data.summary === "string" ? data.summary : "",
  };
};
