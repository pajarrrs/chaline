"use client";

let audioInstance: HTMLAudioElement | null = null;
let isAudioUnlocked = false;

// Unlock audio on first user touch/click (Required by Android Chrome & iOS Safari)
export function initNotificationSound() {
  if (typeof window === "undefined") return;

  if (!audioInstance) {
    audioInstance = new Audio("/sound/line-sound.mp3");
    audioInstance.preload = "auto";
  }

  const unlock = () => {
    if (isAudioUnlocked || !audioInstance) return;
    audioInstance
      .play()
      .then(() => {
        audioInstance?.pause();
        if (audioInstance) audioInstance.currentTime = 0;
        isAudioUnlocked = true;
      })
      .catch(() => {
        // Silently handle if not allowed yet
      });

    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

// Fallback chime using Web Audio API in case audio file fails
function playFallbackChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Web audio fallback error:", e);
  }
}

// Play notification sound
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    if (!audioInstance) {
      audioInstance = new Audio("/sound/line-sound.mp3");
    }
    audioInstance.currentTime = 0;
    const playPromise = audioInstance.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Direct mp3 play blocked, trying Web Audio fallback...", err);
        playFallbackChime();
      });
    }
  } catch (err) {
    console.warn("Failed to play audio:", err);
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
