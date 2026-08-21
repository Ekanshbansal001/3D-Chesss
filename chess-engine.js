// ==========================================================================
// MONARCH — Chess Engine
// Thin wrapper around chess.js. All rule adjudication (legality, check,
// checkmate, stalemate, castling, en passant, promotion, repetition,
// the fifty-move rule) is delegated to the mature chess.js library —
// never re-implemented by hand.
// ==========================================================================

import { Chess } from "https://cdn.skypack.dev/chess.js@1.0.0-beta.8";

export class ChessEngine {
  constructor(fen) {
    this.chess = fen ? new Chess(fen) : new Chess();
  }

  reset() { this.chess.reset(); }

  loadFen(fen) { this.chess.load(fen); }
  loadPgn(pgn) { this.chess.loadPgn(pgn); }

  fen() { return this.chess.fen(); }
  pgn() { return this.chess.pgn(); }

  turn() { return this.chess.turn(); } // 'w' | 'b'

  board() { return this.chess.board(); } // 8x8 array of {type,color,square}|null

  // Legal moves. If square provided, only moves from that square.
  legalMoves(square) {
    return this.chess.moves({ square, verbose: true });
  }

  move({ from, to, promotion }) {
    try {
      const result = this.chess.move({ from, to, promotion });
      return result || null;
    } catch (e) {
      return null;
    }
  }

  undo() { return this.chess.undo(); }

  history(verbose = true) { return this.chess.history({ verbose }); }

  isCheck() { return this.chess.inCheck ? this.chess.inCheck() : this.chess.isCheck(); }
  isCheckmate() { return this.chess.isCheckmate(); }
  isStalemate() { return this.chess.isStalemate(); }
  isThreefoldRepetition() { return this.chess.isThreefoldRepetition(); }
  isInsufficientMaterial() { return this.chess.isInsufficientMaterial(); }
  isDraw() { return this.chess.isDraw(); }
  isGameOver() { return this.chess.isGameOver(); }

  // Fifty-move rule surrogate: chess.js folds this into isDraw(), but we
  // expose halfmove clock for UI/debugging via FEN parsing.
  halfmoveClock() {
    const parts = this.chess.fen().split(" ");
    return parseInt(parts[4] || "0", 10);
  }

  kingSquare(color) {
    const board = this.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === color) return p.square;
      }
    }
    return null;
  }

  // Captured pieces derived from move history — grouped by the color that captured them.
  capturedPieces() {
    const verbose = this.history(true);
    const capturedByWhite = []; // black pieces captured by white
    const capturedByBlack = []; // white pieces captured by black
    for (const m of verbose) {
      if (m.captured) {
        const piece = { type: m.captured, color: m.color === "w" ? "b" : "w" };
        if (m.color === "w") capturedByWhite.push(piece);
        else capturedByBlack.push(piece);
      }
    }
    return { capturedByWhite, capturedByBlack };
  }

  gameOverInfo() {
    if (!this.isGameOver()) return null;
    if (this.isCheckmate()) {
      const winner = this.turn() === "w" ? "black" : "white"; // side to move is the one mated
      return { reason: "checkmate", winner };
    }
    if (this.isStalemate()) return { reason: "stalemate", winner: null };
    if (this.isThreefoldRepetition()) return { reason: "threefold-repetition", winner: null };
    if (this.isInsufficientMaterial()) return { reason: "insufficient-material", winner: null };
    if (this.isDraw()) return { reason: "fifty-move-rule", winner: null };
    return { reason: "draw", winner: null };
  }
}
