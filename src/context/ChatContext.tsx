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
import { supabase } from "@/lib/supabase";

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

  const activeConvIdRef = useRef<string | null>(null);
  const isStartingChatLockRef = useRef<boolean>(false);
  const sentMessageIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

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

  // Fetch Conversations (Initial Load & when tab is refocused)
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const newConversations: Conversation[] = data.conversations || [];
        setConversations(newConversations);

        if (activeConvIdRef.current) {
          const matched = newConversations.find(
            (c) => c.id === activeConvIdRef.current
          );
          if (matched) {
            setActiveConversation((prev) => (prev ? { ...prev, ...matched } : matched));
          }
        }
      }
    } catch (e) {
      console.error("Error loading conversations:", e);
    }
  }, [user]);

  // Fetch Friends (Initial Load)
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

  // Fetch Messages for active conversation (Only called ONCE when clicking / opening a conversation)
  const fetchActiveMessages = useCallback(async (convId: string, showLoader = true) => {
    if (showLoader) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const newMessages: Message[] = data.messages || [];

        setMessages((prev) => {
          const pending = prev.filter((m) => m.id.startsWith("temp_"));
          if (pending.length === 0) return newMessages;

          const serverIds = new Set(newMessages.map((m) => m.id));
          const stillPending = pending.filter((p) => !serverIds.has(p.id));
          return [...newMessages, ...stillPending];
        });
      }
    } catch (e) {
      console.error("Error fetching messages:", e);
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  }, []);

  // Handle incoming message from Realtime WebSocket (Pure Event-Driven: 0 API GET Calls!)
  const handleRealtimeIncomingMessage = useCallback(
    (newMsg: Message) => {
      if (!newMsg) return;

      // 1. If sent by current logged-in user, ignore self-notification
      const myId = user?.id || currentUserIdRef.current;
      const isMe = myId && newMsg.senderId === myId;
      if (isMe || sentMessageIdsRef.current.has(newMsg.id)) return;

      // 2. If viewing this chat room, append directly to messages state (Instant 0 ms!)
      if (activeConvIdRef.current === newMsg.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }

      // 3. Play sound & browser notification for incoming message
      playNotificationSound();
      showBrowserNotification(`Chaline • ${newMsg.sender?.name || "Friend"}`, {
        body:
          newMsg.type === "STICKER"
            ? "✨ Sent a sticker"
            : newMsg.type === "IMAGE"
            ? "📷 Sent a photo"
            : newMsg.type === "AUDIO"
            ? "🎤 Sent a voice note"
            : newMsg.content,
        icon: newMsg.sender?.avatar || "/icons/icon-192x192.png",
      });

      // 4. Update conversations list state in memory without hitting GET API
      setConversations((prev) => {
        const isCurrentOpen = activeConvIdRef.current === newMsg.conversationId;
        const exists = prev.some((c) => c.id === newMsg.conversationId);

        if (!exists) {
          refreshConversations();
          return prev;
        }

        return prev
          .map((c) => {
            if (c.id === newMsg.conversationId) {
              return {
                ...c,
                lastMessage: newMsg,
                updatedAt: newMsg.createdAt,
                unreadCount: isCurrentOpen ? 0 : (c.unreadCount || 0) + 1,
              };
            }
            return c;
          })
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      });
    },
    [user, refreshConversations]
  );

  // Pure Supabase WebSocket Setup (ZERO Polling Intervals)
  useEffect(() => {
    if (!user) return;
    refreshConversations();
    refreshFriends();

    if (supabase) {
      const channel = supabase
        .channel("chaline-realtime-global", {
          config: {
            broadcast: { self: false },
          },
        })
        .on("broadcast", { event: "new_message" }, (payload) => {
          if (payload?.payload?.message) {
            handleRealtimeIncomingMessage(payload.payload.message);
          }
        })
        .subscribe((status) => {
          console.log("[Supabase WebSocket]:", status);
        });

      channelRef.current = channel;
    }

    // Sync once when user returns to window tab (wake from sleep)
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refreshConversations();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [user, refreshConversations, refreshFriends, handleRealtimeIncomingMessage]);

  const selectConversation = (conv: Conversation | null) => {
    setActiveConversation(conv);
    activeConvIdRef.current = conv?.id || null;
    if (!conv) {
      setMessages([]);
      return;
    }
    // Fetch initial chat history ONCE
    fetchActiveMessages(conv.id, true);

    // Mark as read in local state
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
      const tempId = `temp_${Date.now()}`;
      sentMessageIdsRef.current.add(tempId);

      // Optimistic message UI
      const tempMessage: Message = {
        id: tempId,
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

      setMessages((prev) => [...prev, tempMessage]);

      // Update local conversations last message snippet immediately
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === activeConversation.id
              ? { ...c, lastMessage: tempMessage, updatedAt: tempMessage.createdAt }
              : c
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
      );

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
        const serverMessage = data.message;
        sentMessageIdsRef.current.add(serverMessage.id);

        // Replace optimistic temp message with confirmed server message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? serverMessage : m))
        );

        // Broadcast to other users via WebSocket (Instant 0 ms delivery, ZERO API calls on receiver!)
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "new_message",
            payload: { message: serverMessage },
          });
        }
      } else {
        console.error("Failed to send message:", await res.text());
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert("Failed to send message. Please check your connection.");
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
