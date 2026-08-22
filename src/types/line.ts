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
  type: "TEXT" | "STICKER" | "IMAGE";
  mediaUrl?: string | null;
  createdAt: string;
  sender: {
    id: string;
    lineId: string;
    name: string;
    avatar?: string | null;
  };
}

export interface Participant {
  id: string;
  userId: string;
  lastReadAt: string;
  user: User;
}

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
  lastMessage?: Message | null;
  unreadCount?: number;
}
