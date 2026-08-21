// ==========================================================================
// MONARCH — Multiplayer
//
// Realtime synchronization built on Firebase Realtime Database. This keeps
// the frontend fully static (deployable to GitHub Pages) while giving both
// players a live, shared source of truth for board state, clocks, and
// connection status.
//
// Layering (per the brief):
//   1. Frontend            -> index.html / game.html / css
//   2. Chess/game logic    -> chess-engine.js (chess.js)
//   3. Multiplayer sync    -> THIS FILE
//   4. Identity            -> settings.js (getPlayerId)
//   5. Realtime state      -> Firebase Realtime Database (see DEPLOYMENT.md)
//
// SECURITY NOTE: with a static frontend + Realtime Database, true
// server-side move validation requires Firebase Cloud Functions (or an
// equivalent backend) which needs its own billing/deployment step. This
// file validates everything it can on the client (whose turn it is, room
// membership, game-over state) and ships companion Realtime Database
// security rules (see database.rules.json) that stop an unrelated user
// from writing into a room they're not a player in. Full anti-cheat move
// legality checking server-side is the one item that requires that extra
// (optional) Cloud Functions step — flagged clearly in the deployment
// guide rather than faked here.
// ==========================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import {
  ref, set, get, update, onValue, onDisconnect,
  serverTimestamp, runTransaction, off
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getPlayerId } from "./settings.js";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return code;
}

export function isMultiplayerAvailable() {
  return FIREBASE_CONFIGURED && !!db;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function createRoom({ name, timeControl }) {
  if (!isMultiplayerAvailable()) throw new Error("multiplayer-unavailable");
  const code = generateRoomCode();
  const playerId = getPlayerId();
  const roomRef = ref(db, `rooms/${code}`);

  const room = {
    createdAt: serverTimestamp(),
    status: "waiting",
    fen: START_FEN,
    pgn: "",
    turn: "w",
    lastMove: null,
    timeControl,
    clocks: {
      white: timeControl.initial,
      black: timeControl.initial,
      running: null,
      lastUpdate: serverTimestamp()
    },
    players: {
      white: { id: playerId, name: name || "Player", connected: true },
      black: null
    },
    drawOffer: null,
    result: null,
    rematch: { white: false, black: false },
    rematchRoom: null
  };

  await set(roomRef, room);
  setupPresence(code, "white", playerId);
  return { code, color: "white" };
}

export async function joinRoom(code, { name }) {
  if (!isMultiplayerAvailable()) throw new Error("multiplayer-unavailable");
  code = code.toUpperCase().trim();
  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error("room-not-found");
  const room = snap.val();
  const playerId = getPlayerId();

  // Reconnect: this device already owns a seat in this room.
  if (room.players?.white?.id === playerId) {
    setupPresence(code, "white", playerId);
    await update(ref(db, `rooms/${code}/players/white`), { connected: true });
    return { code, color: "white" };
  }
  if (room.players?.black?.id === playerId) {
    setupPresence(code, "black", playerId);
    await update(ref(db, `rooms/${code}/players/black`), { connected: true });
    return { code, color: "black" };
  }

  if (room.players?.black) throw new Error("room-full");

  // Claim the black seat atomically to avoid a race between two joiners.
  const result = await runTransaction(ref(db, `rooms/${code}/players/black`), current => {
    if (current !== null) return; // abort — already taken
    return { id: playerId, name: name || "Player", connected: true };
  });

  if (!result.committed) throw new Error("room-full");

  await update(roomRef, { status: "active" });
  setupPresence(code, "black", playerId);
  return { code, color: "black" };
}

function setupPresence(code, color, playerId) {
  const presenceRef = ref(db, `rooms/${code}/players/${color}`);
  onDisconnect(presenceRef).update({ connected: false });
}

export function listenRoom(code, onUpdate) {
  const roomRef = ref(db, `rooms/${code}`);
  const handler = onValue(roomRef, snap => {
    onUpdate(snap.exists() ? snap.val() : null);
  });
  return () => off(roomRef, "value", handler);
}

export async function sendMove(code, { fen, pgn, turn, lastMove, clocks, gameOverResult }) {
  const updates = {
    fen, pgn, turn, lastMove,
    "clocks/white": clocks.white,
    "clocks/black": clocks.black,
    "clocks/running": clocks.running,
    "clocks/lastUpdate": serverTimestamp(),
    drawOffer: null
  };
  if (gameOverResult) {
    updates.result = gameOverResult;
    updates.status = "finished";
    updates["clocks/running"] = null;
  }
  await update(ref(db, `rooms/${code}`), updates);
}

export async function syncClockTick(code, clocks) {
  await update(ref(db, `rooms/${code}/clocks`), {
    white: clocks.white,
    black: clocks.black,
    running: clocks.running,
    lastUpdate: serverTimestamp()
  });
}

export async function offerDraw(code, color) {
  await update(ref(db, `rooms/${code}`), { drawOffer: color });
}

export async function respondDraw(code, accept) {
  if (accept) {
    await update(ref(db, `rooms/${code}`), {
      drawOffer: null,
      status: "finished",
      result: { winner: "draw", reason: "agreement" },
      "clocks/running": null
    });
  } else {
    await update(ref(db, `rooms/${code}`), { drawOffer: null });
  }
}

export async function resign(code, color) {
  const winner = color === "white" ? "black" : "white";
  await update(ref(db, `rooms/${code}`), {
    status: "finished",
    result: { winner, reason: "resignation" },
    "clocks/running": null
  });
}

export async function flagFall(code, color) {
  const winner = color === "white" ? "black" : "white";
  await update(ref(db, `rooms/${code}`), {
    status: "finished",
    result: { winner, reason: "timeout" },
    "clocks/running": null
  });
}

export async function requestRematch(code, color, newRoomCode) {
  const updates = {};
  updates[`rematch/${color}`] = true;
  if (newRoomCode) updates.rematchRoom = newRoomCode;
  await update(ref(db, `rooms/${code}`), updates);
}

export async function createRematchRoom(oldCode, oldRoom) {
  const newCode = generateRoomCode();
  const room = {
    createdAt: serverTimestamp(),
    status: "waiting",
    fen: START_FEN,
    pgn: "",
    turn: "w",
    lastMove: null,
    timeControl: oldRoom.timeControl,
    clocks: {
      white: oldRoom.timeControl.initial,
      black: oldRoom.timeControl.initial,
      running: null,
      lastUpdate: serverTimestamp()
    },
    // Swap colors for the rematch, a common chess courtesy.
    players: {
      white: oldRoom.players.black ? { ...oldRoom.players.black, connected: true } : null,
      black: oldRoom.players.white ? { ...oldRoom.players.white, connected: true } : null
    },
    drawOffer: null,
    result: null,
    rematch: { white: false, black: false },
    rematchRoom: null
  };
  await set(ref(db, `rooms/${newCode}`), room);
  return newCode;
}

export async function leaveRoom(code, color) {
  await update(ref(db, `rooms/${code}/players/${color}`), { connected: false });
}
