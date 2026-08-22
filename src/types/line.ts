export interface User {
  id: string;
  lineId: string;
  name: string;
  avatar?: string | null;
  statusMessage?: string | null;
  createdAt: string;
}

export interface Friend {
  id: string;
  friend: User;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "TEXT" | "STICKER" | "IMAGE" | "AUDIO";
  mediaUrl?: string | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    type: "TEXT" | "STICKER" | "IMAGE" | "AUDIO";
    mediaUrl?: string | null;
    sender: {
      id: string;
      name: string;
      lineId: string;
    };
  } | null;
  createdAt: string;
  sender: {
    id: string;
    lineId: string;
    name: string;
    avatar?: string | null;
  };
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: string;
  user: User;
}

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  lastMessage?: Message | null;
  unreadCount?: number;
}
