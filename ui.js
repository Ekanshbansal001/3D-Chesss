// ==========================================================================
// MONARCH — UI layer
// Pure DOM plumbing for the game screen. game.js calls into these; this
// file never talks to Firebase or chess.js directly.
// ==========================================================================

import { Settings, TIME_CONTROLS } from "./settings.js";

const PIECE_GLYPH = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚"
};

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function setConnDot(el, state) {
  el.classList.remove("online", "connecting", "offline");
  el.classList.add(state);
}

export function renderTimeControlGrid(container, onSelect, selectedKey = "10+0") {
  container.innerHTML = "";
  TIME_CONTROLS.forEach(tc => {
    const btn = document.createElement("div");
    btn.className = "tc-btn" + (tc.key === selectedKey ? " active" : "");
    btn.textContent = tc.label;
    btn.dataset.key = tc.key;
    btn.addEventListener("click", () => {
      container.querySelectorAll(".tc-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(tc);
    });
    container.appendChild(btn);
  });
}

export function renderMoveHistory(container, historyVerbose) {
  container.innerHTML = "";
  for (let i = 0; i < historyVerbose.length; i += 2) {
    const row = document.createElement("div");
    row.className = "move-row";
    const num = document.createElement("span");
    num.className = "mv-num";
    num.textContent = (i / 2 + 1) + ".";
    const white = document.createElement("span");
    white.className = "mv" + (historyVerbose[i]?.san?.includes("#") ? " check" : "");
    white.textContent = historyVerbose[i]?.san || "";
    const black = document.createElement("span");
    black.className = "mv" + (historyVerbose[i + 1]?.san?.includes("#") ? " check" : "");
    black.textContent = historyVerbose[i + 1]?.san || "";
    row.append(num, white, black);
    container.appendChild(row);
  }
  container.scrollTop = container.scrollHeight;
}

export function renderCaptured(container, pieces) {
  container.innerHTML = pieces.map(p => `<span>${PIECE_GLYPH[p.type]}</span>`).join("");
}

export function showToast({ title, actions = [] }, stackEl) {
  const toast = document.createElement("div");
  toast.className = "toast glass";
  const t = document.createElement("div");
  t.className = "t-title";
  t.textContent = title;
  toast.appendChild(t);
  if (actions.length) {
    const row = document.createElement("div");
    row.className = "t-actions";
    actions.forEach(a => {
      const btn = document.createElement("button");
      btn.className = "btn " + (a.primary ? "btn-primary" : "btn-ghost");
      btn.textContent = a.label;
      btn.addEventListener("click", () => { a.onClick(); dismiss(); });
      row.appendChild(btn);
    });
    toast.appendChild(row);
  }
  stackEl.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  function dismiss() {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }
  if (!actions.length) setTimeout(dismiss, 3800);
  return dismiss;
}

export function showBanner(el, durationMs = 1800) {
  el.classList.add("show");
  if (durationMs) setTimeout(() => el.classList.remove("show"), durationMs);
}
export function hideBanner(el) { el.classList.remove("show"); }

export function showVictory({ eyebrow, winnerText, reasonText, showRematch = true }) {
  $("#victoryEyebrow").textContent = eyebrow;
  $("#victoryWinner").textContent = winnerText;
  $("#victoryReason").textContent = reasonText;
  $("#rematchBtn").style.display = showRematch ? "" : "none";
  $("#victoryOverlay").classList.add("show");
}
export function hideVictory() { $("#victoryOverlay").classList.remove("show"); }

export function wireSettingsDrawer(onChange) {
  const drawer = $("#settingsDrawer");
  const backdrop = $("#drawerBackdrop");
  const open = () => { drawer.classList.add("open"); backdrop.classList.add("open"); };
  const close = () => { drawer.classList.remove("open"); backdrop.classList.remove("open"); };

  $("#settingsBtn").addEventListener("click", open);
  $("#closeSettingsBtn").addEventListener("click", close);
  backdrop.addEventListener("click", close);

  const s = Settings.get();
  $("#setSound").checked = s.sound;
  $("#setQuality").value = s.quality;
  $("#setSensitivity").value = String(s.camSensitivity);
  $("#setBoardTheme").value = s.boardTheme;
  $("#setPieceTheme").value = s.pieceTheme;
  $("#setLegalMoves").checked = s.showLegalMoves;
  $("#setConfirmMove").checked = s.confirmMove;
  $("#setAnimIntensity").value = s.animIntensity;

  $("#setSound").addEventListener("change", e => onChange(Settings.set({ sound: e.target.checked })));
  $("#setQuality").addEventListener("change", e => onChange(Settings.set({ quality: e.target.value })));
  $("#setSensitivity").addEventListener("change", e => onChange(Settings.set({ camSensitivity: parseFloat(e.target.value) })));
  $("#setBoardTheme").addEventListener("change", e => onChange(Settings.set({ boardTheme: e.target.value })));
  $("#setPieceTheme").addEventListener("change", e => onChange(Settings.set({ pieceTheme: e.target.value })));
  $("#setLegalMoves").addEventListener("change", e => onChange(Settings.set({ showLegalMoves: e.target.checked })));
  $("#setConfirmMove").addEventListener("change", e => onChange(Settings.set({ confirmMove: e.target.checked })));
  $("#setAnimIntensity").addEventListener("change", e => onChange(Settings.set({ animIntensity: e.target.value })));

  return { open, close };
}

export function hideBootScreen() {
  const boot = $("#bootScreen");
  if (boot) setTimeout(() => boot.classList.add("hidden"), 250);
}
