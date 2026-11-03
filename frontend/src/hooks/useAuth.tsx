import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import type { User } from "../types";

interface AuthState { user: User | null; loading: boolean; logout: () => Promise<void> }
const Ctx = createContext<AuthState>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token was provided in the URL query string
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        localStorage.setItem("auth_token", token);
        params.delete("token");
        const remainingQuery = params.toString();
        const cleanedUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : "") + window.location.hash;
        window.history.replaceState({}, document.title, cleanedUrl);
      }
    } catch {}

    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem("auth_token");
    setUser(null);
  };
  return <Ctx.Provider value={{ user, loading, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
