import { DataNormalizer } from '../utils/data-normalizer';

describe('DataNormalizer', () => {
  describe('normalizeResume', () => {
    const mockResume = {
      summary: '  Software Engineer  with  experience  ',
      experience: [
        {
          company: 'Tech Corp Inc.',
          role: '  Senior Software Engineer  ',
          start_date: 'Jan 2020',
          end_date: 'present',
          bullets: ['  Developed APIs  ', '   Led team  ', ''],
        },
      ],
      skills: ['JavaScript', 'javascript', 'Node.js', 'react.js', 'typescript'],
      education: ['Bachelor of Science in Computer Science'],
      certifications: ['AWS certified', 'PMP'],
    };

    it('should normalize resume with default options', () => {
      const result = DataNormalizer.normalizeResume(mockResume);

      expect(result.summary).toBe('Software Engineer with experience');
      expect(result.experience[0].company).toBe('Tech Corp'); // Current implementation removes "Inc."
      expect(result.experience[0].role).toBe('Senior Software Engineer');
      expect(result.experience[0].start_date).toBe('2020-01');
      expect(result.experience[0].end_date).toBe('present');
      expect(result.experience[0].bullets).toEqual(['Developed APIs', 'Led team']);
      expect(result.skills).toEqual(['javascript', 'node', 'react', 'typescript']); // Current implementation removes duplicates
      expect(result.education).toEqual(['Bachelor of Science in Computer Science']);
      expect(result.certifications).toEqual(['AWS certified', 'PMP']);
    });

    it('should preserve original case when lowercaseSkills is false', () => {
      const result = DataNormalizer.normalizeResume(mockResume, {
        lowercaseSkills: false,
      });

      expect(result.skills).toContain('JavaScript');
      expect(result.skills).toContain('Node');
    });

    it('should remove duplicates when removeDuplicates is true', () => {
      const result = DataNormalizer.normalizeResume(mockResume, {
        lowercaseSkills: true,
        removeDuplicates: true,
      });

      expect(result.skills).toEqual(['javascript', 'node', 'react', 'typescript']);
    });
  });

  describe('normalizeJobDescription', () => {
    const mockJobDesc = {
      title: '  Senior Software Engineer  ',
      required_skills: ['JavaScript', 'javascript', 'Node.js', 'react.js'],
      preferred_skills: ['Docker', 'kubernetes'],
      seniority: 'senior' as 'junior' | 'mid' | 'senior' | 'lead',
      responsibilities: ['  Develop APIs  ', '   Lead team  '],
      keywords: ['Backend', 'backend', 'Cloud Development', 'cloud-development'],
    };

    it('should normalize job description with default options', () => {
      const result = DataNormalizer.normalizeJobDescription(mockJobDesc);

      expect(result.title).toBe('Senior Software Engineer');
      expect(result.required_skills).toEqual(['javascript', 'node', 'react']);
      expect(result.preferred_skills).toEqual(['docker', 'kubernetes']);
      expect(result.seniority).toBe('senior');
      expect(result.responsibilities).toEqual(['Develop APIs', 'Lead team']);
      expect(result.keywords).toEqual(['backend', 'cloud development']);
    });

    it('should preserve original case when lowercase is false', () => {
      const result = DataNormalizer.normalizeJobDescription(mockJobDesc, {
        lowercaseSkills: false,
      } as any);

      expect(result.required_skills).toContain('JavaScript');
      expect(result.required_skills).toContain('Node');
    });
  });

  describe('normalizeSkills', () => {
    it('should standardize common skill variations', () => {
      const skills = ['javascript', 'typescript', 'reactjs', 'vue.js', 'angular.js'];

      const result = DataNormalizer['normalizeSkills'](skills);

      expect(result).toContain('javascript');
      expect(result).toContain('typescript');
      expect(result).toContain('react');
      expect(result).toContain('vue');
      expect(result).toContain('angular');
    });

    it('should remove file extensions from skills', () => {
      const skills = ['JavaScript.js', 'TypeScript.ts', 'React.jsx'];

      const result = DataNormalizer['normalizeSkills'](skills);

      expect(result).toContain('javascript');
      expect(result).toContain('typescript');
      expect(result).toContain('react');
      expect(result).not.toContain('.js');
      expect(result).not.toContain('.ts');
      expect(result).not.toContain('.jsx');
    });

    it('should remove duplicates when specified', () => {
      const skills = ['javascript', 'JavaScript', 'node.js', 'Node.js'];

      const withDuplicates = DataNormalizer['normalizeSkills'](skills, { removeDuplicates: false });
      const withoutDuplicates = DataNormalizer['normalizeSkills'](skills, {
        removeDuplicates: true,
      });

      expect(withDuplicates.length).toBeGreaterThan(withoutDuplicates.length);
      expect(withoutDuplicates).toEqual(['javascript', 'node']);
    });
  });

  describe('normalizeDate', () => {
    it('should handle present/current values', () => {
      expect(DataNormalizer['normalizeDate']('present')).toBe('present');
      expect(DataNormalizer['normalizeDate']('current')).toBe('present');
    });

    it('should handle YYYY-MM format', () => {
      expect(DataNormalizer['normalizeDate']('2020-01')).toBe('2020-01');
      expect(DataNormalizer['normalizeDate']('2021-12')).toBe('2021-12');
    });

    it('should handle YYYY format', () => {
      expect(DataNormalizer['normalizeDate']('2020')).toBe('2020-01');
      expect(DataNormalizer['normalizeDate']('1995')).toBe('1995-01');
    });

    it('should handle month name variations', () => {
      expect(DataNormalizer['normalizeDate']('Jan 2020')).toBe('2020-01');
      expect(DataNormalizer['normalizeDate']('February 2021')).toBe('2021-02');
      expect(DataNormalizer['normalizeDate']('Dec 1999')).toBe('1999-12');
    });

    it('should handle MM/YYYY format', () => {
      expect(DataNormalizer['normalizeDate']('1/2020')).toBe('2020-01');
      expect(DataNormalizer['normalizeDate']('12/2021')).toBe('2021-12');
    });

    it('should return original format if unrecognized', () => {
      expect(DataNormalizer['normalizeDate']('unknown format')).toBe('unknown format');
      expect(DataNormalizer['normalizeDate']('2020/13/01')).toBe('2020/13/01');
    });
  });

  describe('normalizeCompanyName', () => {
    it('should remove common company suffixes', () => {
      expect(DataNormalizer['normalizeCompanyName']('Tech Corp Inc.')).toBe('Tech Corp');
      expect(DataNormalizer['normalizeCompanyName']('Software LLC')).toBe('Software');
      expect(DataNormalizer['normalizeCompanyName']('Global Corp Ltd')).toBe('Global Corp');
    });

    it('should capitalize each word properly', () => {
      expect(DataNormalizer['normalizeCompanyName']('tech solutions')).toBe('Tech Solutions');
      expect(DataNormalizer['normalizeCompanyName']('ADVANCED SYSTEMS')).toBe('Advanced Systems');
    });

    it('should remove separators and extra whitespace', () => {
      expect(DataNormalizer['normalizeCompanyName']('Tech, Corp; Inc.')).toBe('Tech Corp');
      expect(DataNormalizer['normalizeCompanyName']('  Software   Solutions  ')).toBe(
        'Software Solutions',
      );
    });
  });

  describe('normalizeSeniority', () => {
    it('should map various seniority terms correctly', () => {
      expect(DataNormalizer['normalizeSeniority']('junior')).toBe('junior');
      expect(DataNormalizer['normalizeSeniority']('Sr.')).toBe('senior');
      expect(DataNormalizer['normalizeSeniority']('mid-level')).toBe('mid');
      expect(DataNormalizer['normalizeSeniority']('lead developer')).toBe('lead');
      expect(DataNormalizer['normalizeSeniority']('VP of Engineering')).toBe('lead');
    });

    it('should default to mid for unrecognized terms', () => {
      expect(DataNormalizer['normalizeSeniority']('unknown')).toBe('mid');
      expect(DataNormalizer['normalizeSeniority']('regular')).toBe('mid');
    });
  });

  describe('normalizeKeywords', () => {
    it('should convert to lowercase and remove special characters', () => {
      const keywords = ['Backend Development', 'Cloud-Computing', 'AI/ML'];

      const result = DataNormalizer['normalizeKeywords'](keywords);

      expect(result).toContain('backend development');
      expect(result).toContain('cloud computing');
      expect(result).toContain('ai ml');
    });

    it('should remove duplicates', () => {
      const keywords = ['backend', 'Backend', 'cloud', 'development', 'Development'];

      const result = DataNormalizer['normalizeKeywords'](keywords);

      expect(result).toEqual(['backend', 'cloud', 'development']);
    });

    it('should filter out empty strings', () => {
      const keywords = ['backend', '', 'cloud', '   ', 'development'];

      const result = DataNormalizer['normalizeKeywords'](keywords);

      expect(result).toEqual(['backend', 'cloud', 'development']);
    });
  });

  describe('trimText', () => {
    it('should normalize whitespace', () => {
      expect(DataNormalizer['trimText']('  Text   with  multiple   spaces  ')).toBe(
        'Text with multiple spaces',
      );
    });

    it('should handle newlines and tabs', () => {
      expect(DataNormalizer['trimText']('Text\nwith\tnewlines\r\nand\ttabs')).toBe(
        'Text with newlines and tabs',
      );
    });

    it('should handle empty strings', () => {
      expect(DataNormalizer['trimText']('')).toBe('');
      expect(DataNormalizer['trimText']('   ')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(DataNormalizer['trimText'](null as any)).toBe('');
      expect(DataNormalizer['trimText'](undefined as any)).toBe('');
    });
  });
});
