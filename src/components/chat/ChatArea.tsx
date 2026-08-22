"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Smile,
  Image as ImageIcon,
  Phone,
  Video,
  MoreVertical,
  ChevronLeft,
  MessageSquare,
  Sparkles,
  Upload,
  Link as LinkIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { StickerPicker } from "./StickerPicker";
import { Message } from "@/types/line";

interface ChatAreaProps {
  onBackMobile?: () => void;
}

export function ChatArea({ onBackMobile }: ChatAreaProps) {
  const { user } = useAuth();
  const {
    activeConversation,
    messages,
    loadingMessages,
    sendMessage,
    setProfileModalUser,
  } = useChat();

  const [inputContent, setInputContent] = useState("");
  const [isStickerOpen, setIsStickerOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [urlInputMode, setUrlInputMode] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherParticipant = activeConversation?.participants.find(
    (p) => p.userId !== user?.id
  );
  const otherUser = otherParticipant?.user;

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    const text = inputContent;
    setInputContent("");
    await sendMessage(text, "TEXT");
  };

  const handleSelectSticker = async (stickerUrl: string) => {
    await sendMessage("", "STICKER", stickerUrl);
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreviewUrl(reader.result);
        setShowImageModal(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset input
  };

  // Handle Clipboard Paste (Ctrl+V with image)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              setImagePreviewUrl(reader.result);
              setShowImageModal(true);
            }
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
        }
      }
    }
  };

  const handleSendImage = async () => {
    const finalUrl = imagePreviewUrl || customUrl.trim();
    if (!finalUrl) return;

    const caption = imageCaption.trim();
    setShowImageModal(false);
    setImagePreviewUrl("");
    setImageCaption("");
    setCustomUrl("");
    setUrlInputMode(false);

    await sendMessage(caption, "IMAGE", finalUrl);
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // If no chat selected
  if (!activeConversation || !otherUser) {
    return (
      <div className="flex-1 h-full hidden md:flex flex-col items-center justify-center bg-[#E5ECEF] dark:bg-[#0E0F14] text-neutral-400 p-8 select-none">
        <div className="w-20 h-20 rounded-3xl bg-[#06C755]/15 flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-[#06C755]" />
        </div>
        <h3 className="text-lg font-black text-neutral-800 dark:text-white">
          Chaline Messenger Web
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-center max-w-sm">
          Select a friend or active conversation from the list to start messaging in real-time.
        </p>
      </div>
    );
  }

  // Check read receipts
  const otherLastRead = otherParticipant?.lastReadAt
    ? new Date(otherParticipant.lastReadAt).getTime()
    : 0;

  return (
    <div
      className="flex-1 h-full flex flex-col bg-[#ABC1D1] dark:bg-[#13141B] relative overflow-hidden"
      onPaste={handlePaste}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* 1. Chat Header */}
      <div className="h-16 px-4 sm:px-6 bg-white/90 dark:bg-[#181A22]/90 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 -ml-1 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.05]"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div
            onClick={() => setProfileModalUser(otherUser)}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#06C755] flex-shrink-0 group-hover:scale-105 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  otherUser.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=User"
                }
                alt={otherUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-neutral-900 dark:text-white truncate group-hover:text-[#06C755] transition-colors">
                {otherUser.name}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {otherUser.statusMessage || `Chaline ID: @${otherUser.lineId}`}
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 sm:gap-2 text-neutral-500 dark:text-neutral-400">
          <button
            onClick={() => alert("Chaline Voice Call feature coming soon!")}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-[#06C755] transition-colors"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => alert("Chaline Video Call feature coming soon!")}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-[#06C755] transition-colors"
            title="Video Call"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            onClick={() => setProfileModalUser(otherUser)}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-[#06C755] transition-colors"
            title="Profile"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
        {loadingMessages && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
            Loading Chaline chat history...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-600 dark:text-neutral-400 gap-2">
            <div className="w-12 h-12 rounded-2xl bg-white/40 dark:bg-white/[0.05] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#06C755]" />
            </div>
            <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
              Chat started with {otherUser.name}
            </p>
            <p className="text-[11px] max-w-xs text-neutral-600 dark:text-neutral-400">
              Say hello, send a photo from your device, or send a cute Chaline sticker!
            </p>
          </div>
        ) : (
          messages.map((msg: Message) => {
            const isMe = msg.senderId === user?.id;
            const isRead =
              isMe &&
              otherLastRead > 0 &&
              new Date(msg.createdAt).getTime() <= otherLastRead;

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                {/* Other User Avatar */}
                {!isMe && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/[0.08] dark:ring-white/[0.1] mb-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        msg.sender.avatar ||
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Friend"
                      }
                      alt={msg.sender.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Read status + Timestamp for ME */}
                {isMe && (
                  <div className="flex flex-col items-end text-[10px] text-neutral-600 dark:text-neutral-400 font-mono leading-tight mb-1 select-none">
                    {isRead && (
                      <span className="text-[#06C755] font-bold text-[9px]">
                        Read
                      </span>
                    )}
                    <span>{formatMessageTime(msg.createdAt)}</span>
                  </div>
                )}

                {/* Bubble / Media Content */}
                <div className="max-w-[75%] sm:max-w-[65%] flex flex-col gap-1">
                  {msg.type === "STICKER" && msg.mediaUrl ? (
                    <div className="p-1 hover:scale-105 transition-transform duration-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.mediaUrl}
                        alt="Sticker"
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                  ) : msg.type === "IMAGE" && msg.mediaUrl ? (
                    <div className="flex flex-col gap-1">
                      <div className="rounded-2xl overflow-hidden shadow-md border border-black/[0.06] dark:border-white/[0.08] bg-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.mediaUrl}
                          alt="Shared media"
                          className="max-h-72 max-w-full rounded-2xl object-cover"
                        />
                      </div>
                      {msg.content && msg.content !== "[Image]" && (
                        <div
                          className={`px-4 py-2 shadow-sm text-xs leading-relaxed break-words ${
                            isMe ? "line-bubble-me" : "line-bubble-other"
                          }`}
                        >
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2.5 shadow-sm text-xs leading-relaxed break-words ${
                        isMe ? "line-bubble-me" : "line-bubble-other"
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>

                {/* Timestamp for OTHER */}
                {!isMe && (
                  <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono mb-1 select-none">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Image Upload & Preview Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1C1E28] rounded-3xl p-5 shadow-2xl border border-black/[0.08] dark:border-white/[0.1] flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#06C755]" />
                Send Image to {otherUser.name}
              </span>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setImagePreviewUrl("");
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher: Device File vs URL */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUrlInputMode(false);
                  fileInputRef.current?.click();
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  !urlInputMode
                    ? "bg-[#06C755] text-white"
                    : "bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-300"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Browse File</span>
              </button>
              <button
                type="button"
                onClick={() => setUrlInputMode(true)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  urlInputMode
                    ? "bg-[#06C755] text-white"
                    : "bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-300"
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Paste URL</span>
              </button>
            </div>

            {/* URL Input if url mode */}
            {urlInputMode && (
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setImagePreviewUrl(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] text-xs outline-none"
              />
            )}

            {/* Image Preview Container */}
            {imagePreviewUrl ? (
              <div className="w-full max-h-64 rounded-2xl overflow-hidden bg-black/10 flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="max-h-64 w-full object-contain"
                />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#06C755] transition-colors"
              >
                <Upload className="w-8 h-8 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  Click to select photo from device
                </span>
                <span className="text-[10px] text-neutral-400">
                  PNG, JPG, GIF, WebP supported
                </span>
              </div>
            )}

            {/* Caption Input */}
            <input
              type="text"
              placeholder="Add a caption (optional)..."
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] text-xs text-neutral-900 dark:text-white outline-none"
            />

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  setImagePreviewUrl("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendImage}
                disabled={!imagePreviewUrl && !customUrl.trim()}
                className="px-5 py-2 rounded-xl bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold shadow-md shadow-[#06C755]/20 disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sticker Picker */}
      <StickerPicker
        isOpen={isStickerOpen}
        onClose={() => setIsStickerOpen(false)}
        onSelectSticker={handleSelectSticker}
      />

      {/* 5. Input Bar */}
      <div className="p-3 sm:p-4 bg-white/90 dark:bg-[#181A22]/90 backdrop-blur-md border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2 z-20 flex-shrink-0">
        {/* Sticker button */}
        <button
          type="button"
          onClick={() => setIsStickerOpen((prev) => !prev)}
          className={`p-2.5 rounded-2xl transition-colors ${
            isStickerOpen
              ? "bg-[#06C755] text-white"
              : "text-neutral-500 hover:text-[#06C755] hover:bg-neutral-100 dark:hover:bg-white/[0.06]"
          }`}
          title="Stickers"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Image Attachment / Upload button */}
        <button
          type="button"
          onClick={() => {
            setIsStickerOpen(false);
            fileInputRef.current?.click();
          }}
          className="p-2.5 rounded-2xl text-neutral-500 hover:text-[#06C755] hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
          title="Send Photo from Device"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        {/* Text Input Form */}
        <form onSubmit={handleSendText} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message on Chaline (or paste image)..."
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-[#06C755]/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputContent.trim()}
            className="p-2.5 rounded-2xl bg-[#06C755] hover:bg-[#05B04B] text-white shadow-md shadow-[#06C755]/25 transition-all disabled:opacity-40 active:scale-95 flex-shrink-0"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
