import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("LoadingContext stability", () => {
  it("uses useCallback for startLoading, updateProgress, and stopLoading", () => {
    const sourcePath = resolve(__dirname, "../contexts/LoadingContext.tsx");
    const source = readFileSync(sourcePath, "utf-8");

    // Verify all three main callbacks use useCallback
    expect(source).toContain("const startLoading = useCallback(");
    expect(source).toContain("const updateProgress = useCallback(");
    expect(source).toContain("const stopLoading = useCallback(");
  });

  it("useMemo deps do not include callback references", () => {
    const sourcePath = resolve(__dirname, "../contexts/LoadingContext.tsx");
    const source = readFileSync(sourcePath, "utf-8");

    // Extract the useMemo dependency array
    const useMemoMatch = source.match(/useMemo\(\s*\(\)\s*=>\s*\({[\s\S]*?\),\s*\[([\s\S]*?)\]/);
    expect(useMemoMatch).not.toBeNull();

    const deps = useMemoMatch![1];
    // Callbacks should NOT be in the deps array (they're stable via useCallback)
    expect(deps).not.toContain("startLoading");
    expect(deps).not.toContain("stopLoading");
    expect(deps).not.toContain("updateProgress");
    // State values should still be there
    expect(deps).toContain("isLoading");
    expect(deps).toContain("progress");
  });
});
