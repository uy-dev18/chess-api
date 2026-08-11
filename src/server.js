"use strict";

const express = require("express");
const cors = require("cors");
const { ChessEngine, HttpError } = require("./engine");

const PORT = process.env.PORT || 3000;

const app = express();
const engine = new ChessEngine();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "chess-api",
    endpoints: {
      "GET /api/health": "kiểm tra trạng thái server",
      "POST /api/best-move": "body: { fen, depth?, movetimeMs?, elo? } -> nước đi tốt nhất",
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/best-move", async (req, res, next) => {
  try {
    const { fen, depth, movetimeMs, elo } = req.body || {};
    const result = await engine.getBestMove(fen, { depth, movetimeMs, elo });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Không tìm thấy route" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || "Lỗi server" });
});

app.listen(PORT, () => {
  console.log(`chess-api đang chạy tại http://localhost:${PORT}`);
});
