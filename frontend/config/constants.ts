import type { ResumeSchema } from "@/types/resume";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const STORAGE_KEY = "interview_ready_state";

export const DEFAULT_RESUME: ResumeSchema = {
  work: [],
  education: [],
  awards: [],
  certificates: [],
  skills: [],
  projects: [],
};
