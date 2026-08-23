// ==========================================================================
// MONARCH — vs Computer controller
// Same 3D board, rules engine, and UI system as the multiplayer table —
// but fully offline, with Stockfish (or the fallback bot) standing in for
// the second player. No Firebase, no network requirement beyond the
// one-time Stockfish CDN fetch (which itself degrades gracefully).
// ==========================================================================

import { Audio_ } from "./audio.js";
import { Settings } from "./settings.js";
import { ChessEngine } from "./chess-engine.js";
import { BoardScene } from "./board-scene.js";
import { getAiMove, preloadEngine, usingFallback, DIFFICULTIES } from "./ai-controller.js";
import {
  $, renderMoveHistory, renderCaptured, showToast, showBanner,
  showVictory, wireSettingsDrawer, hideBootScreen
} from "./ui.js";

const params = new URLSearchParams(window.location.search);
let myColor = params.get("color") || "white";
if (myColor === "random") myColor = Math.random() < 0.5 ? "white" : "black";
const difficultyKey = params.get("difficulty") || "medium";
const difficulty = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medium;

let engine = new ChessEngine();
let boardScene = null;
let selectedSquare = null;
let pendingPromotion = null;
let thinking = false;
let gameOver = false;
let fallbackNoticeShown = false;

const settings = Settings.get();
Audio_.setEnabled(settings.sound);

async function boot() {
  $("#modePillText").textContent = `vs Computer · ${difficulty.label}`;

  const aiName = "Monarch AI";
  $("#topName").textContent = aiName;
  $("#bottomName").textContent = "You";
  $("#topAvatar").className = "avatar " + (myColor === "white" ? "black-avatar" : "");
  $("#bottomAvatar").className = "avatar " + (myColor === "black" ? "black-avatar" : "");
  $("#topAvatar").textContent = "♛";
  $("#bottomAvatar").textContent = "♟";
  $("#topCapturedLabel").textContent = `Captured by ${aiName}`;
  $("#bottomCapturedLabel").textContent = "Captured by You";

  initBoardScene();
  wireControls();
  wireSettingsDrawer(applySettingsLive);
  renderMoveHistory($("#moveList"), []);
  updateTurnUI();
  hideBootScreen();

  preloadEngine();

  if (myColor === "black") {
    // AI plays White and opens.
    triggerAiMove();
  }
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
// Turn / status UI
// ---------------------------------------------------------------------

function myTurn() {
  return !gameOver && !thinking && ((engine.turn() === "w" && myColor === "white") || (engine.turn() === "b" && myColor === "black"));
}

function updateTurnUI() {
  const isMyTurn = myTurn();
  $("#topPlayerCard").classList.toggle("active-turn", !isMyTurn && !gameOver);
  $("#bottomPlayerCard").classList.toggle("active-turn", isMyTurn);
  $("#topStatus").textContent = gameOver ? "Game over" : (thinking ? "Thinking…" : "Waiting");
  $("#bottomStatus").textContent = gameOver ? "Game over" : (isMyTurn ? "Your move" : "Opponent's move");
  $("#undoBtn").disabled = thinking || gameOver || engine.history().length < 1;
}

function refreshBoardAndHistory() {
  renderMoveHistory($("#moveList"), engine.history(true));
  const captured = engine.capturedPieces();
  const aiCaptured = myColor === "white" ? captured.capturedByBlack : captured.capturedByWhite;
  const meCaptured = myColor === "white" ? captured.capturedByWhite : captured.capturedByBlack;
  renderCaptured($("#capturedByTop"), aiCaptured);
  renderCaptured($("#capturedByBottom"), meCaptured);

  if (engine.isCheck() && !engine.isGameOver()) {
    boardScene.setCheckHighlight(engine.kingSquare(engine.turn()));
    showBanner($("#checkBanner"));
    Audio_.check();
  } else {
    boardScene.clearCheckHighlight();
  }
}

// ---------------------------------------------------------------------
// Player interaction
// ---------------------------------------------------------------------

function onSquareClick(square) {
  if (!myTurn()) { if (!gameOver && !thinking) Audio_.error(); return; }

  const boardPiece = pieceAt(square);

  if (selectedSquare && selectedSquare !== square) {
    const moves = engine.legalMoves(selectedSquare).filter(m => m.to === square);
    if (moves.length) {
      if (moves.length > 1 || moves[0].flags.includes("p")) {
        pendingPromotion = { from: selectedSquare, to: square, color: engine.turn() };
        openPromotionModal();
        return;
      }
      commitPlayerMove(selectedSquare, square, null);
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
  const file = "abcdefgh".indexOf(square[0]);
  const rank = parseInt(square[1], 10) - 1;
  return board[7 - rank][file];
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
      commitPlayerMove(from, to, code);
    });
    container.appendChild(btn);
  });
  $("#promotionModal").classList.add("open");
}

function getCastleRookSquares(moveResult) {
  if (!moveResult.flags || (!moveResult.flags.includes("k") && !moveResult.flags.includes("q"))) return null;
  const rank = moveResult.color === "w" ? "1" : "8";
  if (moveResult.flags.includes("k")) return { from: "h" + rank, to: "f" + rank };
  return { from: "a" + rank, to: "d" + rank };
}

function commitPlayerMove(from, to, promotion) {
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

  refreshBoardAndHistory();
  updateTurnUI();

  if (checkForGameOver()) return;
  triggerAiMove();
}

// ---------------------------------------------------------------------
// AI move
// ---------------------------------------------------------------------

async function triggerAiMove() {
  thinking = true;
  updateTurnUI();
  showBanner($("#thinkingBanner"), 0);

  if (usingFallback() && !fallbackNoticeShown) {
    fallbackNoticeShown = true;
    showToast({ title: "Stockfish unavailable — using the lightweight fallback bot instead." }, $("#toastStack"));
  }

  const move = await getAiMove(engine, difficultyKey);
  $("#thinkingBanner").classList.remove("show");

  if (!move) { thinking = false; updateTurnUI(); return; }

  const result = engine.move(move);
  thinking = false;
  if (!result) { updateTurnUI(); return; }

  const castle = getCastleRookSquares(result);
  boardScene.animateMove(move.from, move.to, {
    promotion: result.promotion || null,
    castleRookFrom: castle?.from, castleRookTo: castle?.to
  }).then(() => { if (result.captured) Audio_.capture(); else Audio_.move(); });

  refreshBoardAndHistory();
  updateTurnUI();
  checkForGameOver();
}

// ---------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------

function checkForGameOver() {
  const info = engine.gameOverInfo();
  if (!info) return false;
  gameOver = true;
  updateTurnUI();
  handleGameOver(info);
  return true;
}

function handleGameOver(info) {
  boardScene.clearHighlights();
  boardScene.clearSelected();
  Audio_.checkmate();

  const reasonLabels = {
    checkmate: "By checkmate",
    stalemate: "By stalemate",
    "threefold-repetition": "By threefold repetition",
    "insufficient-material": "By insufficient material",
    "fifty-move-rule": "By the fifty-move rule",
    resignation: "By resignation"
  };

  let winnerText;
  if (!info.winner) {
    winnerText = "Draw";
  } else {
    winnerText = info.winner === myColor ? "You Win" : "Monarch AI Wins";
  }

  showVictory({
    eyebrow: info.reason === "checkmate" ? "Checkmate" : "Game Over",
    winnerText,
    reasonText: reasonLabels[info.reason] || ""
  });
}

function resignGame() {
  if (gameOver) return;
  gameOver = true;
  updateTurnUI();
  handleGameOver({ winner: myColor === "white" ? "black" : "white", reason: "resignation" });
}

// ---------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------

function undoMove() {
  if (thinking || gameOver) return;
  // Undo AI's reply (if it already moved) and the player's move before it,
  // returning the board to the player's turn.
  const history = engine.history();
  if (!history.length) return;

  engine.undo();
  if (engine.history().length && engine.turn() !== (myColor === "white" ? "w" : "b")) {
    engine.undo();
  }

  boardScene.clearHighlights();
  boardScene.clearSelected();
  boardScene.setPosition(engine.board());
  selectedSquare = null;
  gameOver = false;
  refreshBoardAndHistory();
  updateTurnUI();
  Audio_.click();
}

// ---------------------------------------------------------------------
// Static controls
// ---------------------------------------------------------------------

function wireControls() {
  $("#camResetBtn").addEventListener("click", () => boardScene.resetCamera());
  $("#camFlipBtn").addEventListener("click", () => boardScene.flipBoard());

  $("#soundToggleBtn").addEventListener("click", () => {
    const s = Settings.set({ sound: !Settings.get().sound });
    Audio_.setEnabled(s.sound);
    $("#soundToggleBtn").style.opacity = s.sound ? "1" : "0.4";
  });

  $("#resignBtn").addEventListener("click", () => {
    if (gameOver) return;
    if (confirm("Resign this game?")) resignGame();
  });
  $("#undoBtn").addEventListener("click", undoMove);

  $("#rematchBtn").addEventListener("click", () => window.location.reload());
  $("#exitFromVictoryBtn").addEventListener("click", () => { window.location.href = "index.html"; });
  $("#exitGameBtn").addEventListener("click", () => { window.location.href = "index.html"; });
}

boot();
