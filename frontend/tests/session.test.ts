import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  clearStoredSession,
  deleteSession,
  getOrCreateSession,
  seedSessionContext,
} from "../api/session";

const SESSION_PREFIX = "interviewready_session_";

const sessionResponse = (sessionId: string) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => ({ session_id: sessionId }),
});

const storedSessionId = (identity: string): string =>
  localStorage.getItem(`${SESSION_PREFIX}${identity}`) || "";

describe("getOrCreateSession", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new session and persists it when none is stored", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(sessionResponse("session_1"));

    const id = await getOrCreateSession("alice");

    expect(id).toBe("session_1");
    expect(storedSessionId("alice")).toBe("session_1");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses the stored session without calling the API", async () => {
    localStorage.setItem(`${SESSION_PREFIX}alice`, "session_kept");

    const id = await getOrCreateSession("alice");

    expect(id).toBe("session_kept");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent initializations into one session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(sessionResponse("session_shared"));

    const [first, second] = await Promise.all([
      getOrCreateSession("alice"),
      getOrCreateSession("alice"),
    ]);

    expect(first).toBe("session_shared");
    expect(second).toBe("session_shared");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps sessions separate per identity", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(sessionResponse("session_alice"))
      .mockResolvedValueOnce(sessionResponse("session_bob"));

    const alice = await getOrCreateSession("alice");
    const bob = await getOrCreateSession("bob");

    expect(alice).toBe("session_alice");
    expect(bob).toBe("session_bob");
    expect(storedSessionId("alice")).toBe("session_alice");
    expect(storedSessionId("bob")).toBe("session_bob");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("seedSessionContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the resume and job description to the session context endpoint", async () => {
    localStorage.setItem("interviewready_username", "alice");
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await seedSessionContext("session_1", { skills: [{ name: "Python" }] } as never, "SWE role");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/v1/sessions/session_1/context"));
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "X-User-Id": "alice" });
    expect(init?.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(init?.body as string)).toEqual({
      resumeData: { skills: [{ name: "Python" }] },
      jobDescription: "SWE role",
    });
  });

  it("omits empty resume and job description from the body", async () => {
    localStorage.setItem("interviewready_username", "alice");
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await seedSessionContext("session_1", null, "");

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({});
  });
});

describe("deleteSession / clearStoredSession", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes the session via DELETE /api/v1/sessions/:id", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await deleteSession("session_1");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/v1/sessions/session_1"));
    expect(init?.method).toBe("DELETE");
  });

  it("clearStoredSession removes the persisted session id", () => {
    localStorage.setItem(`${SESSION_PREFIX}alice`, "session_1");
    clearStoredSession("alice");
    expect(storedSessionId("alice")).toBe("");
  });
});
