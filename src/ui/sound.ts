import { useUi } from './prefs';

/** Tiny synthesized sound set (no asset files, so nothing to cache or license). */
export type Sfx = 'dice' | 'step' | 'coin' | 'pay' | 'card' | 'turn' | 'build' | 'bad' | 'win';

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (ctx) return ctx;
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
  const Ctor = C.AudioContext ?? C.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

function publish(c: AudioContext) {
  try {
    document.documentElement.dataset.audio = c.state; // handy for tests and debugging
  } catch {
    /* ignore */
  }
}

/**
 * Browsers only allow audio after a user gesture, and touch screens count a *completed* tap (pointerup / touchend /
 * click), not pointerdown. So this is called from every such event until the context is actually running.
 * It also plays one silent sample (iOS needs a sound started inside the gesture) and asks iOS 17+ to use the
 * "playback" audio session so the hardware silent switch does not mute the game.
 */
export function unlockAudio() {
  try {
    (navigator as unknown as { audioSession?: { type: string } }).audioSession && ((navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback');
  } catch {
    /* unsupported */
  }
  const c = ac();
  if (!c) return;
  c.onstatechange = () => publish(c);
  const kick = () => {
    try {
      const b = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
    publish(c);
  };
  if (c.state === 'running') return kick();
  void c.resume().then(kick, () => undefined);
}

/** Wire the unlock to every gesture type that counts, once for the whole app. Removes itself when audio is running. */
export function installAudioUnlock() {
  const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
  const handler = () => {
    unlockAudio();
    if (ctx?.state === 'running') events.forEach((e) => window.removeEventListener(e, handler, true));
  };
  events.forEach((e) => window.addEventListener(e, handler, true));
}

function tone(c: AudioContext, t: number, freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function play(s: Sfx) {
  if (useUi.getState().muted) return;
  const c = ac();
  if (!c) return;
  if (c.state !== 'running') {
    // Not unlocked yet (or the OS suspended it): try to resume, and play once it is running.
    void c.resume().then(() => c.state === 'running' && play(s), () => undefined);
    return;
  }
  const t = c.currentTime;
  switch (s) {
    case 'dice':
      for (let i = 0; i < 7; i++) tone(c, t + i * 0.09, 180 + Math.random() * 160, 0.05, 'square', 0.06);
      break;
    case 'step':
      tone(c, t, 520, 0.05, 'triangle', 0.05);
      break;
    case 'coin':
      tone(c, t, 988, 0.08, 'square', 0.07);
      tone(c, t + 0.08, 1319, 0.18, 'square', 0.07);
      break;
    case 'pay':
      tone(c, t, 330, 0.12, 'triangle', 0.1);
      tone(c, t + 0.1, 247, 0.2, 'triangle', 0.1);
      break;
    case 'card':
      tone(c, t, 700, 0.12, 'sawtooth', 0.04, 1400);
      break;
    case 'turn':
      tone(c, t, 659, 0.15, 'sine', 0.14);
      tone(c, t + 0.15, 880, 0.3, 'sine', 0.14);
      break;
    case 'build':
      tone(c, t, 220, 0.08, 'square', 0.08);
      tone(c, t + 0.1, 330, 0.12, 'square', 0.08);
      break;
    case 'bad':
      tone(c, t, 200, 0.5, 'sawtooth', 0.1, 70);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.14, f, 0.35, 'sine', 0.14));
      break;
  }
}

export function buzz(pattern: number | number[]) {
  if (!useUi.getState().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS Safari) */
  }
}

/** Map one engine event to a sound. */
export function sfxFor(type: string): Sfx | null {
  switch (type) {
    case 'dice': return 'dice';
    case 'salary': case 'buy': return 'coin';
    case 'pay': case 'debt': return 'pay';
    case 'card': case 'peek': return 'card';
    case 'build': return 'build';
    case 'exile': case 'bankrupt': return 'bad';
    case 'win': return 'win';
    default: return null;
  }
}
