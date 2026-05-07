import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, login as apiLogin, type login as LoginFn } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  plan?: string;
  timezone?: string;
  ownerId: string | null;    // set if this user is a team member
  memberRole: string | null; // 'admin' | 'analyst' | 'viewer' | null
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setTimezone: (tz: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("nexus_token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem("nexus_token");
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("nexus_token", newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("nexus_token");
    setToken(null);
    setUser(null);
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setUser(prev => prev ? { ...prev, timezone: tz } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      logout,
      setTimezone,
      role: user?.role || null,
      isAdmin: user?.role === "SUPER_ADMIN"
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
