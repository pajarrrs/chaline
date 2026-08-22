"use client";

let audioInstance: HTMLAudioElement | null = null;

// Preload audio
export function initNotificationSound() {
  if (typeof window === "undefined") return;
  if (!audioInstance) {
    audioInstance = new Audio("/sound/line-sound.mp3");
    audioInstance.preload = "auto";
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
    audioInstance.play().catch((e) => {
      console.warn("Audio autoplay blocked or user gesture required:", e);
    });
  } catch (err) {
    console.warn("Failed to play audio:", err);
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
        tag: options?.tag || "chaline-message",
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
