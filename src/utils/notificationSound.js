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
