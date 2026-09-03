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
  Reply,
  Mic,
  Trash2,
  Play,
  Pause,
  Download,
  ZoomIn,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useCall } from "@/context/CallContext";
import { StickerPicker } from "./StickerPicker";
import { Message } from "@/types/line";

interface ChatAreaProps {
  onBackMobile?: () => void;
}

// Custom Voice Note Player Component (Fix Infinity:NaN on WebM in mobile/Chrome)
function VoiceNotePlayer({
  audioUrl,
  isMe,
}: {
  audioUrl: string;
  isMe: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const setAudioDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else {
        // Fix for recorded WebM infinity duration in Chrome/Android
        audio.currentTime = 1e101;
        audio.ontimeupdate = function () {
          this.ontimeupdate = () => {};
          audio.currentTime = 0;
          if (audio.duration && isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        };
      }
    };

    const onLoadedMetadata = () => {
      setAudioDuration();
    };

    const onTimeUpdate = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration || !isFinite(duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(pos * 100);
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[170px] max-w-[240px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 flex-shrink-0 ${
          isMe
            ? "bg-white text-[#058639]"
            : "bg-[#06C755] text-white"
        }`}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Progress bar */}
        <div
          onClick={handleSeek}
          className="h-1.5 rounded-full bg-black/15 dark:bg-white/20 relative cursor-pointer overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all ${
              isMe ? "bg-white dark:bg-white" : "bg-[#06C755]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[9px] opacity-85 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
}

export function ChatArea({ onBackMobile }: ChatAreaProps) {
  const { user } = useAuth();
  const {
    activeConversation,
    messages,
    loadingMessages,
    sendMessage,
    setProfileModalUser,
    onlineUserIds,
    typingUsers,
    sendTypingStatus,
    readReceipts,
  } = useChat();
  const { startCall } = useCall();

  const [inputContent, setInputContent] = useState("");
  const [isStickerOpen, setIsStickerOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [urlInputMode, setUrlInputMode] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Image Zoom Lightbox
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherParticipant = activeConversation?.participants.find(
    (p) => p.userId !== user?.id
  );
  const otherUser = otherParticipant?.user;

  const isOtherOnline = otherUser ? onlineUserIds.includes(otherUser.id) : false;
  const isOtherTyping = activeConversation ? !!typingUsers[activeConversation.id] : false;

  // Auto scroll to bottom when messages update or when typing starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputContent(val);

    // Send typing broadcast debounced
    sendTypingStatus(true);
    if (typingDebounceTimer.current) clearTimeout(typingDebounceTimer.current);
    typingDebounceTimer.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2500);
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    const text = inputContent;
    const currentReply = replyingTo;
    setInputContent("");
    setReplyingTo(null);
    sendTypingStatus(false);

    const replyPreview = currentReply
      ? {
          id: currentReply.id,
          content: currentReply.content,
          type: currentReply.type,
          mediaUrl: currentReply.mediaUrl,
          sender: {
            id: currentReply.sender.id,
            name: currentReply.sender.name,
            lineId: currentReply.sender.lineId,
          },
        }
      : undefined;

    await sendMessage(text, "TEXT", undefined, currentReply?.id, replyPreview);
  };

  const handleSelectSticker = async (stickerUrl: string) => {
    const currentReply = replyingTo;
    setReplyingTo(null);
    await sendMessage("", "STICKER", stickerUrl, currentReply?.id);
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
    e.target.value = "";
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
    const currentReply = replyingTo;

    setShowImageModal(false);
    setImagePreviewUrl("");
    setImageCaption("");
    setCustomUrl("");
    setUrlInputMode(false);
    setReplyingTo(null);

    await sendMessage(caption, "IMAGE", finalUrl, currentReply?.id);
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone permission required to send voice notes.");
    }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        if (base64Audio) {
          const currentReply = replyingTo;
          setReplyingTo(null);
          await sendMessage("", "AUDIO", base64Audio, currentReply?.id);
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatRecordingTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
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
      className="flex-1 h-full flex flex-col bg-[#ABC1D1] dark:bg-[#13141B] relative overflow-hidden min-w-0"
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

      {/* 1. Chat Header with Online/Offline & Typing Status */}
      <div className="h-16 px-3 sm:px-6 bg-white/90 dark:bg-[#181A22]/90 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Back button for mobile */}
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 -ml-1 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.05] flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div
            onClick={() => setProfileModalUser(otherUser)}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  otherUser.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=User"
                }
                alt={otherUser.name}
                className="w-full h-full object-cover rounded-full ring-2 ring-[#06C755]"
              />
              {/* Online Presence Indicator Badge */}
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#181A22] ${
                  isOtherOnline ? "bg-[#06C755]" : "bg-neutral-400"
                }`}
                title={isOtherOnline ? "Online" : "Offline"}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-neutral-900 dark:text-white truncate group-hover:text-[#06C755] transition-colors">
                {otherUser.name}
              </span>

              {/* Dynamic Status: Typing / Online / Status message */}
              {isOtherTyping ? (
                <span className="text-[10px] sm:text-[11px] text-[#06C755] font-bold flex items-center gap-1 animate-pulse">
                  <span>typing</span>
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#06C755] animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-[#06C755] animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-[#06C755] animate-bounce [animation-delay:0.3s]" />
                  </span>
                </span>
              ) : isOtherOnline ? (
                <span className="text-[10px] sm:text-[11px] text-[#06C755] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {otherUser.statusMessage || `Chaline ID: @${otherUser.lineId}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          <button
            onClick={() => {
              if (otherUser) {
                startCall(
                  {
                    id: otherUser.id,
                    name: otherUser.name,
                    lineId: otherUser.lineId,
                    avatar: otherUser.avatar,
                  },
                  false
                );
              }
            }}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-[#06C755] transition-colors"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (otherUser) {
                startCall(
                  {
                    id: otherUser.id,
                    name: otherUser.name,
                    lineId: otherUser.lineId,
                    avatar: otherUser.avatar,
                  },
                  true
                );
              }
            }}
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
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex flex-col gap-3 sm:gap-4 min-h-0">
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
              Say hello, send a photo, voice note, or send a cute Chaline sticker!
            </p>
          </div>
        ) : (
          messages.map((msg: Message) => {
            const isMe = msg.senderId === user?.id;
            const dynamicOtherLastRead = Math.max(
              otherLastRead,
              activeConversation ? readReceipts[activeConversation.id] || 0 : 0
            );
            const isRead =
              isMe &&
              dynamicOtherLastRead > 0 &&
              new Date(msg.createdAt).getTime() <= dynamicOtherLastRead;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex items-end gap-1.5 sm:gap-2 group/msg ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                {/* Other User Avatar */}
                {!isMe && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/[0.08] dark:ring-white/[0.1] mb-0.5">
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

                {/* Quick Reply Button for ME */}
                {isMe && (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(msg)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 text-neutral-500 hover:text-[#06C755] transition-opacity shadow-sm self-center flex-shrink-0"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3" />
                  </button>
                )}

                {/* Read status + Timestamp for ME */}
                {isMe && (
                  <div className="flex flex-col items-end text-[10px] text-neutral-600 dark:text-neutral-400 font-mono leading-tight mb-1 select-none flex-shrink-0">
                    {isRead && (
                      <span className="text-[#06C755] font-bold text-[9px]">
                        Read
                      </span>
                    )}
                    <span>{formatMessageTime(msg.createdAt)}</span>
                  </div>
                )}

                {/* Bubble / Media Content */}
                <div className="max-w-[82%] sm:max-w-[65%] flex flex-col gap-1 min-w-0">
                  {/* Quoted / Reply Preview Block */}
                  {msg.replyTo && (
                    <div
                      className={`text-[10px] sm:text-[11px] p-2 rounded-xl border-l-4 border-[#06C755] bg-black/10 dark:bg-white/10 backdrop-blur-sm flex flex-col gap-0.5 cursor-pointer hover:opacity-90 transition-opacity`}
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      <span className="font-bold text-[#06C755] truncate">
                        {msg.replyTo.sender?.name || "Replied Message"}
                      </span>
                      <span className="text-neutral-700 dark:text-neutral-300 truncate">
                        {msg.replyTo.type === "STICKER"
                          ? "✨ [Sticker]"
                          : msg.replyTo.type === "IMAGE"
                          ? "📷 [Photo]"
                          : msg.replyTo.type === "AUDIO"
                          ? "🎤 [Voice Note]"
                          : msg.replyTo.content}
                      </span>
                    </div>
                  )}

                  {msg.type === "STICKER" && msg.mediaUrl ? (
                    <div className="p-1 hover:scale-105 transition-transform duration-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.mediaUrl}
                        alt="Sticker"
                        className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                      />
                    </div>
                  ) : msg.type === "IMAGE" && msg.mediaUrl ? (
                    <div className="flex flex-col gap-1">
                      <div
                        onClick={() => setZoomedImage(msg.mediaUrl || null)}
                        className="rounded-2xl overflow-hidden shadow-md border border-black/[0.06] dark:border-white/[0.08] bg-black/5 cursor-pointer group/img relative"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.mediaUrl}
                          alt="Shared media"
                          className="max-h-72 max-w-full rounded-2xl object-cover group-hover/img:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-6 h-6 drop-shadow-md" />
                        </div>
                      </div>
                      {msg.content && msg.content !== "[Image]" && (
                        <div
                          className={`px-3.5 py-2 shadow-sm text-xs leading-relaxed break-words ${
                            isMe ? "line-bubble-me" : "line-bubble-other"
                          }`}
                        >
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ) : msg.type === "AUDIO" && msg.mediaUrl ? (
                    <div
                      className={`px-3 py-2 shadow-sm text-xs leading-relaxed ${
                        isMe ? "line-bubble-me" : "line-bubble-other"
                      }`}
                    >
                      <VoiceNotePlayer audioUrl={msg.mediaUrl} isMe={isMe} />
                    </div>
                  ) : (
                    <div
                      className={`px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-sm text-xs leading-relaxed break-words ${
                        isMe ? "line-bubble-me" : "line-bubble-other"
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>

                {/* Quick Reply Button for OTHER */}
                {!isMe && (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(msg)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 text-neutral-500 hover:text-[#06C755] transition-opacity shadow-sm self-center flex-shrink-0"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3" />
                  </button>
                )}

                {/* Timestamp for OTHER */}
                {!isMe && (
                  <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono mb-1 select-none flex-shrink-0">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Live Typing Bubble in Chat Area */}
        {isOtherTyping && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/[0.08] dark:ring-white/[0.1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={otherUser.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Friend"}
                alt={otherUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-[#1E202B]/80 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1.5 shadow-sm">
              <span className="text-[11px] text-neutral-500 font-medium">
                {otherUser.name} is typing
              </span>
              <span className="inline-flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] animate-bounce [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Fullscreen Image Zoom Lightbox Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
            <a
              href={zoomedImage}
              download="chaline-photo.png"
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download Photo"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => setZoomedImage(null)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            onClick={() => setZoomedImage(null)}
            className="w-full h-full flex items-center justify-center cursor-zoom-out"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-150"
            />
          </div>
        </div>
      )}

      {/* 4. Image Upload & Preview Modal */}
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

      {/* 5. Sticker Picker */}
      <StickerPicker
        isOpen={isStickerOpen}
        onClose={() => setIsStickerOpen(false)}
        onSelectSticker={handleSelectSticker}
      />

      {/* 6. Quoted Reply Bar (Above Input) */}
      {replyingTo && (
        <div className="px-3 sm:px-4 py-2 bg-neutral-100/95 dark:bg-[#1A1C25]/95 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between z-20 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-1 h-7 rounded-full bg-[#06C755] flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#06C755] truncate">
                Replying to {replyingTo.sender.name}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                {replyingTo.type === "STICKER"
                  ? "✨ [Sticker]"
                  : replyingTo.type === "IMAGE"
                  ? "📷 [Photo]"
                  : replyingTo.type === "AUDIO"
                  ? "🎤 [Voice Note]"
                  : replyingTo.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 7. Input Bar / Voice Recording HUD */}
      <div className="p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#181A22]/95 backdrop-blur-md border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1 sm:gap-2 z-20 flex-shrink-0 max-w-full">
        {isRecording ? (
          /* Live Voice Recording UI */
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-2xl bg-red-500/10 border border-red-500/20 animate-pulse min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
              <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 truncate">
                {formatRecordingTime(recordingDuration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 rounded-xl text-neutral-500 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                title="Cancel Recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="px-3.5 py-1.5 rounded-xl bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold shadow-md shadow-[#06C755]/25 flex items-center gap-1 active:scale-95 transition-all"
                title="Send Voice Note"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Input Bar */
          <>
            {/* Sticker button */}
            <button
              type="button"
              onClick={() => setIsStickerOpen((prev) => !prev)}
              className={`p-2 rounded-xl transition-colors flex-shrink-0 ${
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
              className="p-2 rounded-xl text-neutral-500 hover:text-[#06C755] hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
              title="Send Photo from Device"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Text Input Form */}
            <form onSubmit={handleSendText} className="flex-1 flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                placeholder="Type a message on Chaline..."
                value={inputContent}
                onChange={handleInputChange}
                className="flex-1 min-w-0 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-[#06C755]/60 transition-colors"
              />

              {/* Dynamic Action Button: Send if typing, Mic (VN) if empty */}
              {inputContent.trim().length > 0 ? (
                <button
                  type="submit"
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#06C755] hover:bg-[#05B04B] text-white shadow-md shadow-[#06C755]/25 transition-all active:scale-95 flex-shrink-0 animate-in zoom-in-75 duration-150"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-neutral-500 hover:text-[#06C755] hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-all active:scale-95 flex-shrink-0 animate-in zoom-in-75 duration-150"
                  title="Record Voice Note"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
