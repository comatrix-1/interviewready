import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("InterviewStep WebSocket stability", () => {
  const source = readFileSync(
    resolve(__dirname, "../components/workflow-steps/InterviewStep.tsx"),
    "utf-8",
  );

  it("stores callbacks in a ref to avoid WebSocket teardown on re-render", () => {
    // The hook should use a ref for callbacks
    expect(source).toContain("const callbacksRef = useRef(callbacks)");
    expect(source).toContain("callbacksRef.current = callbacks");

    // The useEffect should reference callbacksRef, not callbacks directly
    expect(source).toContain("callbacksRef.current?.onAudioData");
    expect(source).toContain("callbacksRef.current?.onConnectionChange");
    expect(source).toContain("callbacksRef.current?.onInterrupted");
    expect(source).toContain("callbacksRef.current?.onTurnComplete");
  });

  it("stores onLiveEvent in a ref", () => {
    expect(source).toContain("const onLiveEventRef = useRef(onLiveEvent)");
    expect(source).toContain("onLiveEventRef.current = onLiveEvent");
    expect(source).toContain("onLiveEventRef.current(msg)");
  });

  it("useEffect deps only include mode and sessionId", () => {
    // The effect should NOT include callbacks or onLiveEvent in deps
    const effectDepsMatch = source.match(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?initializeRelaySession[\s\S]*?\},\s*\[([^\]]+)\]/,
    );
    expect(effectDepsMatch).not.toBeNull();

    const deps = effectDepsMatch![1].trim();
    expect(deps).toBe("mode, sessionId");
    expect(deps).not.toContain("callbacks");
    expect(deps).not.toContain("onLiveEvent");
  });

  it("uses stable message keys that do not change as text grows", () => {
    // Keys should be index-based, not text-based
    expect(source).toContain("key={`${msg.role}-${i}`}");
    // Should NOT have the old text-slice key
    expect(source).not.toContain("msg.text.slice");
  });
});
