import path from "path";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint2";

export default defineConfig({
  fmt: {},
  lint: {
    ignorePatterns: ["dist/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },

  server: {
    port: Number(process.env.PORT) || 3000,
    host: "0.0.0.0",
  },
  plugins: [
    react(),
    eslint({
      lintOnStart: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
