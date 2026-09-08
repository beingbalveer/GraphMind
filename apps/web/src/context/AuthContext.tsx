"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";

export interface User {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  provider: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await apiFetch<{ user?: User; [key: string]: any }>("/auth/me");
      const u = data.user || data;
      if (!u || !u.id) {
        setUser(null);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = u as any;
      setUser({
        id: raw.id,
        email: raw.email,
        fullName: raw.fullName ?? raw.full_name ?? null,
        avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
        provider: raw.provider || "email",
        isActive: raw.isActive ?? raw.is_active ?? true,
        createdAt: raw.createdAt ?? raw.created_at,
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const u = data.user;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = u as any;
    setUser({
      id: u.id,
      email: u.email,
      fullName: u.fullName ?? raw.full_name ?? null,
      avatarUrl: u.avatarUrl ?? raw.avatar_url ?? null,
      provider: u.provider || "email",
      isActive: u.isActive ?? raw.is_active ?? true,
      createdAt: u.createdAt ?? raw.created_at,
    });
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const data = await apiFetch<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName: fullName || undefined }),
    });
    const u = data.user;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = u as any;
    setUser({
      id: u.id,
      email: u.email,
      fullName: u.fullName ?? raw.full_name ?? null,
      avatarUrl: u.avatarUrl ?? raw.avatar_url ?? null,
      provider: u.provider || "email",
      isActive: u.isActive ?? raw.is_active ?? true,
      createdAt: u.createdAt ?? raw.created_at,
    });
  };

  const loginWithGoogle = async (idToken: string) => {
    const data = await apiFetch<{ user: User }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    const u = data.user;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = u as any;
    setUser({
      id: u.id,
      email: u.email,
      fullName: u.fullName ?? raw.full_name ?? null,
      avatarUrl: u.avatarUrl ?? raw.avatar_url ?? null,
      provider: u.provider || "google",
      isActive: u.isActive ?? raw.is_active ?? true,
      createdAt: u.createdAt ?? raw.created_at,
    });
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
