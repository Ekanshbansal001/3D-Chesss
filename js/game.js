// ==========================================================================
// MONARCH — Game controller
// ==========================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { Audio_ } from "./audio.js";
import { Settings, getSavedName, saveName, getPlayerId } from "./settings.js";
import { ChessEngine } from "./chess-engine.js";
import {
  joinRoom, listenRoom, sendMove, offerDraw, respondDraw, resign,
  flagFall, requestRematch, createRematchRoom, leaveRoom, isMultiplayerAvailable
} from "./multiplayer.js";
import { BoardScene } from "./board-scene.js";
import {
  $, formatClock, setConnDot, renderMoveHistory, renderCaptured,
  showToast, showBanner, hideBanner, showVictory, hideVictory,
  wireSettingsDrawer, hideBootScreen
} from "./ui.js";

// ---------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const roomCode = (params.get("room") || "").toUpperCase();
const myName = params.get("name") || getSavedName() || "Player";
saveName(myName);

let myColor = null;          // 'white' | 'black'
let room = null;             // latest room snapshot
let engine = new ChessEngine();
let selectedSquare = null;
let pendingPromotion = null; // {from,to}
let matchFoundShown = false;
let lastAppliedFen = engine.fen();
let clockAnchor = { atMs: Date.now(), white: 0, black: 0, running: null };
let boardScene = null;
let rematchNavigated = false;

const settings = Settings.get();
Audio_.setEnabled(settings.sound);

if (!roomCode) {
  window.location.href = "index.html";
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function boot() {
  if (!isMultiplayerAvailable()) {
    $("#lobbyStatusMsg").textContent = "Multiplayer isn't configured yet.";
    const err = $("#lobbyError");
    err.textContent = "This table needs a connected Firebase project before it can seat players. See DEPLOYMENT.md.";
    err.classList.add("show");
    hideBootScreen();
    return;
  }

  try {
    const res = await joinRoom(roomCode, { name: myName });
    myColor = res.color;
  } catch (err) {
    const messages = {
      "room-not-found": "GAME NOT FOUND",
      "room-full": "GAME FULL"
    };
    $("#lobbyTitle").textContent = messages[err.message] || "Something went wrong";
    $("#lobbyStatusMsg").textContent = err.message === "room-full"
      ? "This table already has two players."
      : "That room code doesn't exist, or the game has ended.";
    hideBootScreen();
    return;
  }

  initBoardScene();
  wireControls();
  wireSettingsDrawer(applySettingsLive);
  watchConnectionState();

  const unsubscribe = listenRoom(roomCode, onRoomUpdate);
  window.addEventListener("beforeunload", () => { leaveRoom(roomCode, myColor); });

  hideBootScreen();
  startClockTicker();
}

function initBoardScene() {
  const canvas = $("#board-canvas");
  boardScene = new BoardScene(canvas, {
    quality: settings.quality,
    boardTheme: settings.boardTheme,
    pieceTheme: settings.pieceTheme,
    sensitivity: settings.camSensitivity
  });
  boardScene.setPosition(engine.board());
  boardScene.setInteractionHandler(onSquareClick);
  if (myColor === "black") boardScene.flipBoard();
  $("#qualityBadge").textContent = settings.quality.toUpperCase();
}

function applySettingsLive(s) {
  Audio_.setEnabled(s.sound);
  boardScene.setQuality(s.quality);
  boardScene.setBoardTheme(s.boardTheme);
  boardScene.setPieceTheme(s.pieceTheme);
  boardScene.setSensitivity(s.camSensitivity);
  $("#qualityBadge").textContent = s.quality.toUpperCase();
}

// ---------------------------------------------------------------------
// Room state -> UI
// ---------------------------------------------------------------------

function onRoomUpdate(newRoom) {
  if (!newRoom) return;
  const prevRoom = room;
  room = newRoom;

  renderLobby();
  renderTopBar();
  renderPlayers();

  // Sync board state
  if (newRoom.fen !== lastAppliedFen) {
    applyRemoteFen(newRoom, prevRoom);
  }

  renderMoveHistory($("#moveList"), engine.history(true));
  const captured = engine.capturedPieces();
  renderCaptured($("#capturedByWhite"), captured.capturedByWhite);
  renderCaptured($("#capturedByBlack"), captured.capturedByBlack);

  // Clock anchor refresh
  clockAnchor = {
    atMs: Date.now(),
    white: newRoom.clocks.white,
    black: newRoom.clocks.black,
    running: newRoom.status === "active" ? newRoom.clocks.running : null
  };

  // Check banner
  if (engine.isCheck() && newRoom.status === "active") {
    const kingSq = engine.kingSquare(engine.turn());
    boardScene.setCheckHighlight(kingSq);
    if (!prevRoom || prevRoom.fen !== newRoom.fen) { showBanner($("#checkBanner")); Audio_.check(); }
  } else {
    boardScene.clearCheckHighlight();
  }

  // Match found cinematic
  if (newRoom.status === "active" && newRoom.players.white && newRoom.players.black && !matchFoundShown) {
    matchFoundShown = true;
    triggerMatchFound();
  }

  // Draw offers
  handleDrawOfferUI(newRoom, prevRoom);

  // Game over
  if (newRoom.result && (!prevRoom || !prevRoom.result)) {
    handleGameOver(newRoom.result);
  }

  // Rematch coordination
  handleRematchState(newRoom);

  // Opponent connection toast
  handleOpponentConnection(newRoom, prevRoom);
}

function renderLobby() {
  const overlay = $("#lobbyOverlay");
  const w = room.players.white, b = room.players.black;
  $("#lobbyRoomCode").textContent = roomCode.split("").join(" ");
  $("#lobbyWhiteName").textContent = w ? w.name : "Waiting…";
  $("#lobbyWhiteAvatar").textContent = w ? w.name[0].toUpperCase() : "?";
  setConnDot($("#lobbyWhiteDot"), w ? (w.connected ? "online" : "offline") : "connecting");
  $("#lobbyBlackName").textContent = b ? b.name : "Waiting for player…";
  $("#lobbyBlackAvatar").textContent = b ? b.name[0].toUpperCase() : "?";
  setConnDot($("#lobbyBlackDot"), b ? (b.connected ? "online" : "offline") : "connecting");

  if (room.status === "waiting" || !b) {
    $("#lobbyStatusMsg").textContent = "Share your room code to invite an opponent.";
    overlay.classList.add("open");
  } else if (room.status === "active" && !matchFoundShown) {
    $("#lobbyStatusMsg").textContent = "Opponent connected. Starting…";
    setTimeout(() => overlay.classList.remove("open"), 900);
  } else {
    overlay.classList.remove("open");
  }
}

function renderTopBar() {
  $("#topRoomCodeText").textContent = roomCode;
  const myConnected = room.players[myColor]?.connected;
  setConnDot($("#myConnDot"), myConnected ? "online" : "connecting");
  $("#connLabel").textContent = myConnected ? "Online" : "Connecting";
}

function renderPlayers() {
  const w = room.players.white, b = room.players.black;
  $("#whiteName").textContent = w ? w.name : "White";
  $("#whiteAvatar").textContent = w ? w.name[0].toUpperCase() : "?";
  $("#whiteStatus").textContent = !w ? "Waiting…" : (w.connected ? "Online" : "Disconnected");
  $("#blackName").textContent = b ? b.name : "Black";
  $("#blackAvatar").textContent = b ? b.name[0].toUpperCase() : "?";
  $("#blackStatus").textContent = !b ? "Waiting…" : (b.connected ? "Online" : "Disconnected");

  const isWhiteTurn = room.turn === "w" && room.status === "active";
  $("#whitePlayerCard").classList.toggle("active-turn", isWhiteTurn);
  $("#blackPlayerCard").classList.toggle("active-turn", !isWhiteTurn && room.status === "active");
}

function triggerMatchFound() {
  Audio_.gameStart();
  const el = $("#matchFoundOverlay");
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
  boardScene.resetCamera();
}

// ---------------------------------------------------------------------
// Board sync (remote moves)
// ---------------------------------------------------------------------

function applyRemoteFen(newRoom, prevRoom) {
  const lastMove = newRoom.lastMove;
  let animated = false;

  if (lastMove && lastMove.from && lastMove.to) {
    const preMoveFen = engine.fen();
    const attempt = engine.move({ from: lastMove.from, to: lastMove.to, promotion: lastMove.promotion });
    if (attempt && engine.fen() === newRoom.fen) {
      animated = true;
      const castle = getCastleRookSquares(attempt);
      boardScene.animateMove(lastMove.from, lastMove.to, {
        promotion: attempt.promotion || null,
        castleRookFrom: castle?.from, castleRookTo: castle?.to
      }).then(() => {
        if (attempt.captured) Audio_.capture(); else Audio_.move();
      });
    } else {
      // Rewind and fall through to a hard sync (handles desync/rematch reset).
      engine.loadFen(preMoveFen);
    }
  }

  if (!animated) {
    engine.loadFen(newRoom.fen);
    boardScene.setPosition(engine.board());
  }

  lastAppliedFen = newRoom.fen;
  selectedSquare = null;
  boardScene.clearHighlights();
  boardScene.clearSelected();
}

function getCastleRookSquares(moveResult) {
  if (!moveResult.flags || (!moveResult.flags.includes("k") && !moveResult.flags.includes("q"))) return null;
  const rank = moveResult.color === "w" ? "1" : "8";
  if (moveResult.flags.includes("k")) return { from: "h" + rank, to: "f" + rank };
  return { from: "a" + rank, to: "d" + rank };
}

// ---------------------------------------------------------------------
// Local interaction
// ---------------------------------------------------------------------

function onSquareClick(square) {
  if (!room || room.status !== "active") return;
  if (room.result) return;
  const myTurn = (room.turn === "w" && myColor === "white") || (room.turn === "b" && myColor === "black");
  if (!myTurn) { Audio_.error(); return; }

  const boardPiece = pieceAt(square);

  if (selectedSquare && selectedSquare !== square) {
    const moves = engine.legalMoves(selectedSquare).filter(m => m.to === square);
    if (moves.length) {
      if (moves.length > 1 || moves[0].flags.includes("p")) {
        pendingPromotion = { from: selectedSquare, to: square, color: engine.turn() };
        openPromotionModal();
        return;
      }
      commitLocalMove(selectedSquare, square, null);
      return;
    }
  }

  if (boardPiece && boardPiece.color === (myColor === "white" ? "w" : "b")) {
    selectedSquare = square;
    boardScene.highlightSelected(square);
    const legal = engine.legalMoves(square);
    if (Settings.get().showLegalMoves) {
      boardScene.highlightLegalMoves(legal.map(m => m.to), legal.filter(m => m.captured).map(m => m.to));
    }
    Audio_.click();
  } else {
    selectedSquare = null;
    boardScene.clearSelected();
    boardScene.clearHighlights();
  }
}

function pieceAt(square) {
  const board = engine.board();
  const { file, rank } = squareIndices(square);
  return board[7 - rank][file];
}
function squareIndices(sq) {
  return { file: "abcdefgh".indexOf(sq[0]), rank: parseInt(sq[1], 10) - 1 };
}

function openPromotionModal() {
  const color = pendingPromotion.color;
  const glyphs = color === "w" ? { q: "♕", r: "♖", b: "♗", n: "♘" } : { q: "♛", r: "♜", b: "♝", n: "♞" };
  const container = $("#promotionOptions");
  container.innerHTML = "";
  Object.entries(glyphs).forEach(([code, glyph]) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost";
    btn.style.fontSize = "1.6rem";
    btn.textContent = glyph;
    btn.addEventListener("click", () => {
      $("#promotionModal").classList.remove("open");
      const { from, to } = pendingPromotion;
      pendingPromotion = null;
      commitLocalMove(from, to, code);
    });
    container.appendChild(btn);
  });
  $("#promotionModal").classList.add("open");
}

function commitLocalMove(from, to, promotion) {
  const result = engine.move({ from, to, promotion });
  if (!result) { Audio_.error(); return; }

  selectedSquare = null;
  boardScene.clearSelected();
  boardScene.clearHighlights();

  const castle = getCastleRookSquares(result);
  boardScene.animateMove(from, to, {
    promotion: result.promotion || null,
    castleRookFrom: castle?.from, castleRookTo: castle?.to
  }).then(() => { if (result.captured) Audio_.capture(); else Audio_.move(); });

  lastAppliedFen = engine.fen();

  // Compute clock update
  const elapsed = (Date.now() - clockAnchor.atMs) / 1000;
  const myKey = myColor; // 'white' | 'black'
  let myRemaining = Math.max(0, clockAnchor[myKey] - elapsed) + room.timeControl.increment;
  const newClocks = {
    white: myColor === "white" ? myRemaining : room.clocks.white,
    black: myColor === "black" ? myRemaining : room.clocks.black,
    running: myColor === "white" ? "black" : "white"
  };

  let gameOverResult = null;
  const info = engine.gameOverInfo();
  if (info) {
    newClocks.running = null;
    gameOverResult = info.reason === "checkmate"
      ? { winner: info.winner, reason: "checkmate" }
      : { winner: "draw", reason: info.reason };
  }

  sendMove(roomCode, {
    fen: engine.fen(),
    pgn: engine.pgn(),
    turn: engine.turn(),
    lastMove: { from, to, promotion: result.promotion || null, san: result.san, captured: result.captured || null },
    clocks: newClocks,
    gameOverResult
  });
}

// ---------------------------------------------------------------------
// Clocks
// ---------------------------------------------------------------------

function startClockTicker() {
  setInterval(() => {
    if (!room) return;
    const elapsed = (Date.now() - clockAnchor.atMs) / 1000;
    let white = clockAnchor.white, black = clockAnchor.black;
    if (clockAnchor.running === "white") white = Math.max(0, clockAnchor.white - elapsed);
    if (clockAnchor.running === "black") black = Math.max(0, clockAnchor.black - elapsed);

    const whiteEl = $("#whiteClock"), blackEl = $("#blackClock");
    whiteEl.textContent = formatClock(white);
    blackEl.textContent = formatClock(black);
    whiteEl.classList.toggle("low-time", white <= 10 && clockAnchor.running === "white");
    blackEl.classList.toggle("low-time", black <= 10 && clockAnchor.running === "black");

    // Client-side flag detection — whoever is due to move locally reports the flag fall.
    if (room.status === "active" && !room.result) {
      const myTurn = (room.turn === "w" && myColor === "white") || (room.turn === "b" && myColor === "black");
      if (myTurn && clockAnchor.running === myColor) {
        const mine = myColor === "white" ? white : black;
        if (mine <= 0) flagFall(roomCode, myColor);
      }
    }
  }, 250);
}

// ---------------------------------------------------------------------
// Draw offers, resignation, rematch
// ---------------------------------------------------------------------

let activeDrawToastDismiss = null;

function handleDrawOfferUI(newRoom, prevRoom) {
  if (newRoom.drawOffer && newRoom.drawOffer !== prevRoom?.drawOffer) {
    if (newRoom.drawOffer === myColor) {
      showToast({ title: "Draw offer sent — waiting for your opponent." }, $("#toastStack"));
    } else {
      Audio_.notify();
      activeDrawToastDismiss = showToast({
        title: "Your opponent offers a draw.",
        actions: [
          { label: "Decline", onClick: () => respondDraw(roomCode, false) },
          { label: "Accept", primary: true, onClick: () => respondDraw(roomCode, true) }
        ]
      }, $("#toastStack"));
    }
  }
  if (!newRoom.drawOffer && prevRoom?.drawOffer && activeDrawToastDismiss) {
    activeDrawToastDismiss();
    activeDrawToastDismiss = null;
  }
}

function handleGameOver(result) {
  boardScene.clearHighlights();
  boardScene.clearSelected();
  Audio_.checkmate();

  const reasonLabels = {
    checkmate: "By checkmate",
    resignation: "By resignation",
    timeout: "On time",
    stalemate: "By stalemate",
    "threefold-repetition": "By threefold repetition",
    "insufficient-material": "By insufficient material",
    "fifty-move-rule": "By the fifty-move rule",
    agreement: "By agreement"
  };

  let winnerText;
  if (result.winner === "draw") {
    winnerText = "Draw";
  } else {
    const winnerName = room.players[result.winner]?.name || (result.winner === "white" ? "White" : "Black");
    winnerText = `${winnerName} Wins`;
  }

  showVictory({
    eyebrow: result.reason === "checkmate" ? "Checkmate" : "Game Over",
    winnerText,
    reasonText: reasonLabels[result.reason] || "",
  });
}

function handleRematchState(newRoom) {
  const r = newRoom.rematch || {};
  if (r.white && r.black) {
    if (myColor === "white" && !newRoom.rematchRoom) {
      createRematchRoom(roomCode, newRoom).then(newCode => {
        requestRematch(roomCode, "white", newCode);
      });
    }
    if (newRoom.rematchRoom && !rematchNavigated) {
      rematchNavigated = true;
      setTimeout(() => {
        window.location.href = `game.html?room=${newRoom.rematchRoom}&name=${encodeURIComponent(myName)}`;
      }, 600);
    }
  } else if (r[myColor === "white" ? "black" : "white"]) {
    showToast({ title: "Your opponent requested a rematch." }, $("#toastStack"));
  }
}

let lastOpponentConnected = null;
function handleOpponentConnection(newRoom, prevRoom) {
  const oppKey = myColor === "white" ? "black" : "white";
  const opp = newRoom.players[oppKey];
  if (!opp) return;
  if (lastOpponentConnected === true && opp.connected === false) {
    showToast({ title: `${opp.name} disconnected — waiting for reconnect…` }, $("#toastStack"));
  }
  if (lastOpponentConnected === false && opp.connected === true) {
    showToast({ title: `${opp.name} reconnected.` }, $("#toastStack"));
  }
  lastOpponentConnected = opp.connected;
}

// ---------------------------------------------------------------------
// Connection banner (own connectivity via Firebase presence)
// ---------------------------------------------------------------------

function watchConnectionState() {
  if (!db) return;
  onValue(ref(db, ".info/connected"), (snap) => {
    const banner = $("#connectionBanner");
    if (snap.val() === true) {
      banner.classList.remove("show");
    } else {
      banner.classList.add("show");
    }
  });
}

// ---------------------------------------------------------------------
// Static controls
// ---------------------------------------------------------------------

function wireControls() {
  $("#topRoomCode").addEventListener("click", copyInvite);
  $("#copyInviteBtn").addEventListener("click", copyInvite);
  $("#shareBtn").addEventListener("click", shareInvite);

  $("#camResetBtn").addEventListener("click", () => boardScene.resetCamera());
  $("#camFlipBtn").addEventListener("click", () => boardScene.flipBoard());

  $("#soundToggleBtn").addEventListener("click", () => {
    const s = Settings.set({ sound: !Settings.get().sound });
    Audio_.setEnabled(s.sound);
    $("#soundToggleBtn").style.opacity = s.sound ? "1" : "0.4";
  });

  $("#resignBtn").addEventListener("click", () => {
    if (!room || room.result) return;
    if (confirm("Resign this game?")) resign(roomCode, myColor);
  });
  $("#drawBtn").addEventListener("click", () => {
    if (!room || room.result) return;
    offerDraw(roomCode, myColor);
  });

  $("#rematchBtn").addEventListener("click", () => {
    requestRematch(roomCode, myColor);
    $("#rematchBtn").disabled = true;
    $("#rematchBtn").textContent = "Waiting for opponent…";
  });
  $("#exitFromVictoryBtn").addEventListener("click", exitTable);
  $("#exitGameBtn").addEventListener("click", exitTable);
}

function inviteUrl() {
  return `${window.location.origin}${window.location.pathname.replace("game.html", "index.html")}?join=${roomCode}`;
}

function copyInvite() {
  navigator.clipboard?.writeText(`${roomCode} — ${inviteUrl()}`).then(() => {
    showToast({ title: "Invite copied to clipboard." }, $("#toastStack"));
  }).catch(() => {});
  Audio_.click();
}

function shareInvite() {
  if (navigator.share) {
    navigator.share({ title: "Join my table on MONARCH", text: `Room code ${roomCode}`, url: inviteUrl() }).catch(() => {});
  } else {
    copyInvite();
  }
}

function exitTable() {
  leaveRoom(roomCode, myColor);
  window.location.href = "index.html";
}

boot();
