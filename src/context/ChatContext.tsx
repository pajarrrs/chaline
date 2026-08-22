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
  loadingConversations: boolean;
  loadingFriends: boolean;
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
  // Realtime Presence, Typing & Read Receipts
  onlineUserIds: string[];
  typingUsers: Record<string, boolean>; // convId -> isTyping
  sendTypingStatus: (isTyping: boolean) => void;
  readReceipts: Record<string, number>; // convId -> timestamp of other user's read
  broadcastReadStatus: (convId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"chats" | "friends">("chats");

  // Synchronous Hydration from LocalStorage
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("chaline_cache_convs");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [friends, setFriends] = useState<Friend[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("chaline_cache_friends");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [loadingConversations, setLoadingConversations] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("chaline_cache_convs");
    }
    return true;
  });

  const [loadingFriends, setLoadingFriends] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("chaline_cache_friends");
    }
    return true;
  });

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);

  // Presence, Typing, Read Receipts
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [readReceipts, setReadReceipts] = useState<Record<string, number>>({});

  const activeConvIdRef = useRef<string | null>(null);
  const isStartingChatLockRef = useRef<boolean>(false);
  const sentMessageIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCacheRef = useRef<Record<string, Message[]>>({});

  // Keep refs in sync
  useEffect(() => {
    currentUserIdRef.current = user?.id || null;
  }, [user]);

  useEffect(() => {
    activeConvIdRef.current = activeConversation?.id || null;
  }, [activeConversation]);

  // Initialize audio sound & auto-request notification permissions on mount
  useEffect(() => {
    initNotificationSound();
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        requestNotificationPermission().catch(() => {});
      }
    }
  }, []);

  const enableNotifications = async () => {
    initNotificationSound();
    return await requestNotificationPermission();
  };

  // Broadcast typing status over WebSocket
  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !activeConvIdRef.current || !user) return;

      channelRef.current.send({
        type: "broadcast",
        event: "user_typing",
        payload: {
          conversationId: activeConvIdRef.current,
          userId: user.id,
          isTyping,
        },
      });
    },
    [user]
  );

  // Broadcast read status over WebSocket (Instant 0 ms read receipt!)
  const broadcastReadStatus = useCallback(
    (convId: string) => {
      if (!channelRef.current || !convId || !user) return;

      const now = Date.now();
      channelRef.current.send({
        type: "broadcast",
        event: "messages_read",
        payload: {
          conversationId: convId,
          userId: user.id,
          readAt: now,
        },
      });
    },
    [user]
  );

  // Fetch Conversations (Initial Load & Tab Focus)
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const newConversations: Conversation[] = data.conversations || [];
        setConversations(newConversations);
        try {
          localStorage.setItem("chaline_cache_convs", JSON.stringify(newConversations));
        } catch {}

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
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  // Fetch Friends (Initial Load)
  const refreshFriends = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        const newFriends: Friend[] = data.friends || [];
        setFriends(newFriends);
        try {
          localStorage.setItem("chaline_cache_friends", JSON.stringify(newFriends));
        } catch {}
      }
    } catch (e) {
      console.error("Error loading friends:", e);
    } finally {
      setLoadingFriends(false);
    }
  }, [user]);

  // Fetch Messages for active conversation with Dual-Layer Local Caching
  const fetchActiveMessages = useCallback(async (convId: string, showLoader = false) => {
    if (showLoader && !messageCacheRef.current[convId]) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const newMessages: Message[] = data.messages || [];

        // Save to in-memory + persistent localStorage cache
        messageCacheRef.current[convId] = newMessages;
        try {
          localStorage.setItem(`chaline_msgs_${convId}`, JSON.stringify(newMessages));
        } catch {}

        if (activeConvIdRef.current === convId) {
          setMessages((prev) => {
            const pending = prev.filter((m) => m.id.startsWith("temp_"));
            if (pending.length === 0) return newMessages;

            const serverIds = new Set(newMessages.map((m) => m.id));
            const stillPending = pending.filter((p) => !serverIds.has(p.id));
            return [...newMessages, ...stillPending];
          });
        }
      }
    } catch (e) {
      console.error("Error fetching messages:", e);
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  }, []);

  // Handle incoming message from Realtime WebSocket (Pure Event-Driven)
  const handleRealtimeIncomingMessage = useCallback(
    (newMsg: Message) => {
      if (!newMsg) return;

      // 1. If sent by current logged-in user, ignore self-notification
      const myId = user?.id || currentUserIdRef.current;
      const isMe = myId && newMsg.senderId === myId;
      if (isMe || sentMessageIdsRef.current.has(newMsg.id)) return;

      // 2. Clear typing status when message arrives
      setTypingUsers((prev) => ({ ...prev, [newMsg.conversationId]: false }));

      // 3. Update memory + localStorage cache
      if (messageCacheRef.current[newMsg.conversationId]) {
        const currentCached = messageCacheRef.current[newMsg.conversationId];
        if (!currentCached.some((m) => m.id === newMsg.id)) {
          const updated = [...currentCached, newMsg];
          messageCacheRef.current[newMsg.conversationId] = updated;
          try {
            localStorage.setItem(`chaline_msgs_${newMsg.conversationId}`, JSON.stringify(updated));
          } catch {}
        }
      }

      // 4. If viewing this chat room, append directly to messages state (Instant 0 ms!)
      if (activeConvIdRef.current === newMsg.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Broadcast read receipt back to sender instantly
        broadcastReadStatus(newMsg.conversationId);
      }

      // 5. Play sound & browser notification for incoming message
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

      // 6. Update conversations list state in memory without hitting GET API
      setConversations((prev) => {
        const isCurrentOpen = activeConvIdRef.current === newMsg.conversationId;
        const exists = prev.some((c) => c.id === newMsg.conversationId);

        if (!exists) {
          refreshConversations();
          return prev;
        }

        const updated = prev
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

        try {
          localStorage.setItem("chaline_cache_convs", JSON.stringify(updated));
        } catch {}

        return updated;
      });
    },
    [user, refreshConversations, broadcastReadStatus]
  );

  // Pure Supabase WebSocket Setup (Presence + Broadcast + Read Receipts)
  useEffect(() => {
    if (!user) return;
    refreshConversations();
    refreshFriends();

    if (supabase) {
      const channel = supabase.channel("chaline-realtime-global", {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      });

      // 1. Message broadcasts
      channel.on("broadcast", { event: "new_message" }, (payload) => {
        if (payload?.payload?.message) {
          handleRealtimeIncomingMessage(payload.payload.message);
        }
      });

      // 2. Typing indicator broadcasts
      channel.on("broadcast", { event: "user_typing" }, (payload) => {
        const { conversationId, userId, isTyping } = payload?.payload || {};
        if (userId && userId !== user.id && conversationId) {
          setTypingUsers((prev) => ({
            ...prev,
            [conversationId]: isTyping,
          }));

          if (isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setTypingUsers((prev) => ({
                ...prev,
                [conversationId]: false,
              }));
            }, 4000);
          }
        }
      });

      // 3. Realtime Read Receipts broadcast (Instant "Read" label)
      channel.on("broadcast", { event: "messages_read" }, (payload) => {
        const { conversationId, userId, readAt } = payload?.payload || {};
        if (userId && userId !== user.id && conversationId && readAt) {
          setReadReceipts((prev) => ({
            ...prev,
            [conversationId]: Math.max(prev[conversationId] || 0, readAt),
          }));

          setActiveConversation((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            return {
              ...prev,
              participants: prev.participants.map((p) =>
                p.userId === userId
                  ? { ...p, lastReadAt: new Date(readAt).toISOString() }
                  : p
              ),
            };
          });
        }
      });

      // 4. Online Presence (Online / Offline status)
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);
        setOnlineUserIds(activeIds);
      });

      channel.on("presence", { event: "join" }, ({ key }) => {
        setOnlineUserIds((prev) => Array.from(new Set([...prev, key])));
      });

      channel.on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUserIds((prev) => prev.filter((id) => id !== key));
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            name: user.name,
            onlineAt: new Date().toISOString(),
          });
        }
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

  // Instant Room Selection (0 ms from Dual-Layer Memory & LocalStorage Cache)
  const selectConversation = (conv: Conversation | null) => {
    setActiveConversation(conv);
    activeConvIdRef.current = conv?.id || null;
    if (!conv) {
      setMessages([]);
      return;
    }

    // 1. Instant Cache Render: Check RAM cache first, then LocalStorage
    let cachedList = messageCacheRef.current[conv.id];
    if ((!cachedList || cachedList.length === 0) && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`chaline_msgs_${conv.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedList = parsed;
            messageCacheRef.current[conv.id] = parsed;
          }
        }
      } catch {}
    }

    if (cachedList && cachedList.length > 0) {
      setMessages(cachedList);
    } else if (conv.lastMessage) {
      setMessages([conv.lastMessage]);
    } else {
      setMessages([]);
    }

    // 2. Fetch fresh history in background
    fetchActiveMessages(conv.id, false);

    // 3. Broadcast read status
    broadcastReadStatus(conv.id);

    // 4. Mark as read in local state
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
      // Clear typing indicator immediately upon sending
      sendTypingStatus(false);

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

      // Update RAM + LocalStorage cache
      const currentList = messageCacheRef.current[activeConversation.id] || [];
      const updatedList = [...currentList, tempMessage];
      messageCacheRef.current[activeConversation.id] = updatedList;
      try {
        localStorage.setItem(`chaline_msgs_${activeConversation.id}`, JSON.stringify(updatedList));
      } catch {}

      // Update local conversations last message snippet immediately
      setConversations((prev) => {
        const updated = prev
          .map((c) =>
            c.id === activeConversation.id
              ? { ...c, lastMessage: tempMessage, updatedAt: tempMessage.createdAt }
              : c
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

        try {
          localStorage.setItem("chaline_cache_convs", JSON.stringify(updated));
        } catch {}

        return updated;
      });

      // Instant 0ms WebSocket Broadcast to receiver!
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "new_message",
          payload: { message: tempMessage },
        });
      }

      // Asynchronous background persistence to Supabase
      fetch(`/api/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          type,
          mediaUrl,
          replyToId,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            const serverMsg = data.message;
            if (serverMsg) {
              sentMessageIdsRef.current.add(serverMsg.id);
              setMessages((prev) =>
                prev.map((m) => (m.id === tempId ? serverMsg : m))
              );
              // Update cache with server message
              if (messageCacheRef.current[activeConversation.id]) {
                const refreshed = messageCacheRef.current[activeConversation.id].map((m) =>
                  m.id === tempId ? serverMsg : m
                );
                messageCacheRef.current[activeConversation.id] = refreshed;
                try {
                  localStorage.setItem(`chaline_msgs_${activeConversation.id}`, JSON.stringify(refreshed));
                } catch {}
              }
            }
          } else {
            console.warn("Message failed to persist in DB:", await res.text());
          }
        })
        .catch((err) => {
          console.error("Failed to persist message:", err);
        });
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
        loadingConversations,
        loadingFriends,
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
        onlineUserIds,
        typingUsers,
        sendTypingStatus,
        readReceipts,
        broadcastReadStatus,
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
