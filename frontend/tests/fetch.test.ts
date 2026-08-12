import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { apiFetch, ApiError, parseErrorDetail } from "../api/fetch";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("interviewready_username", "alice");
    globalThis.fetch = vi.fn();
  });

  it("merges content-type and identity headers into the request", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true } as Response);

    await apiFetch("/api/v1/resumes", { method: "GET" });

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe("/api/v1/resumes");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-User-Id": "alice",
    });
  });

  it("lets callers override headers", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true } as Response);

    await apiFetch("/x", { headers: { "X-Custom": "1" } });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(init?.headers).toMatchObject({ "X-Custom": "1", "X-User-Id": "alice" });
  });
});

describe("parseErrorDetail", () => {
  it("extracts the backend detail string when present", async () => {
    const response = {
      status: 503,
      json: async () => ({ detail: "Saved resumes require DATABASE_URL to be configured." }),
    } as unknown as Response;

    const err = await parseErrorDetail(response, "fallback");
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Saved resumes require DATABASE_URL to be configured.");
    expect((err as ApiError).status).toBe(503);
  });

  it("falls back when the body has no detail", async () => {
    const response = {
      status: 500,
      json: async () => ({}),
    } as unknown as Response;

    const err = await parseErrorDetail(response, "Something broke");
    expect(err.message).toBe("Something broke");
  });

  it("falls back when the body is not JSON", async () => {
    const response = {
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response;

    const err = await parseErrorDetail(response, "Bad gateway");
    expect(err.message).toBe("Bad gateway");
  });
});
