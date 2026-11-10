// Synthesised sounds (Web Audio, no files): a few mechanical and electronic
// cues shared by every mechanism. Browsers only allow audio after a user
// gesture, so the context starts on the first pointer press.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

const MUTE_KEY = "puzzle-box:muted";
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

// Silence for a moment without touching the player's choice (restoring a game).
let hushed = false;
export function hush(on: boolean) {
  hushed = on;
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
}

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => audio(), { once: true, capture: true });
}

function tone(freq: number, start: number, length: number, volume: number, type: OscillatorType = "sine") {
  if (muted || hushed) return;
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime + start;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

function burst(start: number, length: number, volume: number, filterFreq: number) {
  if (muted || hushed) return;
  const ac = audio();
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;
  const gain = ac.createGain();
  const t = ac.currentTime + start;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + length + 0.05);
}

// Tactile click: a key press, a detent, a gear set on its peg.
export function tick() {
  burst(0, 0.035, 0.5, 3200);
  tone(1800, 0, 0.03, 0.05, "triangle");
}

// Something heavy that will not move, or lands: a wrong turn, a lid dropping.
export function clunk() {
  burst(0, 0.12, 0.6, 380);
  tone(90, 0, 0.18, 0.25, "sine");
}

// A mechanism gives: a ring solved, a latch released.
export function chime() {
  tone(660, 0, 0.5, 0.12, "triangle");
  tone(990, 0.09, 0.7, 0.1, "triangle");
}

// The finale's shimmer: token, prize.
export function shimmer() {
  [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 1.2, 0.07, "sine"));
}
