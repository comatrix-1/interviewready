import { ExtractorAgent } from '../agents/extractor-agent';

// Mock the DocumentParserFactory for testing
jest.mock('../utils/document-parsers', () => ({
  DocumentParserFactory: {
    isSupported: jest.fn((filename: string) => {
      const extension = filename.toLowerCase().split('.').pop();
      return ['pdf', 'docx', 'txt'].includes(extension || '');
    }),
    createParser: jest.fn(() => ({
      parse: jest.fn().mockResolvedValue('mocked text content'),
    })),
  },
}));

describe('ExtractorAgent', () => {
  let agent: ExtractorAgent;

  beforeEach(() => {
    agent = new ExtractorAgent({
      name: 'TestExtractorAgent',
      timeout: 5000,
      maxTextLength: 10000,
    });
  });

  describe('constructor', () => {
    it('should create agent with default configuration', () => {
      const defaultAgent = new ExtractorAgent();
      const info = defaultAgent.getAgentInfo();

      expect(info.name).toBe('ExtractorAgent');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toContain('Extracts structured data');
    });

    it('should create agent with custom configuration', () => {
      const customAgent = new ExtractorAgent({
        name: 'CustomExtractor',
        timeout: 60000,
        maxTextLength: 5000,
      });

      expect(customAgent.getAgentInfo().name).toBe('CustomExtractor');
    });
  });

  describe('execute with text input', () => {
    it('should process valid text input', async () => {
      const input = {
        resumeText: 'John Doe\nSoftware Engineer\nExperience: 5 years',
        jobDescriptionText: 'Senior Software Engineer\nRequired: JavaScript, TypeScript',
      };

      const result = await agent.execute(input);

      expect(result).toHaveProperty('resume');
      expect(result).toHaveProperty('jobDescription');
      expect(result.resume).toHaveProperty('summary');
      expect(result.resume).toHaveProperty('experience');
      expect(result.resume).toHaveProperty('skills');
      expect(result.resume).toHaveProperty('education');
      expect(result.resume).toHaveProperty('certifications');
      expect(result.jobDescription).toHaveProperty('title');
      expect(result.jobDescription).toHaveProperty('required_skills');
      expect(result.jobDescription).toHaveProperty('preferred_skills');
      expect(result.jobDescription).toHaveProperty('seniority');
      expect(result.jobDescription).toHaveProperty('responsibilities');
      expect(result.jobDescription).toHaveProperty('keywords');
    });

    it('should reject input that exceeds max length', async () => {
      const input = {
        resumeText: 'a'.repeat(1001), // exceeds default max length
        jobDescriptionText: 'Valid job description',
      };

      await expect(agent.execute(input)).rejects.toThrow(
        'Resume text exceeds maximum length of 10000 characters',
      );
    });

    it('should reject invalid input schema', async () => {
      const invalidInput = {
        resumeText: 123, // wrong type
        jobDescriptionText: 'Valid job description',
      };

      await expect(agent.execute(invalidInput)).rejects.toThrow();
    });
  });

  describe('execute with file input', () => {
    const mockBuffer = Buffer.from('test content', 'utf-8');

    it('should process valid file input', async () => {
      const input = {
        resumeBuffer: Buffer.from('Sample resume text'),
        resumeFilename: 'resume.pdf', // Use PDF instead of txt
        jobDescriptionBuffer: Buffer.from('Sample job description'),
        jobDescriptionFilename: 'job.docx', // Use DOCX instead of txt
      };

      const result = await agent.execute(input);

      expect(result).toHaveProperty('resume');
      expect(result).toHaveProperty('jobDescription');
    });

    it('should reject unsupported file format', async () => {
      const input = {
        resumeBuffer: Buffer.from('Sample resume'),
        resumeFilename: 'resume.jpg',
        jobDescriptionBuffer: Buffer.from('Sample job description'),
        jobDescriptionFilename: 'job.txt',
      };

      await expect(agent.execute(input)).rejects.toThrow(
        'Failed to parse document resume.jpg: Unsupported file format: resume.jpg',
      );
    });

    it('should reject malformed file buffer', async () => {
      const input = {
        resumeBuffer: null as any, // invalid buffer
        resumeFilename: 'resume.txt',
        jobDescriptionBuffer: mockBuffer,
        jobDescriptionFilename: 'job.txt',
      };

      await expect(agent.execute(input)).rejects.toThrow();
    });
  });

  describe('text extraction methods', () => {
    it('should extract skills from text', () => {
      const text = 'Experienced in JavaScript, TypeScript, React, and Node.js';

      // Access private method through type assertion for testing
      const skills = (agent as any).extractSkills(text);

      expect(skills).toContain('javascript');
      expect(skills).toContain('typescript');
      expect(skills).toContain('react');
      expect(skills).toContain('node.js');
    });

    it('should extract education from text', () => {
      const text = 'Bachelor of Science in Computer Science from University';

      const education = (agent as any).extractEducation(text);

      expect(education.length).toBeGreaterThan(0);
      expect(education[0]).toMatch(/computer science/i);
    });

    it('should extract experience patterns', () => {
      const text = `Senior Software Engineer
Tech Company
- Led team of 5 developers
- Developed REST APIs
- Implemented CI/CD pipelines`;

      const experience = (agent as any).extractExperience(text);

      expect(experience.length).toBeGreaterThan(0);
      expect(experience[0].role).toContain('Senior Software Engineer');
      expect(experience[0].company).toContain('Tech Company');
      expect(experience[0].bullets.length).toBe(3);
    });

    it('should extract certifications', () => {
      const text = 'AWS Certified Developer and PMP certified';

      const certifications = (agent as any).extractCertifications(text);

      expect(certifications).toContain('aws certified developer');
      expect(certifications).toContain('pmp');
    });
  });

  describe('job description extraction methods', () => {
    it('should extract required skills', () => {
      const text = 'Required skills: JavaScript, TypeScript, React';

      const skills = (agent as any).extractRequiredSkills(text);

      expect(skills).toEqual(['JavaScript', 'TypeScript', 'React']);
    });

    it('should extract preferred skills', () => {
      const text = 'Preferred skills: Docker, Kubernetes, AWS';

      const skills = (agent as any).extractPreferredSkills(text);

      expect(skills).toEqual(['Docker', 'Kubernetes', 'AWS']);
    });

    it('should extract responsibilities', () => {
      const text = `Responsibilities:
- Design and implement scalable services
- Mentor junior engineers
- Collaborate with cross-functional teams`;

      const responsibilities = (agent as any).extractResponsibilities(text);

      expect(responsibilities).toContain('Design and implement scalable services');
      expect(responsibilities).toContain('Mentor junior engineers');
      expect(responsibilities).toContain('Collaborate with cross-functional teams');
    });

    it('should extract job title', () => {
      const text = 'Job Title: Senior Software Engineer';

      const title = (agent as any).extractTitle(text);

      expect(title).toBe('Senior Software Engineer');
    });

    it('should extract seniority level', () => {
      const text = 'Senior level position';

      const seniority = (agent as any).extractSeniority(text);

      expect(seniority).toBe('senior');
    });

    it('should extract keywords', () => {
      const text = 'Software development with cloud technologies and microservices architecture';

      const keywords = (agent as any).extractKeywords(text);

      expect(keywords).toContain('software');
      expect(keywords).toContain('development');
      expect(keywords).toContain('cloud');
      expect(keywords).toContain('microservices');
    });
  });

  describe('input type detection', () => {
    it('should correctly identify text input', () => {
      const textInput = {
        resumeText: 'Valid resume text',
        jobDescriptionText: 'Valid job description',
      };

      expect((agent as any).isTextInput(textInput)).toBe(true);
      expect((agent as any).isFileInput(textInput)).toBe(false);
    });

    it('should correctly identify file input', () => {
      const fileInput = {
        resumeBuffer: Buffer.from('test'),
        resumeFilename: 'resume.txt',
        jobDescriptionBuffer: Buffer.from('test'),
        jobDescriptionFilename: 'job.txt',
      };

      expect((agent as any).isTextInput(fileInput)).toBe(false);
      expect((agent as any).isFileInput(fileInput)).toBe(true);
    });

    it('should reject invalid input types', () => {
      const invalidInput = {
        wrongProperty: 'invalid',
      };

      expect((agent as any).isTextInput(invalidInput)).toBe(false);
      expect((agent as any).isFileInput(invalidInput)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors gracefully', async () => {
      // Mock DocumentParserFactory to throw error
      const { DocumentParserFactory } = require('../utils/document-parsers');
      DocumentParserFactory.isSupported.mockReturnValue(true);
      DocumentParserFactory.createParser.mockImplementation(() => {
        throw new Error('Parsing failed');
      });

      const input = {
        resumeBuffer: Buffer.from('test'),
        resumeFilename: 'resume.txt',
        jobDescriptionBuffer: Buffer.from('test'),
        jobDescriptionFilename: 'job.txt',
      };

      await expect(agent.execute(input)).rejects.toThrow('Failed to parse document');
    });

    it('should validate output schema', async () => {
      const input = {
        resumeText: 'Valid resume',
        jobDescriptionText: 'Valid job description',
      };

      const result = await agent.execute(input);

      // Verify result matches expected schema structure
      expect(result).toHaveProperty('resume');
      expect(result.resume).toHaveProperty('summary');
      expect(result.resume).toHaveProperty('experience');
      expect(result.resume).toHaveProperty('skills');
      expect(result.resume).toHaveProperty('education');
      expect(result.resume).toHaveProperty('certifications');
      expect(result).toHaveProperty('jobDescription');
      expect(result.jobDescription).toHaveProperty('title');
      expect(result.jobDescription).toHaveProperty('required_skills');
      expect(result.jobDescription).toHaveProperty('preferred_skills');
      expect(result.jobDescription).toHaveProperty('seniority');
      expect(result.jobDescription).toHaveProperty('responsibilities');
      expect(result.jobDescription).toHaveProperty('keywords');
    });
  });

  describe('agent info', () => {
    it('should return correct agent information', () => {
      const info = agent.getAgentInfo();

      expect(info.name).toBe('TestExtractorAgent');
      expect(info.description).toContain('Extracts structured data');
      expect(info.version).toBe('1.0.0');
    });
  });
});
