"use client";

let audioInstance: HTMLAudioElement | null = null;
let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

// Unlock audio on first user touch/click (Required by Android Chrome & iOS Safari)
export function initNotificationSound() {
  if (typeof window === "undefined") return;

  const unlock = () => {
    if (isAudioUnlocked) return;
    try {
      // 1. Unlock Web Audio Context
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        if (!sharedAudioCtx) {
          sharedAudioCtx = new AudioCtx();
        }
        if (sharedAudioCtx.state === "suspended") {
          sharedAudioCtx.resume();
        }
      }

      // 2. Unlock HTML5 Audio
      if (!audioInstance) {
        audioInstance = new Audio("/sound/line-sound.mp3");
      }
      audioInstance.load();
      audioInstance
        .play()
        .then(() => {
          audioInstance?.pause();
          if (audioInstance) audioInstance.currentTime = 0;
          isAudioUnlocked = true;
        })
        .catch(() => {
          isAudioUnlocked = true;
        });
    } catch {
      isAudioUnlocked = true;
    }

    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("touchend", unlock);
  };

  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("touchend", unlock, { once: true });
}

// Chime synthesized via Web Audio API (Guaranteed to work on all browsers & mobile)
function playFallbackChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = sharedAudioCtx || new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    // LINE Notification musical chord (C6 -> G6)
    osc1.frequency.setValueAtTime(1046.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12);

    osc2.frequency.setValueAtTime(1318.51, now);
    osc2.frequency.exponentialRampToValueAtTime(2093.0, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
  } catch (e) {
    console.warn("Chime error:", e);
  }
}

// Play notification sound (Only for incoming messages from others)
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    if (!audioInstance) {
      audioInstance = new Audio("/sound/line-sound.mp3");
    }
    audioInstance.currentTime = 0;
    const playPromise = audioInstance.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        playFallbackChime();
      });
    }
  } catch {
    playFallbackChime();
  }
}

// Request Browser Notification Permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

// Show native browser / PWA notification
export function showBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
  }
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body: options?.body || "New message received",
        icon: options?.icon || "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: options?.tag || `chaline-${Date.now()}`,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn("Notification error:", e);
    }
  }
}
