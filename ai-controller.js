// ==========================================================================
// MONARCH — AI Controller
// Single entry point game logic calls: getAiMove(chessEngine, difficulty).
// Tries the real Stockfish engine first; if it can't load (network/CORS/
// blocked), transparently falls back to a weaker built-in bot rather than
// breaking "Play vs Computer" entirely.
// ==========================================================================

import { StockfishEngine } from "./ai-engine.js";
import { pickFallbackMove } from "./simple-bot.js";

export const DIFFICULTIES = {
  easy:   { label: "Easy",   skill: 2,  elo: 800,  movetimeMs: 350 },
  medium: { label: "Medium", skill: 8,  elo: 1350, movetimeMs: 650 },
  hard:   { label: "Hard",   skill: 14, elo: 1900, movetimeMs: 1100 },
  expert: { label: "Expert", skill: 20, elo: null, movetimeMs: 2000 }
};

let engine = null;
let engineFailed = false;
let initPromise = null;

export function usingFallback() { return engineFailed; }

async function ensureEngine() {
  if (engineFailed) return null;
  if (engine && engine.ready) return engine;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const e = new StockfishEngine();
        await e.init();
        engine = e;
        return e;
      } catch (err) {
        console.warn("[MONARCH] Stockfish unavailable, using fallback bot:", err.message);
        engineFailed = true;
        return null;
      }
    })();
  }
  return initPromise;
}

// Kick off loading early (called as soon as the AI game screen boots) so the
// engine is warm by the time the player makes their first move.
export function preloadEngine() { ensureEngine(); }

function uciToMoveObject(uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : null;
  return { from, to, promotion };
}

// Returns { from, to, promotion } — the chosen move, in the same shape the
// board/game controller already uses for player moves.
export async function getAiMove(chessEngine, difficultyKey) {
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medium;
  const eng = await ensureEngine();

  if (eng) {
    try {
      eng.setSkillLevel(diff.skill, diff.elo);
      const uci = await eng.bestMove(chessEngine.fen(), { movetimeMs: diff.movetimeMs });
      return uciToMoveObject(uci);
    } catch (err) {
      console.warn("[MONARCH] Stockfish move failed, falling back for this move:", err.message);
    }
  }

  const fallback = pickFallbackMove(chessEngine, difficultyKey);
  if (!fallback) return null;
  return { from: fallback.from, to: fallback.to, promotion: fallback.promotion || null };
}
