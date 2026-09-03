"use client";

import React, { useEffect, useRef, useState } from "react";
import { useCall } from "@/context/CallContext";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Maximize2,
  Minimize2,
  X,
  Volume2,
} from "lucide-react";

export function CallModal() {
  const {
    callStatus,
    caller,
    targetUser,
    isVideo,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isMinimized,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const miniRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const miniLocalVideoRef = useRef<HTMLVideoElement | null>(null);

  const [hasRemoteVideoTrack, setHasRemoteVideoTrack] = useState(false);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (miniLocalVideoRef.current && localStream) {
      miniLocalVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus, isMinimized]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      const vTracks = remoteStream.getVideoTracks();
      setHasRemoteVideoTrack(vTracks.length > 0 && vTracks[0].enabled);
    }
    if (miniRemoteVideoRef.current && remoteStream) {
      miniRemoteVideoRef.current.srcObject = remoteStream;
    }

    if (remoteStream) {
      const handleTrackChange = () => {
        const vTracks = remoteStream.getVideoTracks();
        setHasRemoteVideoTrack(vTracks.length > 0 && vTracks[0].enabled);
      };
      remoteStream.addEventListener("addtrack", handleTrackChange);
      remoteStream.addEventListener("removetrack", handleTrackChange);
      return () => {
        remoteStream.removeEventListener("addtrack", handleTrackChange);
        remoteStream.removeEventListener("removetrack", handleTrackChange);
      };
    }
  }, [remoteStream, callStatus, isMinimized]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const otherPerson = caller || targetUser;

  if (callStatus === "idle") return null;

  // 1. Minimized Floating Widget Mode (PiP)
  if (isMinimized && callStatus === "connected") {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-64 sm:w-72 h-44 bg-[#14161F] rounded-2xl overflow-hidden shadow-2xl border border-white/15 flex flex-col animate-in slide-in-from-bottom-5 duration-300">
        <div className="relative flex-1 bg-black overflow-hidden group">
          {remoteStream ? (
            <video
              ref={miniRemoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-900 to-black text-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  otherPerson?.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=Call"
                }
                alt={otherPerson?.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-[#06C755]"
              />
              <span className="text-xs font-bold mt-1 text-neutral-200">
                {otherPerson?.name}
              </span>
            </div>
          )}

          {/* Local PiP thumbnail */}
          {localStream && !isVideoOff && (
            <div className="absolute bottom-2 right-2 w-20 h-14 rounded-lg overflow-hidden border border-white/20 shadow-md">
              <video
                ref={miniLocalVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            </div>
          )}

          {/* Top Bar with Timer & Restore */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-white drop-shadow">
            <span className="text-[11px] font-mono font-bold bg-black/60 px-2 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#06C755] animate-pulse" />
              {formatDuration(callDuration)}
            </span>
            <button
              onClick={toggleMinimize}
              className="p-1 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all"
              title="Maximize"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick controls bar */}
        <div className="h-10 px-3 bg-[#1B1D28] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-full ${
                isMuted
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/10 text-neutral-300 hover:bg-white/20"
              } transition-colors`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-1.5 rounded-full ${
                isVideoOff
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/10 text-neutral-300 hover:bg-white/20"
              } transition-colors`}
              title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
            >
              {isVideoOff ? (
                <VideoOff className="w-3.5 h-3.5" />
              ) : (
                <Video className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <button
            onClick={endCall}
            className="p-1.5 px-3 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-[11px] font-bold transition-transform active:scale-95"
          >
            <PhoneOff className="w-3 h-3" />
            <span>End</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Incoming Call Screen
  if (callStatus === "incoming") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in duration-200">
        <div className="relative w-full max-w-sm bg-gradient-to-b from-[#181A24] to-[#0F1017] rounded-3xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] uppercase tracking-widest font-bold text-[#06C755] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#06C755] animate-ping" />
              Incoming {isVideo ? "Video Call" : "Voice Call"}
            </span>
            <span className="text-xs text-neutral-400">Chaline Realtime</span>
          </div>

          {/* Caller Avatar with pulsing radar ring */}
          <div className="relative my-2">
            <div className="absolute inset-0 -m-4 rounded-full bg-[#06C755]/20 animate-ping" />
            <div className="absolute inset-0 -m-2 rounded-full bg-[#06C755]/30 animate-pulse" />
            <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-[#06C755] shadow-2xl bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  caller?.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=Caller"
                }
                alt={caller?.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <h3 className="text-xl font-black text-white">{caller?.name}</h3>
            <span className="text-xs font-mono text-[#06C755] mt-1">
              @{caller?.lineId}
            </span>
          </div>

          {/* Actions: Decline & Accept */}
          <div className="w-full flex items-center justify-around pt-4 border-t border-white/[0.08]">
            {/* Decline */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => rejectCall("declined")}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-transform active:scale-95"
                title="Decline"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-[11px] text-neutral-400 font-medium">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-[#06C755] hover:bg-[#05B04B] text-white flex items-center justify-center shadow-lg shadow-[#06C755]/40 transition-transform active:scale-95 animate-bounce"
                title="Accept"
              >
                {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
              <span className="text-[11px] text-[#06C755] font-bold">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Outgoing Call Screen (Calling...)
  if (callStatus === "calling") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in duration-200">
        <div className="relative w-full max-w-sm bg-gradient-to-b from-[#181A24] to-[#0F1017] rounded-3xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] uppercase tracking-widest font-bold text-[#06C755] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#06C755] animate-ping" />
              Calling...
            </span>
            <span className="text-xs text-neutral-400">
              {isVideo ? "Chaline Video Call" : "Chaline Voice Call"}
            </span>
          </div>

          {/* Target Avatar with pulsing waves */}
          <div className="relative my-2">
            <div className="absolute inset-0 -m-3 rounded-full bg-emerald-500/20 animate-pulse" />
            <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-[#06C755] shadow-2xl bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  targetUser?.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=Target"
                }
                alt={targetUser?.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <h3 className="text-xl font-black text-white">{targetUser?.name}</h3>
            <span className="text-xs text-neutral-400 mt-1">Waiting for answer...</span>
          </div>

          {/* Cancel button */}
          <div className="w-full flex justify-center pt-4 border-t border-white/[0.08]">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={endCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-transform active:scale-95"
                title="Cancel Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-[11px] text-neutral-400 font-medium">Cancel</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Call Ended Notification Screen
  if (callStatus === "ended") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-xs bg-[#181A24] rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col items-center text-center gap-3 animate-in zoom-in-95">
          <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
            <PhoneOff className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-white">Call Ended</h4>
          {callDuration > 0 ? (
            <p className="text-xs text-neutral-400">
              Duration:{" "}
              <span className="text-white font-mono font-bold">
                {formatDuration(callDuration)}
              </span>
            </p>
          ) : (
            <p className="text-xs text-neutral-400">No answer / Disconnected</p>
          )}
        </div>
      </div>
    );
  }

  // 5. Active Video Call (Full / Modal In-Call Screen)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:max-w-5xl sm:h-[88vh] bg-[#0E1017] sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col select-none">
        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#06C755] bg-neutral-800 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  otherPerson?.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=Friend"
                }
                alt={otherPerson?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white drop-shadow">
                {otherPerson?.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-[#06C755] font-mono font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#06C755] animate-pulse" />
                  {formatDuration(callDuration)}
                </span>
                <span className="text-[10px] text-white/50">• Chaline P2P</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Minimize / PiP button */}
            <button
              onClick={toggleMinimize}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all active:scale-95"
              title="Minimize to Picture-in-Picture"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Stage Area */}
        <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
          {/* Main Remote Video Stream */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-center p-6">
              <div className="relative">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden ring-4 ring-[#06C755]/50 bg-neutral-900 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      otherPerson?.avatar ||
                      "https://api.dicebear.com/7.x/bottts/svg?seed=Peer"
                    }
                    alt={otherPerson?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                  <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-neutral-300">
                    Camera Off / Audio Only
                  </span>
                </div>
              </div>
              <span className="text-sm font-semibold text-neutral-300">
                Connected with {otherPerson?.name}
              </span>
            </div>
          )}

          {/* Local Camera Floating PiP Box */}
          <div className="absolute top-20 right-4 sm:top-24 sm:right-6 z-20 w-28 h-40 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-neutral-900 backdrop-blur-sm">
            {localStream && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/90 text-neutral-400 gap-1 p-2 text-center">
                <VideoOff className="w-6 h-6 text-neutral-500" />
                <span className="text-[10px] font-semibold">Your Camera Off</span>
              </div>
            )}
            {isMuted && (
              <div className="absolute top-2 left-2 p-1 rounded-full bg-red-600/80 text-white">
                <MicOff className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Floating Control Dock */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-6 flex flex-col items-center justify-center bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <div className="px-6 py-3.5 rounded-full bg-neutral-900/85 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-3 sm:gap-5">
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Camera Toggle */}
            <button
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isVideoOff
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </button>

            {/* Screen Sharing Toggle */}
            <button
              onClick={toggleScreenShare}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isScreenSharing
                  ? "bg-[#06C755] hover:bg-[#05B04B] text-white ring-2 ring-[#06C755]/50"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
            >
              <MonitorUp className="w-5 h-5" />
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-13 h-13 px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-red-600/40 transition-transform active:scale-95 ml-2 font-bold text-xs"
              title="End Call"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline">End Call</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
