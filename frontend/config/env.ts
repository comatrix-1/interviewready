export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

if (!API_BASE_URL) {
  console.warn(
    "VITE_API_BASE_URL is not defined, falling back to empty string for relative paths or development",
  );
}
