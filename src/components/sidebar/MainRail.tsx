"use client";

import React from "react";
import {
  Users,
  MessageSquare,
  UserPlus,
  LogOut,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useTheme } from "next-themes";

export function MainRail() {
  const { user, logout } = useAuth();
  const {
    activeTab,
    setActiveTab,
    setIsAddFriendModalOpen,
    setProfileModalUser,
    conversations,
    activeConversation,
  } = useChat();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  // Calculate total unread count
  const totalUnread = conversations.reduce(
    (acc, curr) => acc + (curr.unreadCount || 0),
    0
  );

  return (
    <>
      {/* 1. Desktop Left Icon Navigation Rail */}
      <aside className="hidden md:flex w-16 sm:w-18 h-full bg-[#242736] dark:bg-[#121319] flex-col items-center justify-between py-5 border-r border-black/[0.08] dark:border-white/[0.06] flex-shrink-0 select-none z-30">
        {/* Top Rail: Avatar & Main Tabs */}
        <div className="flex flex-col items-center gap-6 w-full">
          {/* User Profile Avatar */}
          <button
            onClick={() => setProfileModalUser(user)}
            className="relative w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-[#06C755] hover:scale-105 transition-all shadow-md flex-shrink-0"
            title="My Profile"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Me"}
              alt={user?.name || "Me"}
              className="w-full h-full object-cover bg-neutral-800"
            />
          </button>

          {/* Navigation Icons */}
          <div className="flex flex-col items-center gap-3 w-full px-2">
            {/* Friends Tab */}
            <button
              onClick={() => setActiveTab("friends")}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === "friends"
                  ? "bg-[#06C755] text-white shadow-lg shadow-[#06C755]/30"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.08]"
              }`}
              title="Friends"
            >
              <Users className="w-5 h-5" />
            </button>

            {/* Chats Tab */}
            <button
              onClick={() => setActiveTab("chats")}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === "chats"
                  ? "bg-[#06C755] text-white shadow-lg shadow-[#06C755]/30"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.08]"
              }`}
              title="Chats"
            >
              <MessageSquare className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#242736] dark:ring-[#121319]">
                  {totalUnread}
                </span>
              )}
            </button>

            {/* Add Friend (+) */}
            <button
              onClick={() => setIsAddFriendModalOpen(true)}
              className="w-11 h-11 rounded-2xl text-neutral-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-all"
              title="Add Friend by Chaline ID"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Rail: Theme toggle & Logout */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-10 h-10 rounded-2xl text-neutral-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-all"
            title={isDark ? "Light Mode" : "Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-300" />
            )}
          </button>

          <button
            onClick={logout}
            className="w-10 h-10 rounded-2xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* 2. Mobile Bottom Navigation Bar (Shown on mobile when list is visible) */}
      {!activeConversation && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#121319]/95 backdrop-blur-xl border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-around z-40 select-none px-4">
          {/* Friends Button */}
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === "friends"
                ? "text-[#06C755] font-bold"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Friends</span>
          </button>

          {/* Chats Button */}
          <button
            onClick={() => setActiveTab("chats")}
            className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === "chats"
                ? "text-[#06C755] font-bold"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <span className="text-[10px]">Chats</span>
          </button>

          {/* Add Friend Button */}
          <button
            onClick={() => setIsAddFriendModalOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-[#06C755] transition-all"
          >
            <UserPlus className="w-5 h-5" />
            <span className="text-[10px]">Add Friend</span>
          </button>

          {/* Profile Button */}
          <button
            onClick={() => setProfileModalUser(user)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-neutral-500 dark:text-neutral-400"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-[#06C755]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Me"}
                alt="Me"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[10px]">Profile</span>
          </button>
        </nav>
      )}
    </>
  );
}
