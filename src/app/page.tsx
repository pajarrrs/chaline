"use client";

import React, { useState } from "react";
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F2F5F8] dark:bg-[#0D0E13] text-[#06C755] gap-3">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
          Connecting to Chaline...
        </span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      {/* 1. Left Icon Navigation Rail */}
      <MainRail />

      {/* 2. Middle List Column (Friends or Chats) */}
      <div
        className={`w-full md:w-80 lg:w-96 h-full flex-shrink-0 ${
          activeConversation ? "hidden md:flex" : "flex"
        }`}
      >
        {activeTab === "friends" ? <FriendsList /> : <ChatsList />}
      </div>

      {/* 3. Right Active Chat Area */}
      <div
        className={`flex-1 h-full ${
          activeConversation ? "flex" : "hidden md:flex"
        }`}
      >
        <ChatArea
          onBackMobile={() => selectConversation(null)}
        />
      </div>

      {/* Modals */}
      <AddFriendModal />
      <UserProfileModal />
    </div>
  );
}
