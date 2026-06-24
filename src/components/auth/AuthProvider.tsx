"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthCtx {
  user: boolean;
  loading: boolean;
  refreshAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthCtx>({
  user: false,
  loading: true,
  refreshAuth: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      const ok = res.ok;
      setUser(ok);
      return ok;
    } catch {
      setUser(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    setUser(false);
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
