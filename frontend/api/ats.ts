import type { Resume } from "@/types/resume";
import type { ATSReport, ResumeCriticIssue } from "@/types/reports";
import { API_BASE_URL } from "@/config/env";

interface ATSAnalysisRequest {
  resume: Resume;
  job_description?: string;
  critic_issues?: Array<{
    location: string;
    type: string;
    severity: string;
    description: string;
  }>;
}

export const atsEngineAnalyze = async (
  authToken: string,
  resume: Resume,
  criticIssues?: ResumeCriticIssue[],
): Promise<ATSReport> => {
  const body: ATSAnalysisRequest = { resume };
  if (criticIssues && criticIssues.length > 0) {
    body.critic_issues = criticIssues;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/ats/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`ATS analysis failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ATSReport;
};
