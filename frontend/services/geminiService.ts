
import { GoogleGenAI, Type } from "@google/genai";
import { ResumeSchema, GapReport, OptimizationSuggestion, InterviewMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const ExtractorAgent = async (text: string): Promise<ResumeSchema> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract structured data from this resume text. 
    Specifically, identify and tag the most critical professional skills (taggedSkills) 
    and calculate the total years of professional experience (yearsOfExperience) as a number.
    Output JSON only.\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          summary: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          taggedSkills: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "A refined list of key technical and soft skills."
          },
          yearsOfExperience: { 
            type: Type.NUMBER,
            description: "The total number of years of professional work experience calculated from the timeline."
          },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                role: { type: Type.STRING },
                duration: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["company", "role", "bullets"]
            }
          }
        },
        required: ["name", "email", "summary", "skills", "taggedSkills", "yearsOfExperience", "experience"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
};

export const ScorerAgent = async (resume: ResumeSchema, jd: string): Promise<GapReport> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the gap between this resume and the job description.
    Use the candidate's tagged skills [${resume.taggedSkills.join(', ')}] and their ${resume.yearsOfExperience} years of experience
    as primary indicators for the match. 
    
    Job Description: ${jd}
    
    Output JSON only.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          matchingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experienceGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          impactScore: {
            type: Type.OBJECT,
            properties: {
              skills: { type: Type.NUMBER },
              experience: { type: Type.NUMBER },
              relevance: { type: Type.NUMBER }
            }
          }
        },
        required: ["overallScore", "matchingSkills", "missingSkills", "experienceGaps", "impactScore"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const OptimizerAgent = async (resume: ResumeSchema, report: GapReport): Promise<OptimizationSuggestion[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Suggest 3 improved resume bullets for this candidate to better match the missing skills: ${report.missingSkills.join(', ')}. Base it on their existing experience: ${JSON.stringify(resume.experience)}. Output JSON only.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalBullet: { type: Type.STRING },
            suggestedBullet: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ["originalBullet", "suggestedBullet", "reasoning"]
        }
      }
    }
  });

  const suggestions = JSON.parse(response.text || '[]');
  return suggestions.map((s: any) => ({ ...s, id: crypto.randomUUID(), status: 'pending' }));
};

export const InterviewerAgent = async (history: InterviewMessage[], report: GapReport): Promise<string> => {
  const prompt = history.length === 0 
    ? `Start a mock interview focusing on these gaps: ${report.missingSkills.join(', ')}. Ask the first question.`
    : `Continue the interview. User said: "${history[history.length - 1].content}". Ask the next question focusing on gaps: ${report.missingSkills.join(', ')}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a senior hiring manager conducting a technical interview. Be professional, challenging, but fair."
    }
  });

  return response.text || "I'm sorry, I couldn't generate a question.";
};

export const ValidatorAgent = async (suggestion: string, context: string): Promise<boolean> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Validate if this suggested rewrite is a hallucination or if it is grounded in the original experience. Suggestion: ${suggestion}. Context: ${context}. Answer with VALID or INVALID only.`,
  });

  return response.text?.includes('VALID') || false;
};
