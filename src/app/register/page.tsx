"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, ArrowRight, Lock, User, AlertCircle, Loader2, Smile, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const AVATAR_PRESETS = [
  { label: "Brown", url: "https://api.dicebear.com/7.x/bottts/svg?seed=BrownBear" },
  { label: "Cony", url: "https://api.dicebear.com/7.x/bottts/svg?seed=ConyRabbit" },
  { label: "Sally", url: "https://api.dicebear.com/7.x/bottts/svg?seed=SallyDuck" },
  { label: "Moon", url: "https://api.dicebear.com/7.x/bottts/svg?seed=MoonSmile" },
  { label: "Cyber", url: "https://api.dicebear.com/7.x/bottts/svg?seed=CyberUser" },
];

export default function RegisterPage() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [lineId, setLineId] = useState("");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("Available on Chaline");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0].url);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !lineId.trim() || !password) {
      setError("Please fill in your name, Chaline ID, and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          lineId: lineId.trim(),
          password,
          avatar: selectedAvatar,
          statusMessage: statusMessage.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account.");
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

      <div className="w-full max-w-lg bg-white dark:bg-[#181A22] rounded-3xl shadow-xl border border-black/[0.06] dark:border-white/[0.08] p-8 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-[#06C755] text-white flex items-center justify-center shadow-lg shadow-[#06C755]/30">
            <MessageSquare className="w-8 h-8 fill-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white mt-1">
            Create Chaline Account
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
            Register your unique Chaline ID to connect with friends
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Avatar Selector */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
              Choose Avatar
            </span>
            <div className="flex items-center gap-3">
              {AVATAR_PRESETS.map((av) => (
                <button
                  key={av.label}
                  type="button"
                  onClick={() => setSelectedAvatar(av.url)}
                  className={`w-11 h-11 rounded-full p-0.5 border-2 transition-all ${
                    selectedAvatar === av.url
                      ? "border-[#06C755] scale-110 shadow-md"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={av.url}
                      alt={av.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Chaline ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Display Name
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
                <Smile className="w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Chaline ID (Unique)
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
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
          </div>

          {/* Status Message */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Status Message (Bio)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
              <Sparkles className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Hey there! I am using Chaline."
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
              <Lock className="w-4 h-4 text-neutral-400" />
              <input
                type="password"
                placeholder="Create a strong password"
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
                <span>Sign Up & Start Chatting</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Back to Login */}
        <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          <span>Already registered?</span>
          <Link
            href="/login"
            className="font-bold text-[#06C755] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
