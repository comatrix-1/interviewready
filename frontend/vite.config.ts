import path from "path";
import { defineConfig, loadEnv } from "vite-plus";
import react from "@vitejs/plugin-react";

const env = loadEnv(process.env.NODE_ENV || "development", ".", "");

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    host: "0.0.0.0",
  },
  plugins: react(),
  define: {
    "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
