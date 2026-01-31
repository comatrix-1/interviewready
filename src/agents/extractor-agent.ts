import { z } from 'zod';

import { JobDescriptionSchema } from '../schemas/job-schema';
import { ResumeSchema } from '../schemas/resume-schema';
import { DataNormalizer } from '../utils/data-normalizer';
import { DocumentParserFactory } from '../utils/document-parsers';

import { BaseAgent } from './base-agent';

// Extractor Agent Configuration
export const ExtractorAgentConfigSchema = z.object({
  name: z.string().default('ExtractorAgent'),
  description: z
    .string()
    .default('Extracts structured data from unstructured resume and job description text'),
  version: z.string().default('1.0.0'),
  timeout: z.number().default(30000),
  maxTextLength: z.number().default(10000),
});

export type ExtractorAgentConfig = z.infer<typeof ExtractorAgentConfigSchema>;

// Extractor Agent Input Schema
export const ExtractorInputSchema = z.object({
  resumeText: z.string().min(1, { message: 'Resume text is required' }),
  jobDescriptionText: z.string().min(1, { message: 'Job description text is required' }),
});

// Alternative input schema for file-based extraction
export const ExtractorFileInputSchema = z.object({
  resumeBuffer: z.instanceof(Buffer, { message: 'Resume buffer is required' }),
  resumeFilename: z.string().min(1, { message: 'Resume filename is required' }),
  jobDescriptionBuffer: z.instanceof(Buffer, { message: 'Job description buffer is required' }),
  jobDescriptionFilename: z.string().min(1, { message: 'Job description filename is required' }),
});

export type ExtractorInput = z.infer<typeof ExtractorInputSchema>;

// Extractor Agent Output Schema
export const ExtractorOutputSchema = z.object({
  resume: ResumeSchema,
  jobDescription: JobDescriptionSchema,
});

export type ExtractorOutput = z.infer<typeof ExtractorOutputSchema>;

// Extractor Agent Implementation
export class ExtractorAgent extends BaseAgent<ExtractorAgentConfig> {
  constructor(config: Partial<ExtractorAgentConfig> = {}) {
    const defaultConfig = {
      name: 'ExtractorAgent',
      description: 'Extracts structured data from unstructured resume and job description text',
      version: '1.0.0',
      timeout: 30000,
      maxTextLength: 10000,
      ...config,
    };
    super(ExtractorAgentConfigSchema.parse(defaultConfig));
  }

  async execute(input: unknown): Promise<ExtractorOutput> {
    this.log('Starting extraction process');

    try {
      // Check if input is text-based or file-based
      if (this.isTextInput(input)) {
        return this.extractFromText(input);
      } else if (this.isFileInput(input)) {
        return this.extractFromFiles(input);
      } else {
        throw new Error('Invalid input format. Expected text or file-based input.');
      }
    } catch (error) {
      this.log('Extraction failed', 'error');
      throw error;
    }
  }

  private isTextInput(input: unknown): input is z.infer<typeof ExtractorInputSchema> {
    try {
      ExtractorInputSchema.parse(input);
      return true;
    } catch {
      return false;
    }
  }

  private isFileInput(input: unknown): input is z.infer<typeof ExtractorFileInputSchema> {
    try {
      ExtractorFileInputSchema.parse(input);
      return true;
    } catch {
      return false;
    }
  }

  private async extractFromText(
    input: z.infer<typeof ExtractorInputSchema>,
  ): Promise<ExtractorOutput> {
    this.log('Extracting from text input');

    const { resumeText, jobDescriptionText } = input;

    // Check text length limits
    if (resumeText.length > this.config.maxTextLength) {
      throw new Error(
        `Resume text exceeds maximum length of ${this.config.maxTextLength} characters`,
      );
    }

    if (jobDescriptionText.length > this.config.maxTextLength) {
      throw new Error(
        `Job description text exceeds maximum length of ${this.config.maxTextLength} characters`,
      );
    }

    const resume = this.extractResumeData(resumeText);
    const jobDescription = this.extractJobDescriptionData(jobDescriptionText);

    // Normalize the extracted data
    const normalizedResume = DataNormalizer.normalizeResume(resume);
    const normalizedJobDescription = DataNormalizer.normalizeJobDescription(jobDescription);

    const result = { resume: normalizedResume, jobDescription: normalizedJobDescription };
    ExtractorOutputSchema.parse(result); // Validate output

    this.log('Text extraction completed successfully');
    return result;
  }

  private async extractFromFiles(
    input: z.infer<typeof ExtractorFileInputSchema>,
  ): Promise<ExtractorOutput> {
    this.log('Extracting from file input');

    const { resumeBuffer, resumeFilename, jobDescriptionBuffer, jobDescriptionFilename } = input;

    // Parse files to text
    const resumeText = await this.parseDocument(resumeBuffer, resumeFilename);
    const jobDescriptionText = await this.parseDocument(
      jobDescriptionBuffer,
      jobDescriptionFilename,
    );

    return this.extractFromText({ resumeText, jobDescriptionText });
  }

  private async parseDocument(buffer: Buffer, filename: string): Promise<string> {
    try {
      if (!DocumentParserFactory.isSupported(filename)) {
        throw new Error(`Unsupported file format: ${filename}`);
      }

      const parser = DocumentParserFactory.createParser(filename);
      const text = await parser.parse(buffer);

      this.log(`Successfully parsed ${filename}, extracted ${text.length} characters`);
      return text;
    } catch (error) {
      this.log(
        `Failed to parse ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
      throw new Error(
        `Failed to parse document ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private extractResumeData(text: string): z.infer<typeof ResumeSchema> {
    // For now, return structured mock data with some real extraction
    // TODO: Implement proper NLP-based extraction using OpenCode AI SDK
    this.log('Extracting resume data from text');

    // Simple keyword-based extraction as fallback
    const skills = this.extractSkills(text);
    const education = this.extractEducation(text);
    const experience = this.extractExperience(text);

    return {
      summary: this.extractSummary(text) || 'Professional with relevant experience',
      experience:
        experience.length > 0
          ? experience
          : [
              {
                company: 'Previous Company',
                role: 'Professional Role',
                start_date: '2020-01',
                end_date: 'present',
                bullets: ['Professional experience with relevant responsibilities'],
              },
            ],
      skills: skills.length > 0 ? skills : ['JavaScript', 'TypeScript', 'React'],
      education: education.length > 0 ? education : ['Bachelor of Science in Computer Science'],
      certifications: this.extractCertifications(text),
    };
  }

  private extractJobDescriptionData(text: string): z.infer<typeof JobDescriptionSchema> {
    // For now, return structured mock data with some real extraction
    // TODO: Implement proper NLP-based extraction using OpenCode AI SDK
    this.log('Extracting job description data from text');

    const requiredSkills = this.extractRequiredSkills(text);
    const preferredSkills = this.extractPreferredSkills(text);
    const responsibilities = this.extractResponsibilities(text);
    const keywords = this.extractKeywords(text);
    const seniority = this.extractSeniority(text);

    return {
      title: this.extractTitle(text) || 'Professional Position',
      required_skills: requiredSkills.length > 0 ? requiredSkills : ['JavaScript', 'TypeScript'],
      preferred_skills: preferredSkills.length > 0 ? preferredSkills : ['React', 'Node.js'],
      seniority: (seniority as 'junior' | 'mid' | 'senior' | 'lead') || 'mid',
      responsibilities:
        responsibilities.length > 0 ? responsibilities : ['Professional responsibilities'],
      keywords: keywords.length > 0 ? keywords : ['professional', 'development'],
    };
  }

  // Helper methods for text extraction (simplified implementations)
  private extractSkills(text: string): string[] {
    const skillPatterns = [
      /javascript|typescript|python|java|react|vue|angular|node\.js|express/gi,
      /aws|azure|gcp|docker|kubernetes|terraform/gi,
      /sql|mongodb|postgresql|mysql|redis/gi,
      /git|github|gitlab|ci\/cd|jenkins/gi,
    ];

    const foundSkills = new Set<string>();
    skillPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => foundSkills.add(match.toLowerCase()));
      }
    });

    return Array.from(foundSkills);
  }

  private extractEducation(text: string): string[] {
    const educationPatterns = [
      /(bachelor|master|phd|associate|certificate).*?(computer science|engineering|information technology)/gi,
      /(b\.s\.|m\.s\.|ph\.d\.).*?(computer|science|engineering)/gi,
    ];

    const education: string[] = [];
    educationPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        education.push(...matches);
      }
    });

    return education;
  }

  private extractExperience(text: string): Array<{
    company: string;
    role: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }> {
    // Simplified experience extraction - would need NLP for production
    const experience = [];
    const lines = text.split('\n');

    let currentCompany = '';
    let currentRole = '';
    let currentBullets: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;

      // Look for company/role patterns (simplified)
      if (
        trimmed.match(/^(Senior|Junior|Lead|Principal)/i) ||
        trimmed.match(/Engineer|Developer|Manager|Analyst/i)
      ) {
        if (currentCompany && currentRole) {
          experience.push({
            company: currentCompany,
            role: currentRole,
            start_date: '2020-01',
            end_date: 'present',
            bullets: currentBullets,
          });
        }
        currentRole = trimmed;
        currentBullets = [];
      } else if (trimmed.match(/^[A-Z][a-z]/) && trimmed.length > 10) {
        currentCompany = trimmed;
      } else if (trimmed.match(/^[-•*]/)) {
        currentBullets.push(trimmed.replace(/^[-•*]\s*/, ''));
      }
    }

    if (currentCompany && currentRole) {
      experience.push({
        company: currentCompany,
        role: currentRole,
        start_date: '2020-01',
        end_date: 'present',
        bullets: currentBullets,
      });
    }

    return experience;
  }

  private extractSummary(text: string): string | null {
    const summaryPatterns = [/^.{0,100}(summary|objective|profile)/im, /^(.{50,300})$/m];

    for (const pattern of summaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  private extractCertifications(text: string): string[] {
    const certPatterns = [
      /aws.*certified|azure.*certified|google.*certified/gi,
      /pmp|csm|csd|csp/gi,
      /certified/gi,
    ];

    const certifications = new Set<string>();
    certPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => certifications.add(match));
      }
    });

    return Array.from(certifications);
  }

  private extractRequiredSkills(text: string): string[] {
    const patterns = [
      /required.*?skills?:?\s*([^.]*?)/i,
      /must have.*?skills?:?\s*([^.]*?)/i,
      /skills:\s*([^.]*?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    }

    return [];
  }

  private extractPreferredSkills(text: string): string[] {
    const patterns = [
      /preferred.*?skills?:?\s*([^.]*?)/i,
      /nice to have.*?skills?:?\s*([^.]*?)/i,
      /preferred skills:\s*([^.]*?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    }

    return [];
  }

  private extractResponsibilities(text: string): string[] {
    const lines = text.split('\n');
    const responsibilities: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.match(/^(you will|responsible for|develop|design|implement)/i) ||
        trimmed.match(/^[-•*]/)
      ) {
        responsibilities.push(trimmed.replace(/^[-•*]\s*/, ''));
      }
    }

    return responsibilities.slice(0, 10); // Limit to 10 responsibilities
  }

  private extractKeywords(text: string): string[] {
    const techKeywords = [
      'software',
      'development',
      'engineering',
      'cloud',
      'aws',
      'azure',
      'javascript',
      'typescript',
      'react',
      'node',
      'python',
      'java',
      'database',
      'sql',
      'nosql',
      'microservices',
      'api',
      'rest',
      'agile',
      'scrum',
      'devops',
      'ci/cd',
      'testing',
    ];

    const textLower = text.toLowerCase();
    const found = techKeywords.filter((keyword) => textLower.includes(keyword.toLowerCase()));

    return [...new Set(found)].slice(0, 20); // Remove duplicates and limit
  }

  private extractTitle(text: string): string | null {
    const patterns = [
      /^.{0,50}(job title|position|role):?\s*(.+)/im,
      /^(senior|junior|lead|principal).{0,50}/im,
      /job title:\s*(.+)/im,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1]?.trim() || match[0].trim();
      }
    }

    return null;
  }

  private extractSeniority(text: string): string | null {
    const seniorityMap = {
      junior: 'junior',
      entry: 'junior',
      associate: 'junior',
      mid: 'mid',
      middle: 'mid',
      senior: 'senior',
      lead: 'senior',
      principal: 'senior',
      staff: 'senior',
      director: 'executive',
      manager: 'executive',
      vp: 'executive',
    };

    const textLower = text.toLowerCase();
    for (const [keyword, seniority] of Object.entries(seniorityMap)) {
      if (textLower.includes(keyword)) {
        return seniority;
      }
    }

    return null;
  }
}
