"use client";

import React, { useState } from "react";
import { X, Search, UserPlus, Check, AlertCircle, Loader2 } from "lucide-react";
import { useChat } from "@/context/ChatContext";

export function AddFriendModal() {
  const {
    isAddFriendModalOpen,
    setIsAddFriendModalOpen,
    addFriendByLineId,
    startChatWithFriend,
  } = useChat();

  const [lineIdInput, setLineIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!isAddFriendModalOpen) return null;

  const handleSearchAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineIdInput.trim()) return;

    setLoading(true);
    setResultMessage(null);

    const res = await addFriendByLineId(lineIdInput.trim());
    setLoading(false);

    if (res.success) {
      setResultMessage({
        type: "success",
        text: `Successfully added ${res.friend?.name} as a friend!`,
      });
      setLineIdInput("");
    } else {
      setResultMessage({
        type: "error",
        text: res.message || "User not found or already added.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-[#1C1E28] rounded-3xl p-6 shadow-2xl border border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#06C755]" />
            <h3 className="font-black text-base text-neutral-900 dark:text-white">
              Add Friend by Chaline ID
            </h3>
          </div>
          <button
            onClick={() => {
              setIsAddFriendModalOpen(false);
              setResultMessage(null);
            }}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-white/[0.1] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input search */}
        <form onSubmit={handleSearchAndAdd} className="flex flex-col gap-3">
          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
            Enter Friend&apos;s Chaline ID
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus-within:border-[#06C755] transition-colors">
              <Search className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="e.g. user_b"
                value={lineIdInput}
                onChange={(e) => setLineIdInput(e.target.value)}
                className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
                autoCapitalize="none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !lineIdInput.trim()}
              className="px-5 py-2.5 rounded-2xl bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold transition-all shadow-md shadow-[#06C755]/20 disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Result notification */}
        {resultMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
              resultMessage.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
            }`}
          >
            {resultMessage.type === "success" ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{resultMessage.text}</span>
          </div>
        )}

        {/* Tip helper */}
        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
          💡 <span className="font-semibold">Tip:</span> Ask your friends for their unique Chaline ID. Once added, you can start direct messaging instantly.
        </div>
      </div>
    </div>
  );
}
