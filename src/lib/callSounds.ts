"use client";

// Web Audio API Sound Synthesizer for Call Tones
// Completely self-contained, requires no external mp3 assets, works on all devices

let sharedAudioCtx: AudioContext | null = null;
let currentInterval: NodeJS.Timeout | null = null;
let activeOscillators: OscillatorNode[] = [];

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function stopAllCallSounds() {
  if (currentInterval) {
    clearInterval(currentInterval);
    currentInterval = null;
  }
  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  activeOscillators = [];
}

// Play a pleasant repeating melody for incoming calls (LINE style chime)
export function playIncomingRingtone() {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playChimePattern = () => {
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      // Melodic notes sequence: E5, G#5, B5, E6
      const notes = [
        { freq: 659.25, time: 0, dur: 0.16 },
        { freq: 830.61, time: 0.18, dur: 0.16 },
        { freq: 987.77, time: 0.36, dur: 0.16 },
        { freq: 1318.51, time: 0.54, dur: 0.4 },
        { freq: 987.77, time: 1.1, dur: 0.16 },
        { freq: 1318.51, time: 1.28, dur: 0.45 },
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0, now + time);
        gain.gain.linearRampToValueAtTime(0.28, now + time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.onended = () => {
          activeOscillators = activeOscillators.filter((o) => o !== osc);
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };

        osc.start(now + time);
        osc.stop(now + time + dur + 0.05);

        activeOscillators.push(osc);
      });
    } catch (e) {
      console.warn("Incoming ringtone error:", e);
    }
  };

  playChimePattern();
  currentInterval = setInterval(playChimePattern, 2600);
}

// Play standard outgoing ringback tone (dual frequency 440Hz + 480Hz)
export function playOutgoingRingback() {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playTone = () => {
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 1.8);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.95);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      const cleanup = () => {
        activeOscillators = activeOscillators.filter(
          (o) => o !== osc1 && o !== osc2
        );
        try {
          osc1.disconnect();
          osc2.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc1.onended = cleanup;

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);

      activeOscillators.push(osc1, osc2);
    } catch (e) {
      console.warn("Ringback error:", e);
    }
  };

  playTone();
  currentInterval = setInterval(playTone, 4000);
}

// Play short double-beep when call ends or is declined
export function playCallEndTone() {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    [
      { freq: 480, time: 0 },
      { freq: 360, time: 0.18 },
    ].forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.2, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.start(now + time);
      osc.stop(now + time + 0.16);
    });
  } catch (e) {
    console.warn("Call end tone error:", e);
  }
}
