import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("bundle security", () => {
  it("vite.config.ts does not inject GEMINI_API_KEY into the client bundle", () => {
    const configPath = resolve(__dirname, "../vite.config.ts");
    const configContent = readFileSync(configPath, "utf-8");

    expect(configContent).not.toContain("GEMINI_API_KEY");
    expect(configContent).not.toContain("process.env.API_KEY");
  });
});
