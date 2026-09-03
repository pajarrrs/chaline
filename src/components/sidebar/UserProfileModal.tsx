"use client";

import React from "react";
import { X, MessageSquare, Sparkles, User as UserIcon, Video } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useCall } from "@/context/CallContext";

export function UserProfileModal() {
  const { user: currentUser } = useAuth();
  const {
    profileModalUser,
    setProfileModalUser,
    startChatWithFriend,
  } = useChat();
  const { startCall } = useCall();

  if (!profileModalUser) return null;

  const isSelf = profileModalUser.id === currentUser?.id;

  const handleStartChat = () => {
    startChatWithFriend(profileModalUser);
    setProfileModalUser(null);
  };

  const handleVideoCall = () => {
    if (profileModalUser) {
      startCall(
        {
          id: profileModalUser.id,
          name: profileModalUser.name,
          lineId: profileModalUser.lineId,
          avatar: profileModalUser.avatar,
        },
        true
      );
      setProfileModalUser(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-[#1C1E28] rounded-3xl overflow-hidden shadow-2xl border border-black/[0.06] dark:border-white/[0.08] flex flex-col items-center animate-in zoom-in-95 duration-200">
        {/* Cover Header Banner */}
        <div className="w-full h-28 bg-gradient-to-r from-[#06C755] to-emerald-400 relative">
          <button
            onClick={() => setProfileModalUser(null)}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="-mt-14 relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-white dark:ring-[#1C1E28] bg-neutral-900 shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              profileModalUser.avatar ||
              "https://api.dicebear.com/7.x/bottts/svg?seed=Profile"
            }
            alt={profileModalUser.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Profile Info */}
        <div className="p-6 w-full flex flex-col items-center text-center gap-3">
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-black text-neutral-900 dark:text-white">
              {profileModalUser.name}
            </h3>
            <span className="text-xs font-mono font-bold text-[#06C755] mt-0.5">
              ID: @{profileModalUser.lineId}
            </span>
          </div>

          <div className="w-full p-3 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04]">
            <span className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed italic">
              &quot;{profileModalUser.statusMessage || "Available on Chaline"}&quot;
            </span>
          </div>

          {!isSelf && (
            <div className="w-full flex gap-2 mt-2">
              <button
                onClick={handleStartChat}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#06C755] hover:bg-[#05B04B] text-white font-bold text-xs shadow-lg shadow-[#06C755]/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
              <button
                onClick={handleVideoCall}
                className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900 dark:bg-white/10 hover:bg-neutral-800 dark:hover:bg-white/20 text-white font-bold text-xs border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Video className="w-4 h-4 text-[#06C755]" />
                <span>Video Call</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
