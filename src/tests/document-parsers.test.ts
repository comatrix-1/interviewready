import {
  DocumentParserFactory,
  ResumePDFParser,
  DOCXParser,
  TextParser,
} from '../utils/document-parsers';

describe('DocumentParserFactory', () => {
  describe('isSupported', () => {
    it('should return true for supported file formats', () => {
      expect(DocumentParserFactory.isSupported('resume.pdf')).toBe(true);
      expect(DocumentParserFactory.isSupported('document.docx')).toBe(true);
      expect(DocumentParserFactory.isSupported('notes.txt')).toBe(true);
    });

    it('should return false for unsupported file formats', () => {
      expect(DocumentParserFactory.isSupported('image.jpg')).toBe(false);
      expect(DocumentParserFactory.isSupported('presentation.ppt')).toBe(false);
      expect(DocumentParserFactory.isSupported('spreadsheet.xlsx')).toBe(false);
    });

    it('should handle uppercase extensions', () => {
      expect(DocumentParserFactory.isSupported('resume.PDF')).toBe(true);
      expect(DocumentParserFactory.isSupported('document.DOCX')).toBe(true);
    });
  });

  describe('createParser', () => {
    it('should create PDF parser for PDF files', () => {
      const parser = DocumentParserFactory.createParser('document.pdf');
      expect(parser).toBeInstanceOf(ResumePDFParser);
    });

    it('should create DOCX parser for DOCX files', () => {
      const parser = DocumentParserFactory.createParser('document.docx');
      expect(parser).toBeInstanceOf(DOCXParser);
    });

    it('should create Text parser for TXT files', () => {
      const parser = DocumentParserFactory.createParser('document.txt');
      expect(parser).toBeInstanceOf(TextParser);
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        DocumentParserFactory.createParser('image.jpg');
      }).toThrow('Unsupported file format: jpg');
    });
  });
});

describe('ResumePDFParser', () => {
  let parser: ResumePDFParser;

  beforeEach(() => {
    parser = new ResumePDFParser();
  });

  it('should have parse method', () => {
    expect(typeof parser.parse).toBe('function');
  });

  // Note: Full PDF parsing tests would require actual PDF files
  // Integration tests would cover real parsing scenarios
});

describe('DOCXParser', () => {
  let parser: DOCXParser;

  beforeEach(() => {
    parser = new DOCXParser();
  });

  it('should have parse method', () => {
    expect(typeof parser.parse).toBe('function');
  });

  // Note: Full DOCX parsing tests would require actual DOCX files
  // Integration tests would cover real parsing scenarios
});

describe('TextParser', () => {
  let parser: TextParser;

  beforeEach(() => {
    parser = new TextParser();
  });

  it('should parse simple text buffer', async () => {
    const text = 'Hello, World!';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parser.parse(buffer);

    expect(result).toBe(text);
  });

  it('should handle empty buffer', async () => {
    const buffer = Buffer.alloc(0);

    const result = await parser.parse(buffer);

    expect(result).toBe('');
  });

  it('should handle UTF-8 encoded text', async () => {
    const text = 'Résumé with émojis 🚀';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parser.parse(buffer);

    expect(result).toBe(text);
  });

  it('should throw error for null/undefined input', async () => {
    // TextParser expects a Buffer, so null/undefined should cause issues
    await expect(parser.parse(null as any)).rejects.toThrow();
    await expect(parser.parse(undefined as any)).rejects.toThrow();
  });
});
