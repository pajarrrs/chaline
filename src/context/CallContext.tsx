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
import { CallStatus, CallUser } from "@/types/call";
import {
  playIncomingRingtone,
  playOutgoingRingback,
  playCallEndTone,
  stopAllCallSounds,
} from "@/lib/callSounds";

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
  ],
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

  // References for WebRTC and signaling
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const userChannelRef = useRef<any>(null);
  const roomChannelRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Sync ref with local stream
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Clean up streams & peer connection
  const cleanupMediaAndPeer = useCallback(() => {
    stopAllCallSounds();

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
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

    if (roomChannelRef.current && supabase) {
      try {
        supabase.removeChannel(roomChannelRef.current);
      } catch {}
      roomChannelRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsMinimized(false);
    setCallDuration(0);
  }, []);

  // Request user camera and microphone
  const acquireMediaStream = async (videoRequired: boolean): Promise<MediaStream | null> => {
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
      console.warn("Could not get requested media:", err);
      // If video failed, try audio only
      if (videoRequired) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(audioStream);
          localStreamRef.current = audioStream;
          setIsVideoOff(true);
          return audioStream;
        } catch (audioErr) {
          console.error("Microphone access also failed:", audioErr);
        }
      }
      return null;
    }
  };

  // Create & configure RTCPeerConnection
  const setupPeerConnection = useCallback(
    (currentCallId: string, currentTargetUserId: string): RTCPeerConnection => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && roomChannelRef.current) {
          roomChannelRef.current.send({
            type: "broadcast",
            event: "call_candidate",
            payload: {
              callId: currentCallId,
              senderId: user?.id,
              candidate: event.candidate.toJSON(),
            },
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

          // Start call duration timer
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
          // If remote peer disconnected
          if (callStatus === "connected") {
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
    [user, callStatus, cleanupMediaAndPeer]
  );

  // Setup room channel for signaling during active call
  const subscribeToRoomChannel = useCallback(
    (cId: string, onReady?: () => void) => {
      if (!supabase) return null;
      if (roomChannelRef.current) {
        supabase.removeChannel(roomChannelRef.current);
      }

      const room = supabase.channel(`chaline-call-room-${cId}`, {
        config: { broadcast: { self: false } },
      });

      // SDP Offer / Answer
      room.on("broadcast", { event: "call_sdp" }, async (payload) => {
        const { sdp, senderId } = payload?.payload || {};
        if (senderId === user?.id || !sdp) return;

        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
          if (sdp.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            // Drain any pending candidates
            for (const c of pendingIceCandidatesRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingIceCandidatesRef.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            room.send({
              type: "broadcast",
              event: "call_sdp",
              payload: { callId: cId, senderId: user?.id, sdp: answer },
            });
          } else if (sdp.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            // Drain any pending candidates
            for (const c of pendingIceCandidatesRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingIceCandidatesRef.current = [];
          }
        } catch (e) {
          console.error("Error setting remote SDP:", e);
        }
      });

      // ICE Candidates
      room.on("broadcast", { event: "call_candidate" }, async (payload) => {
        const { candidate, senderId } = payload?.payload || {};
        if (senderId === user?.id || !candidate) return;

        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("Error adding ICE candidate:", e);
          }
        } else {
          pendingIceCandidatesRef.current.push(candidate);
        }
      });

      // Call Hangup by peer
      room.on("broadcast", { event: "call_end" }, (payload) => {
        const { senderId } = payload?.payload || {};
        if (senderId === user?.id) return;

        playCallEndTone();
        setCallStatus("ended");
        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallStatus("idle");
          setCallId(null);
          setCaller(null);
          setTargetUser(null);
        }, 1500);
      });

      room.subscribe((status) => {
        if (status === "SUBSCRIBED" && onReady) {
          onReady();
        }
      });

      roomChannelRef.current = room;
      return room;
    },
    [user, cleanupMediaAndPeer]
  );

  // Listen to personal calls channel for incoming invites & responses
  useEffect(() => {
    if (!user || !supabase) return;

    const channelName = `chaline-user-call-${user.id}`;
    const userChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // 1. Incoming Call Invitation
    userChannel.on("broadcast", { event: "call_invite" }, (payload) => {
      const data = payload?.payload;
      if (!data) return;

      // If user is already in a call, notify caller that user is busy
      if (callStatus !== "idle") {
        const sb = supabase;
        if (sb) {
          const replyChan = sb.channel(`chaline-user-call-${data.caller.id}`);
          replyChan.subscribe((s) => {
            if (s === "SUBSCRIBED") {
              replyChan.send({
                type: "broadcast",
                event: "call_response",
                payload: {
                  callId: data.callId,
                  fromUserId: user.id,
                  accepted: false,
                  reason: "busy",
                },
              });
              setTimeout(() => sb.removeChannel(replyChan), 1000);
            }
          });
        }
        return;
      }

      setCallId(data.callId);
      setCaller(data.caller);
      setIsVideo(data.isVideo);
      setCallStatus("incoming");
      playIncomingRingtone();
    });

    // 2. Call Response from receiver (Accepted or Declined)
    userChannel.on("broadcast", { event: "call_response" }, async (payload) => {
      const data = payload?.payload;
      if (!data) return;

      if (data.accepted) {
        stopAllCallSounds();

        // Connect room channel and start WebRTC SDP offer
        subscribeToRoomChannel(data.callId, async () => {
          const pc = peerConnectionRef.current;
          if (!pc || !roomChannelRef.current) return;

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            roomChannelRef.current.send({
              type: "broadcast",
              event: "call_sdp",
              payload: {
                callId: data.callId,
                senderId: user.id,
                sdp: offer,
              },
            });
          } catch (e) {
            console.error("Failed to create offer:", e);
          }
        });
      } else {
        // Call was declined or user was busy
        playCallEndTone();
        setCallStatus("ended");
        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallStatus("idle");
          setCallId(null);
          setCaller(null);
          setTargetUser(null);
        }, 2000);
      }
    });

    userChannel.subscribe();
    userChannelRef.current = userChannel;

    return () => {
      if (supabase && userChannelRef.current) {
        supabase.removeChannel(userChannelRef.current);
      }
    };
  }, [user, callStatus, cleanupMediaAndPeer, subscribeToRoomChannel]);

  // Initiate an outgoing call
  const startCall = async (target: CallUser, videoMode = true) => {
    if (!user || !supabase) {
      alert("Unable to initiate call: Service unavailable");
      return;
    }

    // Reset any existing state
    cleanupMediaAndPeer();

    const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setCallId(newCallId);
    setTargetUser(target);
    setIsVideo(videoMode);
    setCallStatus("calling");

    // Acquire camera / mic
    const stream = await acquireMediaStream(videoMode);
    if (!stream) {
      alert("Please allow camera/microphone permissions to make a call.");
      setCallStatus("idle");
      return;
    }

    // Prepare RTCPeerConnection and attach tracks
    const pc = setupPeerConnection(newCallId, target.id);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Play ringback sound (calling...)
    playOutgoingRingback();

    // Send call invite to target user's personal channel
    const sb = supabase;
    const targetChannel = sb.channel(`chaline-user-call-${target.id}`);
    targetChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        targetChannel.send({
          type: "broadcast",
          event: "call_invite",
          payload: {
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
          },
        });
        setTimeout(() => sb.removeChannel(targetChannel), 1500);
      }
    });

    // Timeout if receiver does not pick up after 35 seconds
    callTimeoutRef.current = setTimeout(() => {
      if (callStatus === "calling") {
        playCallEndTone();
        setCallStatus("ended");
        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallStatus("idle");
          setCallId(null);
          setCaller(null);
          setTargetUser(null);
        }, 2000);
      }
    }, 35000);
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!callId || !caller || !user || !supabase) return;

    stopAllCallSounds();
    setCallStatus("connected");

    // Acquire camera & mic
    const stream = await acquireMediaStream(isVideo);
    const pc = setupPeerConnection(callId, caller.id);

    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    // Subscribe to room channel for WebRTC signaling
    subscribeToRoomChannel(callId);

    // Send accept response to caller's personal channel
    const sb = supabase;
    const callerChannel = sb.channel(`chaline-user-call-${caller.id}`);
    callerChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        callerChannel.send({
          type: "broadcast",
          event: "call_response",
          payload: {
            callId,
            fromUserId: user.id,
            accepted: true,
          },
        });
        setTimeout(() => sb.removeChannel(callerChannel), 1500);
      }
    });
  };

  // Reject incoming call
  const rejectCall = (reason = "declined") => {
    if (!callId || !caller || !user || !supabase) {
      cleanupMediaAndPeer();
      setCallStatus("idle");
      return;
    }

    stopAllCallSounds();
    playCallEndTone();

    // Send decline response to caller's channel
    const sb = supabase;
    const callerChannel = sb.channel(`chaline-user-call-${caller.id}`);
    callerChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        callerChannel.send({
          type: "broadcast",
          event: "call_response",
          payload: {
            callId,
            fromUserId: user.id,
            accepted: false,
            reason,
          },
        });
        setTimeout(() => sb.removeChannel(callerChannel), 1500);
      }
    });

    cleanupMediaAndPeer();
    setCallStatus("idle");
    setCallId(null);
    setCaller(null);
    setTargetUser(null);
  };

  // End active or outgoing call
  const endCall = () => {
    playCallEndTone();

    // Notify peer via room channel
    if (roomChannelRef.current) {
      roomChannelRef.current.send({
        type: "broadcast",
        event: "call_end",
        payload: {
          callId,
          senderId: user?.id,
        },
      });
    }

    // If caller ends while still in "calling" state, send reject to receiver so receiver's phone stops ringing
    if (callStatus === "calling" && targetUser && supabase && user) {
      const sb = supabase;
      const targetChan = sb.channel(`chaline-user-call-${targetUser.id}`);
      targetChan.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          targetChan.send({
            type: "broadcast",
            event: "call_response",
            payload: {
              callId,
              fromUserId: user.id,
              accepted: false,
              reason: "cancelled",
            },
          });
          setTimeout(() => sb.removeChannel(targetChan), 1500);
        }
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
        // Remove screen track from local stream and add back camera track
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
        if (!navigator.mediaDevices.getDisplayMedia) {
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

        // When user clicks "Stop Sharing" from browser native chrome bar
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
