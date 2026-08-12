import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { getOrCreateSession } from "../api/session";
import { loginUser } from "../api/users";
import { clearCurrentUsername, getCurrentUsername, setCurrentUsername } from "../utils/identity";

interface BackendServiceContextType {
  sessionId: string;
  authToken: string;
  sessionReady: boolean;
  sessionError: string | null;
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
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>(() => getCurrentUsername());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const authToken = localStorage.getItem("authToken") || "";

  // Sessions are owned by the logged-in user (or the dev-user fallback when
  // nobody has logged in), so the stored session is scoped by identity. On load
  // we reuse an existing session for this identity; a new one is created only
  // when none exists (e.g. first visit or after the user changes).
  useEffect(() => {
    let cancelled = false;
    setSessionId("");
    setSessionReady(false);
    setSessionError(null);
    const init = async () => {
      try {
        const id = await getOrCreateSession(username || "dev-user", authToken);
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
  }, [authToken, username]);

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
      sessionReady,
      sessionError,
      username,
      isLoggingIn,
      loginError,
      login,
      logout,
    }),
    [
      sessionId,
      authToken,
      sessionReady,
      sessionError,
      username,
      isLoggingIn,
      loginError,
      login,
      logout,
    ],
  );

  return <BackendServiceContext.Provider value={value}>{children}</BackendServiceContext.Provider>;
};
