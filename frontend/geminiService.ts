
import { GoogleGenAI, Type } from "@google/genai";
import { ResumeSchema, StructuralAssessment, ContentAnalysisReport, AlignmentReport } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface ExtractorFileData {
  data: string;
  mimeType: string;
}

export const extractorAgent = async (input: string | ExtractorFileData): Promise<ResumeSchema> => {
  const parts = [];
  
  if (typeof input === 'string') {
    parts.push({ text: `Parse the following resume text into a structured JSON format. Resume Text: ${input}` });
  } else {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.data,
      },
    });
    parts.push({ text: "Parse the attached resume file into a structured JSON format." });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                role: { type: Type.STRING },
                duration: { type: Type.STRING },
                achievements: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["company", "role", "duration", "achievements"]
            }
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING },
                degree: { type: Type.STRING },
                year: { type: Type.STRING }
              },
              required: ["institution", "degree", "year"]
            }
          }
        },
        required: ["name", "email", "skills", "experience", "education"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
};

export const resumeCriticAgent = async (resume: ResumeSchema): Promise<StructuralAssessment> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Critique the structure and formatting of this resume: ${JSON.stringify(resume)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          readability: { type: Type.STRING },
          formattingRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["score", "readability", "formattingRecommendations", "suggestions"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const contentStrengthAgent = async (resume: ResumeSchema): Promise<ContentAnalysisReport> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the content strength and skills of this resume using STAR/XYZ methodology: ${JSON.stringify(resume)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          skillImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
          quantifiedImpactScore: { type: Type.NUMBER }
        },
        required: ["strengths", "gaps", "skillImprovements", "quantifiedImpactScore"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const alignmentAgent = async (resume: ResumeSchema, jd: string): Promise<AlignmentReport> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare this resume: ${JSON.stringify(resume)} against this Job Description: ${jd}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          matchingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          roleFitAnalysis: { type: Type.STRING }
        },
        required: ["overallScore", "matchingKeywords", "missingKeywords", "roleFitAnalysis"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const interviewCoachAgent = async (
  alignment: AlignmentReport, 
  history: { role: 'user' | 'agent'; text: string }[]
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are an Interview Coach. Based on this alignment report: ${JSON.stringify(alignment)}, continue the interview. History: ${JSON.stringify(history)}`,
  });
  return response.text || "I'm sorry, I couldn't generate a response.";
};
