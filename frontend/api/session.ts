import type { Resume } from "../types/resume";
import { API_BASE_URL } from "../config/env";
import { apiFetch, parseErrorDetail } from "./fetch";

const SESSION_STORAGE_PREFIX = "interviewready_session_";

// In-flight creation per identity so concurrent initializers (e.g. React
// StrictMode's double effect invocation in dev) share a single session.
const inFlightSessions = new Map<string, Promise<string>>();

const storedSessionKey = (identity: string): string => `${SESSION_STORAGE_PREFIX}${identity}`;

const getStoredSessionId = (identity: string): string =>
  localStorage.getItem(storedSessionKey(identity)) || "";

const storeSessionId = (identity: string, sessionId: string): void => {
  localStorage.setItem(storedSessionKey(identity), sessionId);
};

export const initSession = async (): Promise<string> => {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/sessions/new`, {
    method: "POST",
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Failed to create session: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { session_id: string };
  return data.session_id;
};

/**
 * Return the existing session id for this identity, or create (and persist) a
 * new one. Reuses the stored id on refresh so no duplicate session is created.
 */
export const getOrCreateSession = (identity: string): Promise<string> => {
  const stored = getStoredSessionId(identity);
  if (stored) return Promise.resolve(stored);

  const inFlight = inFlightSessions.get(identity);
  if (inFlight) return inFlight;

  const creation = initSession()
    .then((sessionId) => {
      storeSessionId(identity, sessionId);
      return sessionId;
    })
    .finally(() => {
      // Only clear the slot for the creation that set it.
      if (inFlightSessions.get(identity) === creation) {
        inFlightSessions.delete(identity);
      }
    });
  inFlightSessions.set(identity, creation);
  return creation;
};

export const seedSessionContext = async (
  sessionId: string,
  resume: Resume | null | undefined,
  jobDescription: string,
): Promise<void> => {
  const body: { resumeData?: Resume; jobDescription?: string } = {};
  if (resume) body.resumeData = resume;
  if (jobDescription) body.jobDescription = jobDescription;

  const response = await apiFetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/context`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseErrorDetail(
      response,
      `Failed to seed session context: ${response.status} ${response.statusText}`,
    );
  }
};
