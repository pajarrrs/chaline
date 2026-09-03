"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabase";
import { CallStatus, CallUser, CallSignalData } from "@/types/call";
import {
  playIncomingRingtone,
  playOutgoingRingback,
  playCallEndTone,
  stopAllCallSounds,
} from "@/lib/callSounds";
import {
  showBrowserNotification,
  closeBrowserNotification,
} from "@/lib/notification";

interface CallContextType {
  callStatus: CallStatus;
  callId: string | null;
  caller: CallUser | null;
  targetUser: CallUser | null;
  isVideo: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  callDuration: number;
  startCall: (target: CallUser, isVideo?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleMinimize: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
  ],
  iceCandidatePoolSize: 10,
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [caller, setCaller] = useState<CallUser | null>(null);
  const [targetUser, setTargetUser] = useState<CallUser | null>(null);
  const [isVideo, setIsVideo] = useState(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // References to eliminate stale closure bugs in realtime listeners
  const callStatusRef = useRef<CallStatus>("idle");
  const callIdRef = useRef<string | null>(null);
  const callerRef = useRef<CallUser | null>(null);
  const targetUserRef = useRef<CallUser | null>(null);
  const isVideoRef = useRef<boolean>(true);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const channelRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Notification and tab title flashing refs
  const activeNotifRef = useRef<Notification | null>(null);
  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalTitleRef = useRef<string>("");

  // Keep refs in sync with state
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    callerRef.current = caller;
  }, [caller]);

  useEffect(() => {
    targetUserRef.current = targetUser;
  }, [targetUser]);

  useEffect(() => {
    isVideoRef.current = isVideo;
  }, [isVideo]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Broadcast signal over persistent calls channel
  const broadcastSignal = useCallback((payload: CallSignalData) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "call_signal",
        payload,
      });
    }
  }, []);

  // Flush queued ICE candidates after setRemoteDescription
  const flushQueuedCandidates = async (pc: RTCPeerConnection) => {
    const queue = [...queuedCandidatesRef.current];
    queuedCandidatesRef.current = [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn("Failed adding queued candidate:", e);
      }
    }
  };

  // Start incoming call alert (sound, tab title flash, browser push notification)
  const startIncomingCallAlert = useCallback(
    (callerUser: CallUser, isVideoMode: boolean, cId: string) => {
      // 1. Web Audio ringtone
      playIncomingRingtone();

      // 2. Tab title flashing
      if (typeof document !== "undefined") {
        if (!originalTitleRef.current) {
          originalTitleRef.current = document.title || "Chaline Messenger";
        }
        let flash = false;
        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = setInterval(() => {
          document.title = flash
            ? `📞 (1) ${callerUser.name} Calling...`
            : `🟢 Incoming Call - Chaline`;
          flash = !flash;
        }, 1000);
      }

      // 3. System / Browser Native Push Notification
      showBrowserNotification(
        `📞 Incoming ${isVideoMode ? "Video Call" : "Voice Call"}!`,
        {
          body: `${callerUser.name} (@${callerUser.lineId}) is calling you. Click to answer!`,
          icon: callerUser.avatar || "/icons/icon-192x192.png",
          tag: `call-${cId}`,
          requireInteraction: true,
          vibrate: [300, 150, 300, 150, 300],
        }
      ).then((notif) => {
        activeNotifRef.current = notif;
      });
    },
    []
  );

  // Stop incoming call alert
  const stopIncomingCallAlert = useCallback((cId?: string) => {
    stopAllCallSounds();

    // Restore title
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    if (typeof document !== "undefined" && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }

    // Close notification
    if (activeNotifRef.current) {
      try {
        activeNotifRef.current.close();
      } catch {}
      activeNotifRef.current = null;
    }
    if (cId) {
      closeBrowserNotification(`call-${cId}`);
    }
  }, []);

  // Request browser notification permission automatically on initial mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Clean up all media tracks, peer connections, and timers
  const cleanupMediaAndPeer = useCallback(() => {
    stopIncomingCallAlert(callIdRef.current || undefined);

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }

    if (cameraTrackRef.current) {
      try {
        cameraTrackRef.current.stop();
      } catch {}
      cameraTrackRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }

    queuedCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsMinimized(false);
    setCallDuration(0);
  }, []);

  // Request camera and microphone media streams
  const acquireMediaStream = async (videoRequired: boolean): Promise<MediaStream | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      alert("Camera/microphone is not supported or site is not on a secure context (localhost or HTTPS).");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: videoRequired
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        cameraTrackRef.current = vTrack;
      }

      return stream;
    } catch (err: any) {
      console.warn("Failed primary getUserMedia:", err);

      // If video failed, try fallback to audio only
      if (videoRequired) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
            video: false,
          });
          setLocalStream(audioStream);
          localStreamRef.current = audioStream;
          setIsVideoOff(true);
          return audioStream;
        } catch (audioErr: any) {
          console.error("Microphone fallback also failed:", audioErr);
        }
      }

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        alert("Camera/Microphone access was denied. Please allow permissions in your browser.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        alert("No camera or microphone found on your device.");
      } else {
        alert("Unable to access camera/mic: " + (err.message || err.name));
      }

      return null;
    }
  };

  // Create and configure RTCPeerConnection
  const setupPeerConnection = useCallback(
    (cId: string, otherUserId: string): RTCPeerConnection => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      // Handle local ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && user) {
          broadcastSignal({
            type: "call_candidate",
            callId: cId,
            targetUserId: otherUserId,
            senderId: user.id,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle remote media track arrival
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          stopAllCallSounds();
          setCallStatus("connected");

          // Start duration timer
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          }
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          if (callStatusRef.current === "connected") {
            playCallEndTone();
            setCallStatus("ended");
            setTimeout(() => {
              cleanupMediaAndPeer();
              setCallStatus("idle");
              setCallId(null);
              setCaller(null);
              setTargetUser(null);
            }, 1500);
          }
        }
      };

      return pc;
    },
    [user, broadcastSignal, cleanupMediaAndPeer]
  );

  // Single Persistent Supabase Realtime Channel for all call signaling
  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase.channel("chaline-realtime-calls", {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "call_signal" }, async (payload) => {
      const data = payload?.payload as CallSignalData;
      if (!data || data.targetUserId !== user.id) return;

      // 1. Incoming Call Invitation
      if (data.type === "call_invite") {
        // If user is busy with another call, reply busy immediately
        if (callStatusRef.current !== "idle") {
          broadcastSignal({
            type: "call_response",
            callId: data.callId,
            targetUserId: data.caller.id,
            senderId: user.id,
            accepted: false,
            reason: "busy",
          });
          return;
        }

        setCallId(data.callId);
        setCaller(data.caller);
        setIsVideo(data.isVideo);
        setCallStatus("incoming");
        startIncomingCallAlert(data.caller, data.isVideo, data.callId);
      }

      // 2. Call Response (Accepted / Declined)
      else if (data.type === "call_response") {
        if (data.callId !== callIdRef.current) return;

        if (data.accepted) {
          stopAllCallSounds();

          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }

          // Peer accepted -> create and send SDP offer
          const pc = peerConnectionRef.current;
          if (pc && targetUserRef.current) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              broadcastSignal({
                type: "call_sdp",
                callId: data.callId,
                targetUserId: targetUserRef.current.id,
                senderId: user.id,
                sdp: offer,
              });
            } catch (e) {
              console.error("Failed creating SDP offer:", e);
            }
          }
        } else {
          // Call was declined or cancelled or busy
          stopAllCallSounds();
          playCallEndTone();
          setCallStatus("ended");
          setTimeout(() => {
            cleanupMediaAndPeer();
            setCallStatus("idle");
            setCallId(null);
            setCaller(null);
            setTargetUser(null);
          }, 1500);
        }
      }

      // 3. WebRTC SDP (Offer / Answer)
      else if (data.type === "call_sdp") {
        if (data.callId !== callIdRef.current) return;
        const pc = peerConnectionRef.current;
        if (!pc || !data.sdp) return;

        try {
          if (data.sdp.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            await flushQueuedCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            broadcastSignal({
              type: "call_sdp",
              callId: data.callId,
              targetUserId: data.senderId,
              senderId: user.id,
              sdp: answer,
            });
          } else if (data.sdp.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            await flushQueuedCandidates(pc);
          }
        } catch (e) {
          console.error("Error setting remote description:", e);
        }
      }

      // 4. WebRTC ICE Candidate
      else if (data.type === "call_candidate") {
        if (data.callId !== callIdRef.current) return;
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.warn("Failed adding ICE candidate directly:", e);
          }
        } else {
          queuedCandidatesRef.current.push(data.candidate);
        }
      }

      // 5. Call Hangup / Terminate by peer
      else if (data.type === "call_end") {
        if (data.callId !== callIdRef.current) return;
        const wasIncoming = callStatusRef.current === "incoming";
        const incomingCaller = callerRef.current;

        stopIncomingCallAlert(data.callId);
        playCallEndTone();
        setCallStatus("ended");

        // If receiver never answered (missed call), show missed call notification
        if (wasIncoming && incomingCaller) {
          showBrowserNotification("📞 Missed Call", {
            body: `You missed a call from ${incomingCaller.name}.`,
            icon: incomingCaller.avatar || "/icons/icon-192x192.png",
            tag: `missed-${data.callId}`,
          });
        }

        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallStatus("idle");
          setCallId(null);
          setCaller(null);
          setTargetUser(null);
        }, 1200);
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (supabase && channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, broadcastSignal, cleanupMediaAndPeer]);

  // Initiate an outgoing call
  const startCall = async (target: CallUser, videoMode = true) => {
    if (!user || !supabase) {
      alert("Unable to initiate call: Service unavailable");
      return;
    }

    // Reset previous call state
    cleanupMediaAndPeer();

    const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setCallId(newCallId);
    setTargetUser(target);
    setIsVideo(videoMode);
    setCallStatus("calling");

    // 1. Acquire media stream
    const stream = await acquireMediaStream(videoMode);
    if (!stream) {
      setCallStatus("idle");
      return;
    }

    // 2. Setup RTCPeerConnection and attach tracks
    const pc = setupPeerConnection(newCallId, target.id);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // 3. Play ringback tone
    playOutgoingRingback();

    // 4. Send call invite
    broadcastSignal({
      type: "call_invite",
      callId: newCallId,
      caller: {
        id: user.id,
        name: user.name,
        lineId: user.lineId,
        avatar: user.avatar,
      },
      targetUserId: target.id,
      isVideo: videoMode,
      createdAt: Date.now(),
    });

    // 5. Timeout if receiver does not answer within 35 seconds
    callTimeoutRef.current = setTimeout(() => {
      if (callStatusRef.current === "calling") {
        broadcastSignal({
          type: "call_end",
          callId: newCallId,
          targetUserId: target.id,
          senderId: user.id,
          reason: "timeout",
        });
        stopAllCallSounds();
        playCallEndTone();
        setCallStatus("ended");
        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallStatus("idle");
          setCallId(null);
          setCaller(null);
          setTargetUser(null);
        }, 1500);
      }
    }, 35000);
  };

  // Accept incoming call
  const acceptCall = async () => {
    const currentCallId = callIdRef.current;
    const currentCaller = callerRef.current;
    if (!currentCallId || !currentCaller || !user) return;

    stopIncomingCallAlert(currentCallId);
    setCallStatus("connected");

    // 1. Acquire camera and mic
    const stream = await acquireMediaStream(isVideoRef.current);
    const pc = setupPeerConnection(currentCallId, currentCaller.id);

    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    // 2. Notify caller that call was accepted
    broadcastSignal({
      type: "call_response",
      callId: currentCallId,
      targetUserId: currentCaller.id,
      senderId: user.id,
      accepted: true,
    });
  };

  // Reject incoming call
  const rejectCall = (reason = "declined") => {
    const currentCallId = callIdRef.current;
    const currentCaller = callerRef.current;

    stopIncomingCallAlert(currentCallId || undefined);
    playCallEndTone();

    if (currentCallId && currentCaller && user) {
      broadcastSignal({
        type: "call_response",
        callId: currentCallId,
        targetUserId: currentCaller.id,
        senderId: user.id,
        accepted: false,
        reason: reason as any,
      });
    }

    cleanupMediaAndPeer();
    setCallStatus("idle");
    setCallId(null);
    setCaller(null);
    setTargetUser(null);
  };

  // End active or outgoing call
  const endCall = () => {
    const currentCallId = callIdRef.current;
    const target = targetUserRef.current || callerRef.current;

    stopIncomingCallAlert(currentCallId || undefined);
    playCallEndTone();

    if (currentCallId && target && user) {
      broadcastSignal({
        type: "call_end",
        callId: currentCallId,
        targetUserId: target.id,
        senderId: user.id,
      });
    }

    setCallStatus("ended");
    setTimeout(() => {
      cleanupMediaAndPeer();
      setCallStatus("idle");
      setCallId(null);
      setCaller(null);
      setTargetUser(null);
    }, 1200);
  };

  // Toggle Microphone Mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  // Toggle Camera On/Off
  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  // Toggle Screen Sharing (Desktop)
  const toggleScreenShare = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Revert back to camera
      if (cameraTrackRef.current && localStreamRef.current) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(cameraTrackRef.current);
        }
        const currentScreenTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentScreenTrack) {
          currentScreenTrack.stop();
          localStreamRef.current.removeTrack(currentScreenTrack);
          localStreamRef.current.addTrack(cameraTrackRef.current);
        }
        setIsScreenSharing(false);
      }
    } else {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert("Screen sharing is not supported on this device/browser.");
          return;
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          if (cameraTrackRef.current && videoSender) {
            videoSender.replaceTrack(cameraTrackRef.current);
            if (localStreamRef.current) {
              localStreamRef.current.removeTrack(screenTrack);
              localStreamRef.current.addTrack(cameraTrackRef.current);
            }
          }
          setIsScreenSharing(false);
        };

        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(screenTrack);
        }

        setIsScreenSharing(true);
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  };

  // Toggle floating minimized widget
  const toggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callId,
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
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        toggleMinimize,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
