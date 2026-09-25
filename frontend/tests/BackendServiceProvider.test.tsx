import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackendServiceProvider, useBackendService } from "../providers/BackendServiceProvider";

afterEach(cleanup);

const Probe: React.FC = () => {
  const { sessionId, ensureSession } = useBackendService();
  return (
    <div>
      <span data-testid="session">{sessionId || "none"}</span>
      <button onClick={() => void ensureSession()}>ensure</button>
    </div>
  );
};

describe("BackendServiceProvider lazy sessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not create a session on mount", () => {
    globalThis.fetch = vi.fn();
    render(
      <BackendServiceProvider>
        <Probe />
      </BackendServiceProvider>,
    );

    expect(screen.getByTestId("session").textContent).toBe("none");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("creates the session on ensureSession and reuses it afterwards", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "session_abc" }),
    });
    const user = userEvent.setup();
    render(
      <BackendServiceProvider>
        <Probe />
      </BackendServiceProvider>,
    );

    await user.click(screen.getByText("ensure"));
    const sessionEl = await screen.findByTestId("session");
    expect(sessionEl.textContent).toBe("session_abc");

    await user.click(screen.getByText("ensure"));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
