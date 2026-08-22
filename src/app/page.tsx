"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { MainRail } from "@/components/sidebar/MainRail";
import { FriendsList } from "@/components/sidebar/FriendsList";
import { ChatsList } from "@/components/sidebar/ChatsList";
import { ChatArea } from "@/components/chat/ChatArea";
import { AddFriendModal } from "@/components/sidebar/AddFriendModal";
import { UserProfileModal } from "@/components/sidebar/UserProfileModal";
import { Loader2 } from "lucide-react";

export default function HomeDashboard() {
  const { user, loading } = useAuth();
  const { activeTab, activeConversation, selectConversation } = useChat();

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#F2F5F8] dark:bg-[#0D0E13] text-[#06C755] gap-3">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
          Connecting to Chaline...
        </span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="h-[100dvh] w-full max-w-[100vw] flex overflow-hidden bg-background relative">
      {/* 1. Navigation Rail (Left on Desktop, Bottom on Mobile) */}
      <MainRail />

      {/* 2. Middle List Column (Friends / Chats) */}
      <section
        className={`w-full md:w-80 lg:w-96 h-full flex-1 md:flex-initial min-h-0 ${
          activeConversation ? "hidden md:flex" : "flex"
        }`}
      >
        {activeTab === "friends" ? <FriendsList /> : <ChatsList />}
      </section>

      {/* 3. Right Active Chat Area */}
      <section
        className={`w-full md:w-auto md:flex-1 h-full min-h-0 ${
          activeConversation ? "fixed inset-0 z-30 md:static md:inset-auto flex" : "hidden md:flex"
        }`}
      >
        <ChatArea onBackMobile={() => selectConversation(null)} />
      </section>

      {/* Modals */}
      <AddFriendModal />
      <UserProfileModal />
    </main>
  );
}
