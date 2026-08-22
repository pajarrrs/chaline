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

  const prevLastMessageIdRef = useRef<string | null>(null);
  const prevUnreadCountRef = useRef<number>(0);
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

  // Fetch Conversations
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const newConversations: Conversation[] = data.conversations || [];
        setConversations(newConversations);

        // Keep activeConversation in sync if open
        if (activeConvIdRef.current) {
          const matched = newConversations.find(
            (c) => c.id === activeConvIdRef.current
          );
          if (matched) {
            setActiveConversation((prev) => (prev ? { ...prev, ...matched } : matched));
          }
        }

        // Background unread count tracker (Only if sender is NOT me)
        const currentTotalUnread = newConversations.reduce(
          (acc, curr) => acc + (curr.unreadCount || 0),
          0
        );

        if (currentTotalUnread > prevUnreadCountRef.current) {
          const unreadChat = newConversations.find(
            (c) =>
              (c.unreadCount || 0) > 0 &&
              c.lastMessage &&
              user &&
              c.lastMessage.senderId !== user.id &&
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

        if (newMessages.length > 0) {
          const lastMsg = newMessages[newMessages.length - 1];
          const isFromOther =
            user &&
            lastMsg.senderId !== user.id &&
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
  }, [user]);

  // Handle incoming message from Realtime WebSocket (Instant 0 ms!)
  const handleRealtimeIncomingMessage = useCallback(
    (newMsg: Message) => {
      if (!newMsg) return;

      // 1. If message was sent by ME, strictly ignore!
      const myId = user?.id || currentUserIdRef.current;
      if (myId && newMsg.senderId === myId) return;
      if (sentMessageIdsRef.current.has(newMsg.id)) return;

      // 2. If active conversation matches, append immediately
      if (activeConvIdRef.current === newMsg.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        prevLastMessageIdRef.current = newMsg.id;
      }

      // 3. Play sound & notification for incoming message
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

      refreshConversations();
    },
    [user, refreshConversations]
  );

  // Supabase Realtime WebSockets Listener
  useEffect(() => {
    if (!user) return;
    refreshConversations();
    refreshFriends();

    if (supabase) {
      // Connect to global chat realtime channel
      const channel = supabase
        .channel("chaline-realtime-global")
        .on("broadcast", { event: "new_message" }, (payload) => {
          if (payload?.payload?.message) {
            handleRealtimeIncomingMessage(payload.payload.message);
          }
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Message",
          },
          (payload) => {
            const newMsg = payload.new as any;
            if (newMsg && activeConvIdRef.current === newMsg.conversationId) {
              fetchActiveMessages(newMsg.conversationId, false);
            }
            refreshConversations();
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    // Gentle polling sync every 2 seconds + focus listener
    const pollInterval = setInterval(() => {
      refreshConversations();
      if (activeConvIdRef.current) {
        fetchActiveMessages(activeConvIdRef.current, false);
      }
    }, 2000);

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refreshConversations();
        if (activeConvIdRef.current) {
          fetchActiveMessages(activeConvIdRef.current, false);
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [user, refreshConversations, refreshFriends, fetchActiveMessages, handleRealtimeIncomingMessage]);

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
      prevLastMessageIdRef.current = tempId;

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

        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? serverMessage : m))
        );
        prevLastMessageIdRef.current = serverMessage.id;

        // Broadcast to WebSocket subscribers for instant 0 ms delivery
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "new_message",
            payload: { message: serverMessage },
          });
        }

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
