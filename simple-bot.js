// ==========================================================================
// MONARCH — Fallback bot
// A simple 1-ply material-greedy mover with randomness. Only used if
// Stockfish fails to load (blocked CDN, offline, etc.) so "Play vs
// Computer" always has a real, working opponent — just a weaker one,
// clearly communicated to the player rather than pretending it's the
// full engine.
// ==========================================================================

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// randomness: 0 = always best move, 1 = fully random
function randomness(difficulty) {
  return { easy: 0.65, medium: 0.35, hard: 0.12, expert: 0 }[difficulty] ?? 0.35;
}

export function pickFallbackMove(chessEngine, difficulty) {
  const moves = chessEngine.legalMoves();
  if (!moves.length) return null;

  const rnd = randomness(difficulty);
  if (Math.random() < rnd) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    let score = 0;
    if (m.captured) score += VALUES[m.captured] * 10;
    if (m.promotion) score += VALUES[m.promotion] * 8;
    if (m.flags && (m.flags.includes("k") || m.flags.includes("q"))) score += 3; // castling
    score += Math.random() * 2; // tie-break jitter
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best || moves[0];
}
