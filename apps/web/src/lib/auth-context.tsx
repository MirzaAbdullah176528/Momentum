"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { authClient, type AuthSession } from "@/lib/auth";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  error: null,
  refresh: async () => {
    // Stub — the real implementation is provided by AuthProvider below.
  }
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const result = await authClient.getSession();
      if (result.error) {
        setSession(null);
      } else {
        setSession(result.data as unknown as AuthSession);
      }
    } catch {
      setSession(null);
      setError("Failed to check session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, error, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
