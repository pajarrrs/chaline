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
  isAddFriendModalOpen: boolean;
  setIsAddFriendModalOpen: (open: boolean) => void;
  profileModalUser: User | null;
  setProfileModalUser: (user: User | null) => void;
  selectConversation: (conv: Conversation | null) => void;
  startChatWithFriend: (friendUser: User) => Promise<void>;
  sendMessage: (content: string, type?: "TEXT" | "STICKER" | "IMAGE", mediaUrl?: string) => Promise<void>;
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
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);

  const prevLastMessageIdRef = useRef<string | null>(null);
  const prevUnreadCountRef = useRef<number>(0);

  // Initialize audio sound on mount
  useEffect(() => {
    initNotificationSound();
  }, []);

  const enableNotifications = async () => {
    initNotificationSound();
    playNotificationSound();
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
          playNotificationSound();
          const unreadChat = newConversations.find((c) => (c.unreadCount || 0) > 0);
          if (unreadChat && unreadChat.lastMessage) {
            const sender = unreadChat.lastMessage.sender;
            showBrowserNotification(`Chaline • ${sender.name}`, {
              body:
                unreadChat.lastMessage.type === "STICKER"
                  ? "✨ Sent a sticker"
                  : unreadChat.lastMessage.type === "IMAGE"
                  ? "📷 Sent a photo"
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

        // Check if a new message from other user arrived
        if (newMessages.length > 0) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (
            prevLastMessageIdRef.current &&
            lastMsg.id !== prevLastMessageIdRef.current &&
            lastMsg.senderId !== user?.id
          ) {
            playNotificationSound();
            showBrowserNotification(`Chaline • ${lastMsg.sender.name}`, {
              body:
                lastMsg.type === "STICKER"
                  ? "✨ Sent a sticker"
                  : lastMsg.type === "IMAGE"
                  ? "📷 Sent a photo"
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
  }, [user?.id]);

  // Polling for live chat updates every 2.5s
  useEffect(() => {
    if (!user) return;
    refreshConversations();
    refreshFriends();

    const interval = setInterval(() => {
      refreshConversations();
      if (activeConversation) {
        fetchActiveMessages(activeConversation.id, false);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [user, activeConversation, refreshConversations, refreshFriends, fetchActiveMessages]);

  const selectConversation = (conv: Conversation | null) => {
    setActiveConversation(conv);
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
    }
  };

  const sendMessage = async (
    content: string,
    type: "TEXT" | "STICKER" | "IMAGE" = "TEXT",
    mediaUrl?: string
  ) => {
    if (!activeConversation || (!content.trim() && !mediaUrl)) return;

    try {
      // Optimistic message UI
      const tempMessage: Message = {
        id: `temp_${Date.now()}`,
        conversationId: activeConversation.id,
        senderId: user!.id,
        content: content.trim() || (type === "STICKER" ? "[Sticker]" : "[Image]"),
        type,
        mediaUrl: mediaUrl || null,
        createdAt: new Date().toISOString(),
        sender: {
          id: user!.id,
          lineId: user!.lineId,
          name: user!.name,
          avatar: user!.avatar,
        },
      };

      setMessages((prev) => [...prev, tempMessage]);
      prevLastMessageIdRef.current = tempMessage.id;

      const res = await fetch(
        `/api/conversations/${activeConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim(), type, mediaUrl }),
        }
      );

      if (res.ok) {
        const data = await res.json();
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
