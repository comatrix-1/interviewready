import { useBackendService } from "../providers/BackendServiceProvider";

export const useSession = () => {
  const { sessionId, authToken, sessionReady, sessionError } = useBackendService();
  return { sessionId, authToken, sessionReady, sessionError };
};
