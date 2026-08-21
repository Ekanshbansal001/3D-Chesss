// ==========================================================================
// MONARCH — Landing page logic
// ==========================================================================

import "./hero-scene.js";
import { Audio_ } from "./audio.js";
import { getSavedName, saveName } from "./settings.js";
import { createRoom, joinRoom, isMultiplayerAvailable } from "./multiplayer.js";
import { $, renderTimeControlGrid, hideBootScreen } from "./ui.js";

hideBootScreen();

let selectedTimeControl = { key: "10+0", label: "10 min", initial: 600, increment: 0 };

function openModal(id) { $(id).classList.add("open"); Audio_.click(); }
function closeModal(id) { $(id).classList.remove("open"); }

// Populate name fields with any previously saved name
["#createName", "#joinName", "#playName"].forEach(sel => { $(sel).value = getSavedName(); });

renderTimeControlGrid($("#createTimeControls"), tc => selectedTimeControl = tc, selectedTimeControl.key);
renderTimeControlGrid($("#playTimeControls"), tc => selectedTimeControl = tc, selectedTimeControl.key);

$("#createGameBtn").addEventListener("click", () => openModal("#createModal"));
$("#closeCreateModal").addEventListener("click", () => closeModal("#createModal"));
$("#joinGameBtn").addEventListener("click", () => openModal("#joinModal"));
$("#closeJoinModal").addEventListener("click", () => closeModal("#joinModal"));
$("#playOnlineBtn").addEventListener("click", () => openModal("#playModal"));
$("#navPlay").addEventListener("click", (e) => { e.preventDefault(); openModal("#playModal"); });
$("#closePlayModal").addEventListener("click", () => closeModal("#playModal"));

[$("#createModal"), $("#joinModal"), $("#playModal")].forEach(backdrop => {
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
});

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.dataset.origLabel = btn.dataset.origLabel || btn.textContent;
  btn.textContent = busy ? (label || "Please wait…") : btn.dataset.origLabel;
}

async function handleCreate(nameFieldId, errorFieldId, btnId) {
  const nameInput = $(nameFieldId);
  const errorEl = $(errorFieldId);
  const btn = $(btnId);
  errorEl.classList.remove("show");

  const name = nameInput.value.trim() || "Player";
  saveName(name);

  if (!isMultiplayerAvailable()) {
    errorEl.textContent = "Multiplayer isn't configured yet — see DEPLOYMENT.md to connect a Firebase project.";
    errorEl.classList.add("show");
    Audio_.error();
    return;
  }

  setBusy(btn, true, "Creating table…");
  try {
    const { code } = await createRoom({ name, timeControl: selectedTimeControl });
    Audio_.notify();
    window.location.href = `game.html?room=${code}&name=${encodeURIComponent(name)}`;
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Couldn't create the table. Please try again.";
    errorEl.classList.add("show");
    Audio_.error();
    setBusy(btn, false);
  }
}

$("#confirmCreate").addEventListener("click", () => handleCreate("#createName", "#createError", "#confirmCreate"));
$("#confirmPlay").addEventListener("click", () => handleCreate("#playName", "#playError", "#confirmPlay"));

$("#confirmJoin").addEventListener("click", async () => {
  const nameInput = $("#joinName");
  const codeInput = $("#joinCode");
  const errorEl = $("#joinError");
  const btn = $("#confirmJoin");
  errorEl.classList.remove("show");

  const name = nameInput.value.trim() || "Player";
  const code = codeInput.value.trim().toUpperCase();
  saveName(name);

  if (!code || code.length < 4) {
    errorEl.textContent = "Enter the 6-character room code your opponent shared.";
    errorEl.classList.add("show");
    return;
  }

  if (!isMultiplayerAvailable()) {
    errorEl.textContent = "Multiplayer isn't configured yet — see DEPLOYMENT.md to connect a Firebase project.";
    errorEl.classList.add("show");
    Audio_.error();
    return;
  }

  setBusy(btn, true, "Joining…");
  try {
    await joinRoom(code, { name });
    Audio_.notify();
    window.location.href = `game.html?room=${code}&name=${encodeURIComponent(name)}`;
  } catch (err) {
    const msgs = {
      "room-not-found": "GAME NOT FOUND — check the room code and try again.",
      "room-full": "GAME FULL — this table already has two players.",
      "multiplayer-unavailable": "Multiplayer isn't configured yet — see DEPLOYMENT.md."
    };
    errorEl.textContent = msgs[err.message] || "Couldn't join that table. Please try again.";
    errorEl.classList.add("show");
    Audio_.error();
    setBusy(btn, false);
  }
});

$("#joinCode").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});

document.querySelectorAll(".hero-actions .btn, .nav-links a").forEach(el => {
  el.addEventListener("mouseenter", () => {}, { passive: true });
});

// Arriving via a shared invite link (?join=CODE) — prefill and open the join modal.
const joinParam = new URLSearchParams(window.location.search).get("join");
if (joinParam) {
  $("#joinCode").value = joinParam.toUpperCase();
  openModal("#joinModal");
}
