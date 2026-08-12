'use client';

/**
 * Incoming-message chime, synthesised with the Web Audio API.
 *
 * Synthesised rather than shipped as an asset: it is a couple of hundred bytes
 * of code instead of an audio download, it never blocks on the network when a
 * message lands, and the tone can be tuned without re-exporting a file.
 */

let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

/**
 * Browsers start the audio context suspended until the user interacts with the
 * page. Resuming on the first gesture means the very first message still gets a
 * sound rather than being silently swallowed.
 */
export function primeNotificationSound() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(ctx, { frequency, startAt, duration, peak }) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  // A sine with a soft attack and exponential tail reads as a gentle chime;
  // a square or a hard cutoff would click.
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Two rising notes — a quiet "ba-ding" rather than an alarm. */
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    tone(ctx, { frequency: 660, startAt: now, duration: 0.14, peak: 0.09 });
    tone(ctx, { frequency: 880, startAt: now + 0.1, duration: 0.24, peak: 0.075 });
  } catch {
    // Audio is a nicety — never let it break message delivery.
  }
}

/* ------------------------------------------------------------------ */
/* Ringtone                                                           */
/* ------------------------------------------------------------------ */

let ringtoneTimer = null;
let ringtoneNodes = [];

/** One bell-like note. Triangle + a soft envelope keeps it warm, not piercing. */
function ringNote(ctx, frequency, startAt, duration, peak) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);

  ringtoneNodes.push(oscillator, gain);
  oscillator.onended = () => {
    ringtoneNodes = ringtoneNodes.filter((node) => node !== oscillator && node !== gain);
  };
}

// Two rising triplets then a rest — the shape of a phone ringing, rather than
// a single repeated beep.
const INCOMING_PATTERN = [
  { at: 0.0, hz: 784, dur: 0.2 },
  { at: 0.2, hz: 988, dur: 0.2 },
  { at: 0.4, hz: 1175, dur: 0.34 },
  { at: 0.85, hz: 784, dur: 0.2 },
  { at: 1.05, hz: 988, dur: 0.2 },
  { at: 1.25, hz: 1175, dur: 0.4 },
];
const INCOMING_CYCLE_MS = 3000;

// Softer and sparser for the caller: a ringback, not a summons.
const OUTGOING_PATTERN = [
  { at: 0.0, hz: 440, dur: 0.35 },
  { at: 0.45, hz: 440, dur: 0.35 },
];
const OUTGOING_CYCLE_MS = 3200;

/**
 * Loop a ringtone until stopRingtone() is called. Safe to call repeatedly —
 * an existing ring is replaced rather than layered.
 */
export function startRingtone({ outgoing = false } = {}) {
  stopRingtone();

  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const pattern = outgoing ? OUTGOING_PATTERN : INCOMING_PATTERN;
  const cycleMs = outgoing ? OUTGOING_CYCLE_MS : INCOMING_CYCLE_MS;
  const peak = outgoing ? 0.05 : 0.11;

  const playCycle = () => {
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    pattern.forEach(({ at, hz, dur }) => ringNote(ctx, hz, now + at, dur, peak));

    // Phones that support it buzz along with each incoming ring.
    if (!outgoing && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([400, 200, 400]);
    }
  };

  playCycle();
  ringtoneTimer = window.setInterval(playCycle, cycleMs);
}

export function stopRingtone() {
  if (ringtoneTimer) {
    window.clearInterval(ringtoneTimer);
    ringtoneTimer = null;
  }
  ringtoneNodes.forEach((node) => {
    try {
      node.stop?.();
      node.disconnect?.();
    } catch {
      // Already stopped — nothing to clean up.
    }
  });
  ringtoneNodes = [];
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0);
}
