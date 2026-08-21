// ==========================================================================
// MONARCH — Audio
// All sounds are synthesized at runtime with the Web Audio API.
// No external/copyrighted audio assets are used.
// ==========================================================================

let ctx = null;
let enabled = true;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Unlock audio context on first user gesture (mobile autoplay policies).
["pointerdown", "keydown", "touchstart"].forEach(evt => {
  window.addEventListener(evt, () => { if (enabled) ensureCtx(); }, { once: true, passive: true });
});

function envGain(c, start, attack, decay, peak = 0.25) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return g;
}

function tone(freq, { type = "sine", duration = 0.18, peak = 0.22, detune = 0, delay = 0 } = {}) {
  if (!enabled) return;
  const c = ensureCtx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.detune.setValueAtTime(detune, t0);
  const g = envGain(c, t0, 0.008, duration, peak);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseBurst({ duration = 0.12, peak = 0.18, filterFreq = 1800, delay = 0 } = {}) {
  if (!enabled) return;
  const c = ensureCtx();
  const t0 = c.currentTime + delay;
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFreq, t0);
  const g = envGain(c, t0, 0.004, duration, peak);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

export const Audio_ = {
  setEnabled(v) { enabled = v; },
  isEnabled() { return enabled; },

  move() {
    tone(360, { type: "sine", duration: 0.09, peak: 0.14 });
    noiseBurst({ duration: 0.05, peak: 0.08, filterFreq: 900, delay: 0.01 });
  },
  capture() {
    tone(220, { type: "triangle", duration: 0.14, peak: 0.2 });
    noiseBurst({ duration: 0.14, peak: 0.22, filterFreq: 1400 });
  },
  check() {
    tone(660, { type: "sine", duration: 0.16, peak: 0.16 });
    tone(880, { type: "sine", duration: 0.22, peak: 0.12, delay: 0.09 });
  },
  gameStart() {
    [440, 554, 659, 880].forEach((f, i) => tone(f, { type: "sine", duration: 0.5, peak: 0.1, delay: i * 0.09 }));
  },
  checkmate() {
    [220, 277, 330, 165].forEach((f, i) => tone(f, { type: "sawtooth", duration: 0.6, peak: 0.08, delay: i * 0.14 }));
  },
  click() {
    tone(500, { type: "sine", duration: 0.06, peak: 0.1 });
  },
  error() {
    tone(160, { type: "square", duration: 0.14, peak: 0.08 });
  },
  notify() {
    tone(720, { type: "sine", duration: 0.12, peak: 0.1 });
    tone(920, { type: "sine", duration: 0.16, peak: 0.08, delay: 0.08 });
  }
};

window.Audio_ = Audio_;
