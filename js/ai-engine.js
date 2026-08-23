// ==========================================================================
// MONARCH — Stockfish Engine Wrapper
//
// Loads the real Stockfish chess engine (asm.js build, runs entirely in the
// browser — no server, no API calls) inside a Web Worker so the 3D board
// never freezes while it thinks.
//
// Workers can't normally be created from a cross-origin script URL, so we
// fetch the engine source as text (the CDN sends CORS headers) and spin the
// worker up from a same-origin Blob URL instead — a standard, well-supported
// pattern.
// ==========================================================================

const STOCKFISH_CDN_URL = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

export class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this._pendingBestMove = null;
  }

  async init() {
    const res = await fetch(STOCKFISH_CDN_URL);
    if (!res.ok) throw new Error("stockfish-fetch-failed");
    const src = await res.text();
    const blob = new Blob([src], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    this.worker = new Worker(blobUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("stockfish-init-timeout")), 8000);
      const onMsg = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line.includes("uciok")) {
          clearTimeout(timeout);
          this.worker.removeEventListener("message", onMsg);
          resolve();
        }
      };
      this.worker.addEventListener("message", onMsg);
      this.worker.postMessage("uci");
    });

    await this._isReady();
    this.ready = true;
  }

  _isReady() {
    return new Promise((resolve) => {
      const onMsg = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line.includes("readyok")) {
          this.worker.removeEventListener("message", onMsg);
          resolve();
        }
      };
      this.worker.addEventListener("message", onMsg);
      this.worker.postMessage("isready");
    });
  }

  setSkillLevel(level, elo) {
    // level: 0-20 (Stockfish's native "dumb it down" knob)
    this.worker.postMessage(`setoption name Skill Level value ${level}`);
    if (elo) {
      this.worker.postMessage("setoption name UCI_LimitStrength value true");
      this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
    } else {
      this.worker.postMessage("setoption name UCI_LimitStrength value false");
    }
  }

  bestMove(fen, { movetimeMs = 800, depth = null } = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("stockfish-move-timeout")), movetimeMs + 6000);
      const onMsg = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line.startsWith("bestmove")) {
          clearTimeout(timeout);
          this.worker.removeEventListener("message", onMsg);
          const uci = line.split(" ")[1];
          if (!uci || uci === "(none)") { reject(new Error("no-legal-move")); return; }
          resolve(uci);
        }
      };
      this.worker.addEventListener("message", onMsg);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(depth ? `go depth ${depth}` : `go movetime ${movetimeMs}`);
    });
  }

  destroy() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.ready = false;
  }
}
