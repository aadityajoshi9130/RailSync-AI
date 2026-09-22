"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: "CENTRAL_CONTROLLER" | "ENGINEERING" | "OHE_TRACTION" | "SIGNALING_TELECOM" | "SYSTEM_ADMIN" | string;
  department_id: number | null;
  department_name: string | null;
  active: number;
  created_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (username: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on initial mount
  useEffect(() => {
    const savedToken = localStorage.getItem("railsync_token");
    const savedUser = localStorage.getItem("railsync_user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        // Verify with backend
        fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((res) => {
            if (res.ok) {
              return res.json();
            } else {
              throw new Error("Session expired");
            }
          })
          .then((freshUser) => {
            setUser(freshUser);
            localStorage.setItem("railsync_user", JSON.stringify(freshUser));
          })
          .catch(() => {
            // Token invalid or expired
            localStorage.removeItem("railsync_token");
            localStorage.removeItem("railsync_user");
            setToken(null);
            setUser(null);
          })
          .finally(() => setIsLoading(false));
      } catch {
        localStorage.removeItem("railsync_token");
        localStorage.removeItem("railsync_user");
        setToken(null);
        setUser(null);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.detail || "Authentication failed. Please check credentials.",
        };
      }

      const data = await res.json();
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("railsync_token", data.access_token);
      localStorage.setItem("railsync_user", JSON.stringify(data.user));
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to Railway Authentication Gateway." };
    }
  }, []);

  const quickLogin = useCallback(async (username: string) => {
    return login(username, "railpass123");
  }, [login]);

  const logout = useCallback(() => {
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("railsync_token");
    localStorage.removeItem("railsync_user");
    setToken(null);
    setUser(null);
  }, [token]);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        quickLogin,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
