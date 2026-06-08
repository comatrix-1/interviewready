import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { initSession } from "../api/session";

interface BackendServiceContextType {
  sessionId: string;
  authToken: string;
  sessionReady: boolean;
  sessionError: string | null;
}

const BackendServiceContext = createContext<BackendServiceContextType | undefined>(undefined);

export const useBackendService = () => {
  const context = useContext(BackendServiceContext);
  if (!context) {
    throw new Error("useBackendService must be used within a BackendServiceProvider");
  }
  return context;
};

interface BackendServiceProviderProps {
  children: ReactNode;
}

export const BackendServiceProvider: React.FC<BackendServiceProviderProps> = ({ children }) => {
  const [sessionId, setSessionId] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const authToken = localStorage.getItem("authToken") || "";

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const id = await initSession(authToken);
        if (!cancelled) {
          setSessionId(id);
          setSessionReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setSessionError(`Failed to initialize session: ${String(err)}`);
        }
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const value = useMemo(
    () => ({ sessionId, authToken, sessionReady, sessionError }),
    [sessionId, authToken, sessionReady, sessionError],
  );

  return <BackendServiceContext.Provider value={value}>{children}</BackendServiceContext.Provider>;
};
