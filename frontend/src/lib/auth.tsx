import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { TokenResponse, UserOut } from "./types";

interface AuthState {
  user: UserOut | null;
  permissions: string[];
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = "gokulam.user";
const PERMS_KEY = "gokulam.perms";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore session from localStorage so the app works offline on reload.
    const rawUser = localStorage.getItem(USER_KEY);
    const rawPerms = localStorage.getItem(PERMS_KEY);
    if (rawUser && tokenStore.access) {
      setUser(JSON.parse(rawUser));
      setPermissions(rawPerms ? JSON.parse(rawPerms) : []);
    }
    setReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<TokenResponse>("/auth/login", { email, password });
    tokenStore.set(data);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions));
    setUser(data.user);
    setPermissions(data.permissions);
  };

  const logout = () => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMS_KEY);
    setUser(null);
    setPermissions([]);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      permissions,
      ready,
      login,
      logout,
      can: (permission: string) => permissions.includes(permission),
    }),
    [user, permissions, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
