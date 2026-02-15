
import { GoogleGenAI, Type } from "@google/genai";
import { ResumeSchema, StructuralAssessment, ContentAnalysisReport, AlignmentReport } from './types';

// Initialize the Google GenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ExtractorFileData {
  data: string;
  mimeType: string;
}

// Uses Gemini 3 Flash to parse resume into a structured JSON schema.
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
          phone: { type: Type.STRING },
          location: { type: Type.STRING },
          summary: { type: Type.STRING },
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
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                date: { type: Type.STRING }
              },
              required: ["title", "description", "date"]
            }
          },
          certifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING }
              },
              required: ["name", "issuer", "date"]
            }
          },
          awards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING }
              },
              required: ["title", "issuer", "date"]
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
    timestamp: new Date().toISOString(),
    projects: data.projects || [],
    certifications: data.certifications || [],
    awards: data.awards || []
  };
};

// Critic agent reviews the resume's visual hierarchy and formatting.
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

// Content agent analyzes the impact of bullet points using STAR/XYZ methodology.
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

// Alignment agent uses Google Search grounding to contextualize the resume against market requirements.
export const alignmentAgent = async (resume: ResumeSchema, jd: string): Promise<AlignmentReport> => {
  // Use Google Search grounding to gather real-world context for the comparison.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the fit between this resume and the Job Description. Use Google Search to research the company or specific technology trends if necessary.
    Resume: ${JSON.stringify(resume)}
    JD: ${jd}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  // Extract grounding chunks to display research sources in the UI.
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    ?.map(chunk => ({
      title: chunk.web?.title || 'Search Source',
      uri: chunk.web?.uri || ''
    })) || [];
  
  // Follow-up with a structured JSON request to summarize the findings.
  const responseStructured = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on your analysis of the fit between this resume and JD, provide a structured report.
    Resume: ${JSON.stringify(resume)}
    JD: ${jd}
    Detailed Analysis: ${response.text}`,
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
  
  const data = JSON.parse(responseStructured.text || '{}');
  return {
    ...data,
    sources
  };
};

// Interview coach uses Gemini 3 Pro for advanced reasoning during mock interviews.
export const interviewCoachAgent = async (
  alignment: AlignmentReport, 
  history: { role: 'user' | 'agent'; text: string }[]
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are a high-stakes Interview Coach. Based on this alignment report: ${JSON.stringify(alignment)}, conduct a realistic mock interview. Ask one targeted question at a time. History: ${JSON.stringify(history)}`,
  });
  return response.text || "I'm sorry, I couldn't generate a response.";
};
