import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { alignmentAgent, parseResumeFile, resumeCriticAgent } from "../api/analysis";

describe("session-free analysis API client", () => {
  const AUTH_TOKEN = "test-token";

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("interviewready_username", "alice");
    globalThis.fetch = vi.fn();
  });

  it("parses a resume file via POST /api/v1/analysis/parse without a session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resume: { name: "Alice" },
        needsReview: false,
        confidenceScore: 0.9,
        lowConfidenceFields: [],
        validationErrors: [],
      }),
    });

    const result = await parseResumeFile(AUTH_TOKEN, { data: "JVBERi0xLjQ=", fileType: "pdf" });

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/v1/analysis/parse"));
    expect(url as string).not.toContain("sessionId");
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "X-User-Id": "alice",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      file: { data: "JVBERi0xLjQ=", fileType: "pdf" },
    });
    expect(result.resume).toEqual({ name: "Alice" });
  });

  it("critiques a resume via POST /api/v1/analysis/critique without a session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [], summary: "Solid.", score: 88 }),
    });

    const report = await resumeCriticAgent(AUTH_TOKEN, { name: "Alice" } as never);

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url as string).toEqual(expect.stringContaining("/api/v1/analysis/critique"));
    expect(url as string).not.toContain("sessionId");
    expect(JSON.parse(init?.body as string)).toEqual({ resume: { name: "Alice" } });
    expect(report.score).toBe(88);
  });

  it("runs alignment via POST /api/v1/analysis/alignment with the job description", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skillsMatch: ["Python"],
        missingSkills: [],
        experienceMatch: [],
        summary: "Good fit.",
      }),
    });

    const report = await alignmentAgent(AUTH_TOKEN, { name: "Alice" } as never, "SWE role");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url as string).toEqual(expect.stringContaining("/api/v1/analysis/alignment"));
    expect(url as string).not.toContain("sessionId");
    expect(JSON.parse(init?.body as string)).toEqual({
      resume: { name: "Alice" },
      jobDescription: "SWE role",
    });
    expect(report.skillsMatch).toEqual(["Python"]);
  });
});
