"use client";

import React, { useState } from "react";
import { Search, MessageSquare, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";

export function ChatsList() {
  const { user } = useAuth();
  const {
    conversations,
    activeConversation,
    selectConversation,
    setActiveTab,
  } = useChat();
  const [search, setSearch] = useState("");

  const filteredConversations = conversations.filter((conv) => {
    const otherParticipant = conv.participants.find(
      (p) => p.userId !== user?.id
    );
    if (!otherParticipant) return false;

    const q = search.toLowerCase();
    return (
      otherParticipant.user.name.toLowerCase().includes(q) ||
      otherParticipant.user.lineId.toLowerCase().includes(q) ||
      conv.lastMessage?.content.toLowerCase().includes(q)
    );
  });

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#181A22] border-r border-black/[0.06] dark:border-white/[0.08] select-none">
      {/* Top Header */}
      <div className="p-4 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.05]">
        <h2 className="text-lg font-black text-neutral-900 dark:text-white">
          Chats
        </h2>
        <button
          onClick={() => setActiveTab("friends")}
          className="p-2 rounded-xl text-neutral-500 hover:text-[#06C755] hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors"
          title="Start New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
          <Search className="w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search messages or names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
        {filteredConversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-400 gap-3">
            <MessageSquare className="w-10 h-10 text-[#06C755] opacity-50" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                No active chats
              </p>
              <p className="text-[11px]">
                Choose a friend from your list to start chatting!
              </p>
            </div>
            <button
              onClick={() => setActiveTab("friends")}
              className="mt-1 px-4 py-2 rounded-xl bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold transition-all shadow-md shadow-[#06C755]/20"
            >
              Go to Friends
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const otherParticipant = conv.participants.find(
              (p) => p.userId !== user?.id
            );
            const otherUser = otherParticipant?.user;
            const isSelected = activeConversation?.id === conv.id;

            return (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-3 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-[#06C755]/10 dark:bg-[#06C755]/20 border border-[#06C755]/30"
                    : "hover:bg-neutral-100 dark:hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/[0.08] dark:ring-white/[0.1]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        otherUser?.avatar ||
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Friend"
                      }
                      alt={otherUser?.name || "Chat"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {otherUser?.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono flex-shrink-0">
                        {formatMessageTime(
                          conv.lastMessage?.createdAt || conv.updatedAt
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {conv.lastMessage
                          ? conv.lastMessage.type === "STICKER"
                            ? "✨ [Sticker]"
                            : conv.lastMessage.type === "IMAGE"
                            ? "📷 [Photo]"
                            : conv.lastMessage.content
                          : "No messages yet"}
                      </span>

                      {conv.unreadCount && conv.unreadCount > 0 ? (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#06C755] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
