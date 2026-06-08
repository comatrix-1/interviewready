export interface Work {
  name?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
}

export interface Education {
  institution?: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
}

export interface Award {
  title?: string;
  date?: string;
  awarder?: string;
  summary?: string;
}

export interface Certificate {
  name?: string;
  date?: string;
  issuer?: string;
  url?: string;
}

export interface Skill {
  name?: string;
}

export interface Project {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  highlights?: string[];
  url?: string;
}

export interface ResumeSchema {
  work?: Work[];
  education?: Education[];
  awards?: Award[];
  certificates?: Certificate[];
  skills?: Skill[];
  projects?: Project[];
}

export type Resume = ResumeSchema;
