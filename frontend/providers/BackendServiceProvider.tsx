import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from "react";
import { getOrCreateSession } from "../api/session";
import { loginUser } from "../api/users";
import { clearCurrentUsername, getCurrentUsername, setCurrentUsername } from "../utils/identity";

interface BackendServiceContextType {
  sessionId: string;
  authToken: string;
  sessionError: string | null;
  ensureSession: () => Promise<string>;
  username: string;
  isLoggingIn: boolean;
  loginError: string | null;
  login: (username: string) => Promise<boolean>;
  logout: () => void;
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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>(() => getCurrentUsername());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const authToken = localStorage.getItem("authToken") || "";

  // Sessions exist only for the interview coach step: create one lazily when the
  // interview starts instead of on app load. getOrCreateSession reuses a stored
  // session and dedupes concurrent creations.
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    setSessionError(null);
    try {
      const id = await getOrCreateSession(username || "dev-user", authToken);
      setSessionId(id);
      return id;
    } catch (err) {
      setSessionError(`Failed to initialize session: ${String(err)}`);
      return "";
    }
  }, [sessionId, username, authToken]);

  const login = useCallback(async (rawUsername: string): Promise<boolean> => {
    const name = rawUsername.trim();
    if (!name) {
      setLoginError("Please enter a username.");
      return false;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await loginUser(name);
      setCurrentUsername(result.username);
      setUsername(result.username);
      return true;
    } catch (err) {
      setLoginError(String(err));
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearCurrentUsername();
    setUsername("");
    setLoginError(null);
  }, []);

  const value = useMemo(
    () => ({
      sessionId,
      authToken,
      sessionError,
      ensureSession,
      username,
      isLoggingIn,
      loginError,
      login,
      logout,
    }),
    [
      sessionId,
      authToken,
      sessionError,
      ensureSession,
      username,
      isLoggingIn,
      loginError,
      login,
      logout,
    ],
  );

  return <BackendServiceContext.Provider value={value}>{children}</BackendServiceContext.Provider>;
};
