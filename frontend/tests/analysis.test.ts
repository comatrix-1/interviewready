import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { alignmentAgent, checkResume, parseResumeFile, resumeCriticAgent } from "../api/analysis";

describe("session-free analysis API client", () => {
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

    const result = await parseResumeFile({ data: "JVBERi0xLjQ=", fileType: "pdf" });

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/v1/analysis/parse"));
    expect(url as string).not.toContain("sessionId");
    expect(init?.headers).toMatchObject({ "X-User-Id": "alice" });
    expect(init?.headers).not.toHaveProperty("Authorization");
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

    const report = await resumeCriticAgent({ name: "Alice" } as never);

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url as string).toEqual(expect.stringContaining("/api/v1/analysis/critique"));
    expect(url as string).not.toContain("sessionId");
    expect(init?.headers).not.toHaveProperty("Authorization");
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

    const report = await alignmentAgent({ name: "Alice" } as never, "SWE role");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url as string).toEqual(expect.stringContaining("/api/v1/analysis/alignment"));
    expect(url as string).not.toContain("sessionId");
    expect(init?.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(init?.body as string)).toEqual({
      resume: { name: "Alice" },
      jobDescription: "SWE role",
    });
    expect(report.skillsMatch).toEqual(["Python"]);
  });

  it("runs the combined check via POST /api/v1/analysis/check", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ats: { ats_score: 70, sections: [], detailed_results: {}, validation_warnings: [] },
        critic: { issues: [], summary: "Solid.", score: 88 },
      }),
    });

    const result = await checkResume({ name: "Alice" } as never);

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url as string).toEqual(expect.stringContaining("/api/v1/analysis/check"));
    expect(JSON.parse(init?.body as string)).toEqual({
      resume: { name: "Alice" },
      jobDescription: "",
    });
    expect(result.ats.ats_score).toBe(70);
    expect(result.critic.score).toBe(88);
  });
});
