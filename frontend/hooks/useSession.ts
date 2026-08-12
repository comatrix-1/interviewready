import { useBackendService } from "../providers/BackendServiceProvider";

export const useSession = () => {
  const { sessionId, authToken, sessionError, ensureSession } = useBackendService();
  return { sessionId, authToken, sessionError, ensureSession };
};
