"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@/types/line";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          try {
            localStorage.setItem("chaline_user", JSON.stringify(data.user));
          } catch {}
        } else {
          setUser(null);
          try {
            localStorage.removeItem("chaline_user");
          } catch {}
        }
      } else {
        setUser(null);
        try {
          localStorage.removeItem("chaline_user");
        } catch {}
      }
    } catch {
      // Keep cached user on offline/temporary network blip
    } finally {
      setLoading(false);
    }
  };

  // Hydrate from localStorage on client mount, then refresh
  useEffect(() => {
    try {
      const cached = localStorage.getItem("chaline_user");
      if (cached) {
        setUser(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}
    refreshUser();
  }, []);

  // Protect routes: redirect to login if unauthenticated
  useEffect(() => {
    if (loading) return;
    const isAuthPage = pathname === "/login" || pathname === "/register";

    if (!user && !isAuthPage) {
      router.push("/login");
    } else if (user && isAuthPage) {
      router.push("/");
    }
  }, [user, loading, pathname, router]);

  const login = (userData: User) => {
    setUser(userData);
    try {
      localStorage.setItem("chaline_user", JSON.stringify(userData));
    } catch {}
    router.push("/");
  };

  const logout = async () => {
    try {
      localStorage.removeItem("chaline_user");
      localStorage.removeItem("chaline_cache_convs");
      localStorage.removeItem("chaline_cache_friends");
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
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
