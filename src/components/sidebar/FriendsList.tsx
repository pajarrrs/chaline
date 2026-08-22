"use client";

import React, { useState } from "react";
import { Search, UserPlus, MessageSquare, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";

export function FriendsList() {
  const { user } = useAuth();
  const {
    friends,
    startChatWithFriend,
    setIsAddFriendModalOpen,
    setProfileModalUser,
  } = useChat();
  const [search, setSearch] = useState("");

  const filteredFriends = friends.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.friend.name.toLowerCase().includes(q) ||
      f.friend.lineId.toLowerCase().includes(q) ||
      f.friend.statusMessage?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#181A22] border-r border-black/[0.06] dark:border-white/[0.08] select-none">
      {/* Top Header */}
      <div className="p-4 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.05]">
        <h2 className="text-lg font-black text-neutral-900 dark:text-white">
          Friends
        </h2>
        <button
          onClick={() => setIsAddFriendModalOpen(true)}
          className="p-2 rounded-xl text-neutral-500 hover:text-[#06C755] hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors"
          title="Add Friend"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
          <Search className="w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search friends by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-4">
        {/* User's own card */}
        {user && (
          <div
            onClick={() => setProfileModalUser(user)}
            className="p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-3 border border-black/[0.04] dark:border-white/[0.04]"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#06C755] flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Me"}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  @{user.lineId}
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                {user.statusMessage || "Available on Chaline"}
              </span>
            </div>
          </div>
        )}

        {/* Friends Count Label */}
        <div className="flex items-center justify-between px-2 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
          <span>Friends ({filteredFriends.length})</span>
        </div>

        {/* Friends List */}
        {filteredFriends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-400 gap-3">
            <Sparkles className="w-10 h-10 text-[#06C755] opacity-50" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                No friends added yet
              </p>
              <p className="text-[11px]">
                Search friends by their unique Chaline ID to start chatting.
              </p>
            </div>
            <button
              onClick={() => setIsAddFriendModalOpen(true)}
              className="mt-1 px-4 py-2 rounded-xl bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold transition-all shadow-md shadow-[#06C755]/20 flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Friend</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredFriends.map((f) => (
              <div
                key={f.id}
                className="p-2.5 rounded-2xl hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-between group"
              >
                <div
                  onClick={() => setProfileModalUser(f.friend)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-black/[0.08] dark:ring-white/[0.1] flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.friend.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Friend"}
                      alt={f.friend.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                      {f.friend.name}
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      {f.friend.statusMessage || "Available on Chaline"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => startChatWithFriend(f.friend)}
                  className="p-2 rounded-xl bg-neutral-100 dark:bg-white/[0.06] hover:bg-[#06C755] hover:text-white text-neutral-600 dark:text-neutral-300 transition-all opacity-0 group-hover:opacity-100"
                  title="Chat"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
