import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface DocumentParser {
  parse(buffer: Buffer): Promise<string>;
}

export class ResumePDFParser implements DocumentParser {
  async parse(buffer: Buffer): Promise<string> {
    try {
      const pdfParser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await pdfParser.getText();
      return textResult.pages.map((page) => page.text).join('\n');
    } catch (error) {
      throw new Error(
        `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export class DOCXParser implements DocumentParser {
  async parse(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.messages.length > 0) {
        // Log warnings but don't fail the parsing
        console.warn('DOCX parsing warnings:', result.messages);
      }
      return result.value;
    } catch (error) {
      throw new Error(
        `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export class TextParser implements DocumentParser {
  async parse(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      throw new Error(
        `Text parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export class DocumentParserFactory {
  static createParser(filename: string): DocumentParser {
    const extension = filename.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return new ResumePDFParser();
      case 'docx':
        return new DOCXParser();
      case 'txt':
        return new TextParser();
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  static isSupported(filename: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    return ['pdf', 'docx', 'txt'].includes(extension || '');
  }
}
