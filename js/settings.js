// ==========================================================================
// MONARCH — Settings
// Local preferences persisted to localStorage. Nothing here is synced
// to other players — it's purely a per-device presentation preference.
// ==========================================================================

const STORAGE_KEY = "monarch:settings";

export const DEFAULT_SETTINGS = {
  sound: true,
  music: false,
  quality: "high",          // low | medium | high
  camSensitivity: 1,
  boardTheme: "royalwood",  // obsidian | royalwood | marble
  pieceTheme: "ivoryblack", // ivoryblack | goldobsidian | silverblack
  showLegalMoves: true,
  confirmMove: false,
  animIntensity: "standard" // subtle | standard | none
};

// Time controls: [label, initialMinutes, incrementSeconds]
export const TIME_CONTROLS = [
  { key: "1+0", label: "1 min",  initial: 60,   increment: 0 },
  { key: "3+0", label: "3 min",  initial: 180,  increment: 0 },
  { key: "3+2", label: "3 | 2",  initial: 180,  increment: 2 },
  { key: "5+0", label: "5 min",  initial: 300,  increment: 0 },
  { key: "10+0", label: "10 min", initial: 600,  increment: 0 },
  { key: "10+5", label: "10 | 5", initial: 600,  increment: 5 },
  { key: "15+10", label: "15 | 10", initial: 900,  increment: 10 },
  { key: "30+0", label: "30 min", initial: 1800, increment: 0 }
];

function detectDefaultQuality() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile || cores <= 4) return "medium";
  return "high";
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS, quality: detectDefaultQuality() };
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

let current = load();

export const Settings = {
  get() { return { ...current }; },
  set(partial) {
    current = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent("monarch:settings-changed", { detail: this.get() }));
    return this.get();
  },
  reset() {
    current = { ...DEFAULT_SETTINGS };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
};

// Simple per-device identity so a player can reconnect to a room they created/joined.
export function getPlayerId() {
  let id = localStorage.getItem("monarch:playerId");
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("monarch:playerId", id);
  }
  return id;
}

export function getSavedName() {
  return localStorage.getItem("monarch:playerName") || "";
}
export function saveName(name) {
  localStorage.setItem("monarch:playerName", name);
}

window.MonarchSettings = Settings;
