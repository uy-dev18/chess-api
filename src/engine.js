"use strict";

const initStockfish = require("stockfish");
const { isValidFen } = require("./fen");

const ENGINE_VARIANT = process.env.STOCKFISH_ENGINE || "lite-single";
const DEFAULT_DEPTH = 15;
const MAX_DEPTH = 25;
const MIN_MOVETIME_MS = 100;
const MAX_MOVETIME_MS = 15000;
const MIN_ELO = 1320;
const MAX_ELO = 3190;
const COMMAND_TIMEOUT_MS = 20000;
const STOP_GRACE_PERIOD_MS = 5000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class ChessEngine {
  constructor() {
    this._enginePromise = null;
    this._queue = Promise.resolve();
  }

  async _getEngine() {
    if (!this._enginePromise) {
      const enginePromise = this._createEngine();
      this._enginePromise = enginePromise;

      try {
        return await enginePromise;
      } catch (error) {
        // Cho phép request sau khởi tạo lại nếu lần khởi tạo này thất bại.
        if (this._enginePromise === enginePromise) {
          this._enginePromise = null;
        }
        throw error;
      }
    }
    return this._enginePromise;
  }

  async _createEngine() {
    const engine = await initStockfish(ENGINE_VARIANT);
    await this._waitFor(engine, "uci", (line) => line === "uciok");
    await this._waitFor(engine, "isready", (line) => line === "readyok");
    engine.sendCommand("ucinewgame");
    await this._waitFor(engine, "isready", (line) => line === "readyok");
    return engine;
  }

  _waitFor(engine, command, isDone) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        engine.listener = null;
        reject(new Error(`Stockfish timed out on "${command}"`));
      }, COMMAND_TIMEOUT_MS);

      engine.listener = (line) => {
        if (isDone(line)) {
          clearTimeout(timer);
          engine.listener = null;
          resolve(line);
        }
      };

      engine.sendCommand(command);
    });
  }

  _enqueue(task) {
    const result = this._queue.then(task, task);
    this._queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async _setStrength(engine, elo) {
    if (elo) {
      engine.sendCommand("setoption name UCI_LimitStrength value true");
      engine.sendCommand(`setoption name UCI_Elo value ${elo}`);
    } else {
      engine.sendCommand("setoption name UCI_LimitStrength value false");
    }
    await this._waitFor(engine, "isready", (line) => line === "readyok");
  }

  async getBestMove(fen, options = {}) {
    if (!isValidFen(fen)) {
      throw new HttpError(400, "fen không hợp lệ");
    }

    const depth = clampInt(options.depth, DEFAULT_DEPTH, 1, MAX_DEPTH);
    const movetimeMs = options.movetimeMs
      ? clampInt(options.movetimeMs, MIN_MOVETIME_MS, MIN_MOVETIME_MS, MAX_MOVETIME_MS)
      : null;
    const elo = options.elo != null ? clampInt(options.elo, null, MIN_ELO, MAX_ELO) : null;

    return this._enqueue(async () => {
      const engine = await this._getEngine();

      await this._setStrength(engine, elo);

      engine.sendCommand(`position fen ${fen}`);

      const goCommand = movetimeMs ? `go movetime ${movetimeMs}` : `go depth ${depth}`;

      let lastInfo = null;
      const bestmoveLine = await new Promise((resolve, reject) => {
        let hardTimeout = null;

        const cleanup = () => {
          clearTimeout(softTimeout);
          if (hardTimeout) clearTimeout(hardTimeout);
          engine.listener = null;
        };

        // Depth không đảm bảo hoàn thành trong một khoảng thời gian cố định.
        // Khi hết thời gian, yêu cầu Stockfish trả nước tốt nhất đã tìm được
        // thay vì bỏ listener trong lúc engine vẫn đang chạy.
        const softTimeout = setTimeout(() => {
          engine.sendCommand("stop");

          hardTimeout = setTimeout(() => {
            cleanup();
            this._enginePromise = null;
            reject(new Error("Stockfish không phản hồi sau khi yêu cầu dừng"));
          }, STOP_GRACE_PERIOD_MS);
        }, COMMAND_TIMEOUT_MS);

        engine.listener = (line) => {
          if (line.startsWith("info") && line.includes(" score ")) {
            lastInfo = line;
          } else if (line.startsWith("bestmove")) {
            cleanup();
            resolve(line);
          }
        };

        engine.sendCommand(goCommand);
      });

      return parseBestMove(bestmoveLine, lastInfo);
    });
  }
}

function parseBestMove(bestmoveLine, infoLine) {
  const match = /^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/.exec(bestmoveLine);
  if (!match) {
    throw new Error(`Không parse được phản hồi của engine: "${bestmoveLine}"`);
  }

  const [, bestMove, ponder] = match;

  const result = {
    bestMove: bestMove === "(none)" ? null : bestMove,
    ponder: ponder || null,
  };

  if (infoLine) {
    const depthMatch = /\bdepth (\d+)/.exec(infoLine);
    const cpMatch = /\bscore cp (-?\d+)/.exec(infoLine);
    const mateMatch = /\bscore mate (-?\d+)/.exec(infoLine);
    const pvMatch = /\bpv (.+)$/.exec(infoLine);

    result.depth = depthMatch ? Number(depthMatch[1]) : undefined;
    if (mateMatch) {
      result.mateIn = Number(mateMatch[1]);
    } else if (cpMatch) {
      result.evaluationCp = Number(cpMatch[1]);
    }
    result.principalVariation = pvMatch ? pvMatch[1].trim().split(/\s+/) : undefined;
  }

  return result;
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

module.exports = { ChessEngine, HttpError };
