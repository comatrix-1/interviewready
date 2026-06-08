import type { InterviewCoachPayload } from "../types/api";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const parseInterviewCoachPayload = (payload: unknown): InterviewCoachPayload | null => {
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return isRecord(parsed) ? (parsed as InterviewCoachPayload) : null;
    } catch {
      return null;
    }
  }
  return isRecord(payload) ? (payload as InterviewCoachPayload) : null;
};

const formatInterviewCompleteResponse = (parsed: InterviewCoachPayload): string => {
  const lines = [
    "Interview complete.",
    parsed.overall_rating ? `Overall rating: ${parsed.overall_rating}` : "",
    parsed.summary || "",
    parsed.strengths?.length ? `Strengths: ${parsed.strengths.join(", ")}` : "",
    parsed.areas_for_improvement?.length
      ? `Areas to improve: ${parsed.areas_for_improvement.join(", ")}`
      : "",
    parsed.recommendations?.length ? `Recommendations: ${parsed.recommendations.join(", ")}` : "",
    parsed.final_feedback || "",
  ];
  return lines.filter(Boolean).join("\n\n");
};

const formatQuestionResponse = (parsed: InterviewCoachPayload): string => {
  const questionLabel =
    parsed.current_question_number && parsed.total_questions
      ? `Question ${parsed.current_question_number} of ${parsed.total_questions}`
      : "Interview question";

  const lines = [
    questionLabel,
    parsed.question || "",
    parsed.feedback ? `Feedback: ${parsed.feedback}` : "",
    typeof parsed.answer_score === "number" ? `Score: ${Math.round(parsed.answer_score)}/100` : "",
    parsed.tip ? `Tip: ${parsed.tip}` : "",
    parsed.next_challenge ? `Next focus: ${parsed.next_challenge}` : "",
  ];
  return lines.filter(Boolean).join("\n\n");
};

export const formatInterviewCoachPayload = (payload: unknown): string => {
  const parsed = parseInterviewCoachPayload(payload);
  if (!parsed) {
    return typeof payload === "string" ? payload : "I'm sorry, I couldn't generate a response.";
  }
  return parsed.interview_complete
    ? formatInterviewCompleteResponse(parsed)
    : formatQuestionResponse(parsed);
};
