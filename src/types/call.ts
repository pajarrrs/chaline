export type CallStatus = "idle" | "calling" | "incoming" | "connected" | "ended";
export type CallType = "video" | "audio";

export interface CallUser {
  id: string;
  name: string;
  lineId: string;
  avatar?: string | null;
}

export interface CallSession {
  callId: string;
  caller: CallUser;
  receiver: CallUser;
  isVideo: boolean;
  status: CallStatus;
  startedAt?: number;
}

export type CallSignalData =
  | {
      type: "call_invite";
      callId: string;
      caller: CallUser;
      targetUserId: string;
      isVideo: boolean;
      createdAt: number;
    }
  | {
      type: "call_response";
      callId: string;
      fromUserId: string;
      accepted: boolean;
      reason?: "declined" | "busy" | "timeout";
    }
  | {
      type: "call_webrtc_signal";
      callId: string;
      senderId: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }
  | {
      type: "call_end";
      callId: string;
      senderId: string;
      reason?: string;
    };
