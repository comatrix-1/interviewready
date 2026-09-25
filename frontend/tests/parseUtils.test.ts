import { describe, expect, it } from "vite-plus/test";
import { formatInterviewCoachPayload } from "../utils/parseUtils";

describe("formatInterviewCoachPayload", () => {
  it("formats structured interview questions into readable chat copy", () => {
    const formatted = formatInterviewCoachPayload({
      current_question_number: 2,
      total_questions: 5,
      question: "Tell me about a time you learned a new framework quickly.",
      feedback: "Your previous answer was too generic.",
      answer_score: 42,
      tip: "Use a concrete example with measurable impact.",
      next_challenge: "Be more specific about your actions.",
    });

    expect(formatted).toContain("Question 2 of 5");
    expect(formatted).toContain("Your previous answer was too generic.");
    expect(formatted).toContain("Score: 42/100");
    expect(formatted).toContain("Tip: Use a concrete example with measurable impact.");
  });

  it("passes plain strings through when the payload is not structured", () => {
    expect(formatInterviewCoachPayload("Hello coach")).toBe("Hello coach");
  });
});
