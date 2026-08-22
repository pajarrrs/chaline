"use client";

import React from "react";
import {
  Users,
  MessageSquare,
  UserPlus,
  LogOut,
  Moon,
  Sun,
  Settings,
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
  } = useChat();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  // Calculate total unread count
  const totalUnread = conversations.reduce(
    (acc, curr) => acc + (curr.unreadCount || 0),
    0
  );

  return (
    <div className="w-16 sm:w-18 h-screen bg-[#242736] dark:bg-[#121319] flex flex-col items-center justify-between py-5 border-r border-black/[0.08] dark:border-white/[0.06] flex-shrink-0 select-none z-30">
      {/* Top Rail: Avatar & Main Tabs */}
      <div className="flex flex-col items-center gap-6 w-full">
        {/* User Profile Avatar (Clickable to open profile card) */}
        <button
          onClick={() => setProfileModalUser(user)}
          className="relative w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-[#06C755] hover:scale-105 transition-all shadow-md"
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
        {/* Dark/Light toggle */}
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

        {/* Logout */}
        <button
          onClick={logout}
          className="w-10 h-10 rounded-2xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
          title="Log Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
