"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Conversation, Friend, Message, User } from "@/types/line";
import { useAuth } from "./AuthContext";
import {
  initNotificationSound,
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/notification";

interface ChatContextType {
  activeTab: "chats" | "friends";
  setActiveTab: (tab: "chats" | "friends") => void;
  conversations: Conversation[];
  friends: Friend[];
  activeConversation: Conversation | null;
  messages: Message[];
  loadingMessages: boolean;
  isStartingChat: boolean;
  isAddFriendModalOpen: boolean;
  setIsAddFriendModalOpen: (open: boolean) => void;
  profileModalUser: User | null;
  setProfileModalUser: (user: User | null) => void;
  selectConversation: (conv: Conversation | null) => void;
  startChatWithFriend: (friendUser: User) => Promise<void>;
  sendMessage: (
    content: string,
    type?: "TEXT" | "STICKER" | "IMAGE" | "AUDIO",
    mediaUrl?: string,
    replyToId?: string,
    replyToPreview?: Message["replyTo"]
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  addFriendByLineId: (lineId: string) => Promise<{ success: boolean; message?: string; friend?: User }>;
  enableNotifications: () => Promise<boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"chats" | "friends">("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);

  const prevLastMessageIdRef = useRef<string | null>(null);
  const prevUnreadCountRef = useRef<number>(0);
  const activeConvIdRef = useRef<string | null>(null);
  const isStartingChatLockRef = useRef<boolean>(false);
  const sentMessageIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    currentUserIdRef.current = user?.id || null;
  }, [user]);

  useEffect(() => {
    activeConvIdRef.current = activeConversation?.id || null;
  }, [activeConversation]);

  // Initialize audio sound on mount
  useEffect(() => {
    initNotificationSound();
  }, []);

  const enableNotifications = async () => {
    initNotificationSound();
    return await requestNotificationPermission();
  };

  // Fetch Conversations
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const newConversations: Conversation[] = data.conversations || [];
        setConversations(newConversations);

        // Check if unread count increased from background chat
        const currentTotalUnread = newConversations.reduce(
          (acc, curr) => acc + (curr.unreadCount || 0),
          0
        );

        if (currentTotalUnread > prevUnreadCountRef.current) {
          const unreadChat = newConversations.find(
            (c) =>
              (c.unreadCount || 0) > 0 &&
              c.lastMessage &&
              c.lastMessage.senderId !== currentUserIdRef.current &&
              !sentMessageIdsRef.current.has(c.lastMessage.id)
          );

          if (unreadChat && unreadChat.lastMessage) {
            playNotificationSound();
            const sender = unreadChat.lastMessage.sender;
            showBrowserNotification(`Chaline • ${sender.name}`, {
              body:
                unreadChat.lastMessage.type === "STICKER"
                  ? "✨ Sent a sticker"
                  : unreadChat.lastMessage.type === "IMAGE"
                  ? "📷 Sent a photo"
                  : unreadChat.lastMessage.type === "AUDIO"
                  ? "🎤 Sent a voice note"
                  : unreadChat.lastMessage.content,
              icon: sender.avatar || "/icons/icon-192x192.png",
            });
          }
        }
        prevUnreadCountRef.current = currentTotalUnread;
      }
    } catch (e) {
      console.error("Error loading conversations:", e);
    }
  }, [user]);

  // Fetch Friends
  const refreshFriends = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (e) {
      console.error("Error loading friends:", e);
    }
  }, [user]);

  // Fetch Messages for active conversation
  const fetchActiveMessages = useCallback(async (convId: string, showLoader = false) => {
    if (showLoader) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const newMessages: Message[] = data.messages || [];
        setMessages(newMessages);

        // Check if a new incoming message from OTHER user arrived
        if (newMessages.length > 0) {
          const lastMsg = newMessages[newMessages.length - 1];
          const isFromOther =
            lastMsg.senderId !== currentUserIdRef.current &&
            !sentMessageIdsRef.current.has(lastMsg.id);

          if (
            prevLastMessageIdRef.current &&
            lastMsg.id !== prevLastMessageIdRef.current &&
            isFromOther
          ) {
            playNotificationSound();
            showBrowserNotification(`Chaline • ${lastMsg.sender.name}`, {
              body:
                lastMsg.type === "STICKER"
                  ? "✨ Sent a sticker"
                  : lastMsg.type === "IMAGE"
                  ? "📷 Sent a photo"
                  : lastMsg.type === "AUDIO"
                  ? "🎤 Sent a voice note"
                  : lastMsg.content,
              icon: lastMsg.sender.avatar || "/icons/icon-192x192.png",
            });
          }
          prevLastMessageIdRef.current = lastMsg.id;
        }
      }
    } catch (e) {
      console.error("Error fetching messages:", e);
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  }, []);

  // Fast Real-time Polling every 1.2 seconds + Focus listener
  useEffect(() => {
    if (!user) return;
    refreshConversations();
    refreshFriends();

    const doPoll = () => {
      refreshConversations();
      if (activeConvIdRef.current) {
        fetchActiveMessages(activeConvIdRef.current, false);
      }
    };

    const interval = setInterval(doPoll, 1200);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        doPoll();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [user, refreshConversations, refreshFriends, fetchActiveMessages]);

  const selectConversation = (conv: Conversation | null) => {
    setActiveConversation(conv);
    activeConvIdRef.current = conv?.id || null;
    if (!conv) {
      setMessages([]);
      prevLastMessageIdRef.current = null;
      return;
    }
    fetchActiveMessages(conv.id, true);
    // Mark as read in state
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const startChatWithFriend = async (friendUser: User) => {
    if (isStartingChatLockRef.current) return;
    isStartingChatLockRef.current = true;
    setIsStartingChat(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: friendUser.id }),
      });

      if (res.ok) {
        const data = await res.json();
        await refreshConversations();
        selectConversation(data.conversation);
        setActiveTab("chats");
      }
    } catch (e) {
      console.error("Failed to start chat:", e);
    } finally {
      isStartingChatLockRef.current = false;
      setIsStartingChat(false);
    }
  };

  const sendMessage = async (
    content: string,
    type: "TEXT" | "STICKER" | "IMAGE" | "AUDIO" = "TEXT",
    mediaUrl?: string,
    replyToId?: string,
    replyToPreview?: Message["replyTo"]
  ) => {
    if (!activeConversation || (!content.trim() && !mediaUrl)) return;

    try {
      // Optimistic message UI
      const tempMessage: Message = {
        id: `temp_${Date.now()}`,
        conversationId: activeConversation.id,
        senderId: user!.id,
        content:
          content.trim() ||
          (type === "STICKER"
            ? "[Sticker]"
            : type === "AUDIO"
            ? "[Voice Message]"
            : "[Image]"),
        type,
        mediaUrl: mediaUrl || null,
        replyToId: replyToId || null,
        replyTo: replyToPreview || null,
        createdAt: new Date().toISOString(),
        sender: {
          id: user!.id,
          lineId: user!.lineId,
          name: user!.name,
          avatar: user!.avatar,
        },
      };

      sentMessageIdsRef.current.add(tempMessage.id);
      setMessages((prev) => [...prev, tempMessage]);
      prevLastMessageIdRef.current = tempMessage.id;

      const res = await fetch(
        `/api/conversations/${activeConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(),
            type,
            mediaUrl,
            replyToId,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        sentMessageIdsRef.current.add(data.message.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? data.message : m))
        );
        prevLastMessageIdRef.current = data.message.id;
        refreshConversations();
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  };

  const addFriendByLineId = async (lineId: string) => {
    try {
      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLineId: lineId }),
      });

      const data = await res.json();
      if (res.ok) {
        await refreshFriends();
        return { success: true, friend: data.friend };
      } else {
        return { success: false, message: data.error || "Failed to add friend" };
      }
    } catch {
      return { success: false, message: "Network error occurred." };
    }
  };

  return (
    <ChatContext.Provider
      value={{
        activeTab,
        setActiveTab,
        conversations,
        friends,
        activeConversation,
        messages,
        loadingMessages,
        isStartingChat,
        isAddFriendModalOpen,
        setIsAddFriendModalOpen,
        profileModalUser,
        setProfileModalUser,
        selectConversation,
        startChatWithFriend,
        sendMessage,
        refreshConversations,
        refreshFriends,
        addFriendByLineId,
        enableNotifications,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
