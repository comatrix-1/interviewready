import { z } from 'zod';
import { ResumeSchema } from '../schemas/resume-schema';
import { JobDescriptionSchema } from '../schemas/job-schema';

export interface NormalizationOptions {
  lowercaseSkills?: boolean;
  removeDuplicates?: boolean;
  standardizeDates?: boolean;
  normalizeCompanyNames?: boolean;
  trimWhitespace?: boolean;
}

export class DataNormalizer {
  private static readonly MONTH_MAP = {
    jan: '01',
    january: '01',
    feb: '02',
    february: '02',
    mar: '03',
    march: '03',
    apr: '04',
    april: '04',
    may: '05',
    jun: '06',
    june: '06',
    jul: '07',
    july: '07',
    aug: '08',
    august: '08',
    sep: '09',
    september: '09',
    oct: '10',
    october: '10',
    nov: '11',
    november: '11',
    dec: '12',
    december: '12',
  };

  private static readonly COMPANY_SUFFIXES = [
    ' inc',
    ' inc.',
    ' llc',
    ' llc.',
    ' ltd',
    ' ltd.',
    ' corp',
    ' corp.',
    'corporation',
    ' co',
    ' co.',
    ' llp',
    ' llp.',
    ' lp',
    ' lp.',
    ' plc',
    ' plc.',
  ];

  static normalizeResume(
    resume: z.infer<typeof ResumeSchema>,
    options: NormalizationOptions = {},
  ): z.infer<typeof ResumeSchema> {
    const {
      lowercaseSkills = true,
      removeDuplicates = true,
      standardizeDates = true,
      normalizeCompanyNames = true,
      trimWhitespace = true,
    } = options;

    return {
      summary: trimWhitespace ? this.trimText(resume.summary) : resume.summary,
      experience: resume.experience.map((exp) => ({
        ...exp,
        company: normalizeCompanyNames ? this.normalizeCompanyName(exp.company) : exp.company,
        role: trimWhitespace ? this.trimText(exp.role) : exp.role,
        start_date: standardizeDates ? this.normalizeDate(exp.start_date) : exp.start_date,
        end_date: standardizeDates ? this.normalizeDate(exp.end_date) : exp.end_date,
        bullets: exp.bullets
          .map((bullet) => (trimWhitespace ? this.trimText(bullet) : bullet))
          .filter((bullet) => bullet.length > 0),
      })),
      skills: this.normalizeSkills(resume.skills, { lowercaseSkills, removeDuplicates }),
      education: resume.education
        .map((edu) => (trimWhitespace ? this.trimText(edu) : edu))
        .filter((edu) => edu.length > 0),
      certifications: resume.certifications
        .map((cert) => (trimWhitespace ? this.trimText(cert) : cert))
        .filter((cert) => cert.length > 0),
    };
  }

  static normalizeJobDescription(
    jobDesc: z.infer<typeof JobDescriptionSchema>,
    options: NormalizationOptions = {},
  ): z.infer<typeof JobDescriptionSchema> {
    const { lowercaseSkills = true, removeDuplicates = true, trimWhitespace = true } = options;

    return {
      title: trimWhitespace ? this.trimText(jobDesc.title) : jobDesc.title,
      required_skills: this.normalizeSkills(jobDesc.required_skills, {
        lowercaseSkills,
        removeDuplicates,
      }),
      preferred_skills: this.normalizeSkills(jobDesc.preferred_skills, {
        lowercaseSkills,
        removeDuplicates,
      }),
      seniority: this.normalizeSeniority(jobDesc.seniority),
      responsibilities: jobDesc.responsibilities
        .map((resp) => (trimWhitespace ? this.trimText(resp) : resp))
        .filter((resp) => resp.length > 0),
      keywords: this.normalizeKeywords(jobDesc.keywords, { lowercase: true, removeDuplicates }),
    };
  }

  private static normalizeSkills(
    skills: string[],
    options: { lowercaseSkills?: boolean; removeDuplicates?: boolean } = {},
  ): string[] {
    const { lowercaseSkills = true, removeDuplicates = true } = options;

    const normalized = skills.map((skill) => {
      let normalized = skill.trim();

      if (lowercaseSkills) {
        normalized = normalized.toLowerCase();
      }

      // Remove common variations - preserve original case when lowercaseSkills is false
      if (lowercaseSkills) {
        normalized = normalized
          .replace(/\.(js|ts|jsx|tsx)$/i, '') // Remove file extensions
          .replace(/\b(nodejs|node\.js)\b/gi, 'node') // Standardize Node.js to 'node' to match tests
          .replace(/\b(javascript|js)\b/gi, 'javascript') // Standardize JavaScript
          .replace(/\b(typescript|ts)\b/gi, 'typescript') // Standardize TypeScript
          .replace(/\b(react\.js|reactjs)\b/gi, 'react') // Standardize React
          .replace(/\bvue\.js\b/gi, 'vue') // Standardize Vue
          .replace(/\bangular\.js\b/gi, 'angular') // Standardize Angular
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      } else {
        // Preserve original case but normalize common patterns
        normalized = normalized
          .replace(/\.(js|ts|jsx|tsx)$/i, '') // Remove file extensions
          .replace(/\b(NodeJS|Node\.js)\b/g, 'Node.js') // Preserve Node.js case
          .replace(/\b(React\.js|ReactJS)\b/g, 'React') // Preserve React case
          .replace(/\bVue\.js\b/g, 'Vue') // Preserve Vue case
          .replace(/\bAngular\.js\b/g, 'Angular') // Preserve Angular case
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }

      return normalized;
    });

    // Remove duplicates if requested
    const uniqueNormalized = removeDuplicates ? [...new Set(normalized)] : normalized;

    return uniqueNormalized.filter((skill) => skill.length > 0);
  }

  private static normalizeKeywords(
    keywords: string[],
    options: { lowercase?: boolean; removeDuplicates?: boolean } = {},
  ): string[] {
    const { lowercase = true, removeDuplicates = true } = options;

    const normalized = keywords.map((keyword) => {
      let normalized = keyword.trim();

      if (lowercase) {
        normalized = normalized.toLowerCase();
      }

      normalized = normalized
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s\-]/g, '') // Remove special characters except hyphens
        .replace(/\b(ai\/ml|aiml)\b/gi, 'ai ml') // Standardize AI/ML variations
        .replace(/\-/g, ' ') // Replace hyphens with spaces
        .trim();

      return normalized;
    });

    // Remove duplicates if requested
    const uniqueNormalized = removeDuplicates ? [...new Set(normalized)] : normalized;

    return uniqueNormalized.filter((keyword) => keyword.length > 0);
  }

  private static normalizeDate(dateStr: string): string {
    if (dateStr === 'present' || dateStr === 'current') {
      return 'present';
    }

    // Handle YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Handle YYYY format
    if (/^\d{4}$/.test(dateStr)) {
      return `${dateStr}-01`;
    }

    // Handle month name variations
    const lowerDate = dateStr.toLowerCase();

    // MM/YYYY or Month YYYY
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\/?\s*\d{4}$/.test(lowerDate)) {
      const monthMatch = lowerDate.match(
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/,
      );
      const yearMatch = lowerDate.match(/\d{4}$/);

      if (monthMatch && yearMatch) {
        const month = this.MONTH_MAP[monthMatch[1] as keyof typeof this.MONTH_MAP];
        return `${yearMatch[0]}-${month}`;
      }
    }

    // Handle other common formats
    if (/^\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}`;
    }

    // If can't normalize, return as-is
    return dateStr;
  }

  private static normalizeCompanyName(companyName: string): string {
    let normalized = companyName.trim();

    // Remove common separators first
    normalized = normalized.replace(/[,\.;:]/g, '');

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ');

    // Remove common suffixes (case-insensitive)
    const lowerName = normalized.toLowerCase();
    for (const suffix of this.COMPANY_SUFFIXES) {
      if (lowerName.endsWith(suffix)) {
        normalized = normalized.substring(0, normalized.length - suffix.length).trim();
        break;
      }
    }

    // Capitalize each word properly
    return normalized
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private static normalizeSeniority(seniority: string): 'junior' | 'mid' | 'senior' | 'lead' {
    const seniorityMap: Record<string, 'junior' | 'mid' | 'senior' | 'lead'> = {
      junior: 'junior',
      jr: 'junior',
      entry: 'junior',
      associate: 'junior',
      intern: 'junior',

      mid: 'mid',
      middle: 'mid',
      intermediate: 'mid',
      regular: 'mid',

      senior: 'senior',
      sr: 'senior',
      lead: 'lead',
      principal: 'lead',
      staff: 'senior',
      director: 'lead',
      manager: 'senior',

      executive: 'lead',
      vp: 'lead',
      head: 'lead',
      chief: 'lead',
    };

    const lower = seniority.toLowerCase();

    // Map variations to standard terms
    for (const [keyword, standard] of Object.entries(seniorityMap)) {
      if (lower.includes(keyword)) {
        return standard;
      }
    }

    return 'mid'; // default for unrecognized terms
  }

  private static trimText(text: string): string {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/^\s+|\s+$/g, '') // Trim leading and trailing whitespace
      .replace(/[\r\n\t]/g, ' '); // Replace newlines and tabs with spaces
  }
}
