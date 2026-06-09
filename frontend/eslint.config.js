import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";

export default defineConfig([
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js, boundaries },
    settings: {
      "import/resolver": {
        typescript: true,
      },
      react: {
        version: "19",
      },
      "boundaries/elements": [
        { type: "types", pattern: "types/**/*", mode: "file" },
        { type: "config", pattern: "config/**/*", mode: "file" },
        { type: "utils", pattern: "utils/**/*", mode: "file" },
        { type: "api", pattern: "api/**/*", mode: "file" },
        { type: "providers", pattern: "providers/**/*", mode: "file" },
        { type: "hooks", pattern: "hooks/**/*", mode: "file" },
        { type: "contexts", pattern: "contexts/**/*", mode: "file" },
        { type: "components", pattern: "components/**/*", mode: "file" },
      ],
    },
    rules: {
      // Architectural boundaries: layered dependency graph where each layer
      // can import from its own layer (for barrel files) and from lower layers.
      // Foundation (types) → Config → Utils → API → Providers → Hooks → Components
      "boundaries/dependencies": [
        2,
        {
          default: "disallow",
          rules: [
            // types: foundation layer — no project dependencies, only other types
            {
              from: { type: "types" },
              allow: { to: { type: ["types"] } },
            },
            // config: depends on types and other config files
            {
              from: { type: "config" },
              allow: { to: { type: ["types", "config"] } },
            },
            // utils: depends on config (constants), types, and other utils
            {
              from: { type: "utils" },
              allow: { to: { type: ["types", "config", "utils"] } },
            },
            // api: depends on config (env), types, utils, and other api modules
            {
              from: { type: "api" },
              allow: { to: { type: ["types", "config", "utils", "api"] } },
            },
            // providers: depends on types, config, api, utils, and other providers
            {
              from: { type: "providers" },
              allow: { to: { type: ["types", "config", "api", "utils", "providers"] } },
            },
            // hooks: depends on types, config, api, utils, providers, and other hooks
            {
              from: { type: "hooks" },
              allow: {
                to: { type: ["types", "config", "api", "utils", "providers", "hooks"] },
              },
            },
            // contexts: depends on types and other contexts
            {
              from: { type: "contexts" },
              allow: { to: { type: ["types", "contexts"] } },
            },
            // components: top layer — can import everything below
            {
              from: { type: "components" },
              allow: {
                to: {
                  type: [
                    "types",
                    "config",
                    "utils",
                    "api",
                    "providers",
                    "hooks",
                    "contexts",
                    "components",
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    languageOptions: { globals: globals.browser },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  // Disable prop-types — TypeScript provides full type safety
  { rules: { "react/prop-types": "off" } },
  // Disable react-in-jsx-scope — React 19 JSX transform handles this
  { rules: { "react/react-in-jsx-scope": "off" } },
  // Allow _-prefixed unused params (e.g., destructured markdown component props)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Allow empty interfaces used for declaration merging (e.g., Vite type options)
  {
    rules: {
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
    },
  },
]);
