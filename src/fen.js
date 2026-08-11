"use strict";

const FEN_REGEX =
  /^(?<board>[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+)\s+(?<turn>[wb])\s+(?<castling>-|[KQkq]{1,4})\s+(?<enPassant>-|[a-h][36])\s+(?<halfmove>\d+)\s+(?<fullmove>\d+)$/;

function isValidFen(fen) {
  if (typeof fen !== "string") return false;
  const match = FEN_REGEX.exec(fen.trim());
  if (!match) return false;

  const ranks = match.groups.board.split("/");
  return ranks.every((rank) => {
    let squares = 0;
    for (const char of rank) {
      if (/\d/.test(char)) {
        squares += Number(char);
      } else {
        squares += 1;
      }
    }
    return squares === 8;
  });
}

module.exports = { isValidFen };
