import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useSavedResumes } from "../hooks/useSavedResumes";
import { listSavedResumes } from "../api/resumes";

vi.mock("../api/resumes", () => ({
  listSavedResumes: vi.fn(),
}));

const saved = [{ id: "r1", filename: "first.pdf", createdAt: "2026-08-12T00:00:00Z", resume: {} }];

describe("useSavedResumes", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("fetches the saved resume list for the current username", async () => {
    vi.mocked(listSavedResumes).mockResolvedValue(saved);

    const { result } = renderHook(() => useSavedResumes("alice"));

    await waitFor(() => expect(result.current.savedResumes).toEqual(saved));
    expect(result.current.isLoadingResumes).toBe(false);
    expect(listSavedResumes).toHaveBeenCalledTimes(1);
  });

  it("clears the list immediately and refetches when the username changes", async () => {
    vi.mocked(listSavedResumes).mockResolvedValue(saved);

    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useSavedResumes(username),
      { initialProps: { username: "alice" } },
    );
    await waitFor(() => expect(result.current.savedResumes).toEqual(saved));

    vi.mocked(listSavedResumes).mockResolvedValue([]);
    rerender({ username: "bob" });

    expect(result.current.savedResumes).toEqual([]); // cleared synchronously
    await waitFor(() => expect(listSavedResumes).toHaveBeenCalledTimes(2));
  });

  it("keeps the list empty without throwing when the request fails", async () => {
    vi.mocked(listSavedResumes).mockRejectedValue(new Error("503"));

    const { result } = renderHook(() => useSavedResumes("alice"));

    await waitFor(() => expect(result.current.isLoadingResumes).toBe(false));
    expect(result.current.savedResumes).toEqual([]);
  });
});
