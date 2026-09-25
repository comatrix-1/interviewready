import { getUserHeaders } from "../utils/identity";

const DEFAULT_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * fetch wrapper: merges the JSON content-type and X-User-Id identity headers,
 * and aborts requests that exceed the (default 120s) timeout so a hung LLM
 * call surfaces an error instead of a pending promise forever.
 */
export const apiFetch = async (
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...requestInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...requestInit,
      headers: {
        "Content-Type": "application/json",
        ...getUserHeaders(),
        ...(requestInit.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const parseErrorDetail = async (response: Response, fallback: string): Promise<Error> => {
  let detail: unknown;
  try {
    detail = ((await response.json()) as { detail?: unknown }).detail;
  } catch {
    // Body is not JSON; fall back to the status-based message below.
  }
  return new ApiError(response.status, typeof detail === "string" && detail ? detail : fallback);
};
