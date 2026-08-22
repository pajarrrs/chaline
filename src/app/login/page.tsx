"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, ArrowRight, Lock, User, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const { login } = useAuth();
  const [lineId, setLineId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!lineId.trim() || !password) {
      setError("Please fill in your LINE ID and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId: lineId.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to log in.");
      } else {
        login(data.user);
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#F2F5F8] dark:bg-[#0D0E13] transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#181A22] rounded-3xl shadow-xl border border-black/[0.06] dark:border-white/[0.08] p-8 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
        {/* LINE Brand Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-[#06C755] text-white flex items-center justify-center shadow-lg shadow-[#06C755]/30">
            <MessageSquare className="w-9 h-9 fill-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white mt-1">
            Chaline Messenger
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
            Sign in to start live chatting with friends
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Chaline ID
            </label>
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
              <User className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="e.g. alex_chaline"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
                autoCapitalize="none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
              <Lock className="w-4 h-4 text-neutral-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#06C755] hover:bg-[#05B04B] text-white font-bold text-xs shadow-lg shadow-[#06C755]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Log In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Register CTA */}
        <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          <span>Don&apos;t have an account?</span>
          <Link
            href="/register"
            className="font-bold text-[#06C755] hover:underline"
          >
            Sign up now
          </Link>
        </div>
      </div>
    </div>
  );
}
