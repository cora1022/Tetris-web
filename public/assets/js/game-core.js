export const BOARD_COLUMNS = 10;
export const BOARD_ROWS = 20;

export const PIECES = Object.freeze({
  I: { color: '#38bdf8', matrix: [[1, 1, 1, 1]] },
  O: { color: '#facc15', matrix: [[1, 1], [1, 1]] },
  T: { color: '#a78bfa', matrix: [[0, 1, 0], [1, 1, 1]] },
  S: { color: '#4ade80', matrix: [[0, 1, 1], [1, 1, 0]] },
  Z: { color: '#fb7185', matrix: [[1, 1, 0], [0, 1, 1]] },
  J: { color: '#60a5fa', matrix: [[1, 0, 0], [1, 1, 1]] },
  L: { color: '#fb923c', matrix: [[0, 0, 1], [1, 1, 1]] },
});

export function createBoard(rows = BOARD_ROWS, columns = BOARD_COLUMNS) {
  return Array.from({ length: rows }, () => Array(columns).fill(null));
}

export function createPiece(type) {
  const definition = PIECES[type];
  if (!definition) throw new Error(`알 수 없는 블록: ${type}`);
  return {
    type,
    color: definition.color,
    matrix: definition.matrix.map((row) => [...row]),
    x: Math.floor((BOARD_COLUMNS - definition.matrix[0].length) / 2),
    y: 0,
  };
}

export function rotateMatrix(matrix, clockwise = true) {
  const height = matrix.length;
  const width = matrix[0].length;
  return clockwise
    ? Array.from({ length: width }, (_, y) => Array.from({ length: height }, (_, x) => matrix[height - 1 - x][y]))
    : Array.from({ length: width }, (_, y) => Array.from({ length: height }, (_, x) => matrix[x][width - 1 - y]));
}

export function collides(board, piece) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x]) continue;
      const boardX = piece.x + x;
      const boardY = piece.y + y;
      if (boardX < 0 || boardX >= board[0].length || boardY >= board.length) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

export function movePiece(piece, xDelta, yDelta) {
  return { ...piece, x: piece.x + xDelta, y: piece.y + yDelta };
}

export function tryRotate(board, piece, clockwise = true) {
  if (piece.type === 'O') return piece;
  const rotated = { ...piece, matrix: rotateMatrix(piece.matrix, clockwise) };
  const kicks = [0, -1, 1, -2, 2];
  for (const offset of kicks) {
    const candidate = { ...rotated, x: rotated.x + offset };
    if (!collides(board, candidate)) return candidate;
  }
  const raised = { ...rotated, y: rotated.y - 1 };
  return collides(board, raised) ? piece : raised;
}

export function mergePiece(board, piece) {
  const result = board.map((row) => [...row]);
  piece.matrix.forEach((row, y) => row.forEach((cell, x) => {
    const boardY = piece.y + y;
    const boardX = piece.x + x;
    if (cell && boardY >= 0) result[boardY][boardX] = piece.color;
  }));
  return result;
}

export function clearCompletedLines(board) {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = board.length - remaining.length;
  const emptyRows = Array.from({ length: cleared }, () => Array(board[0].length).fill(null));
  return { board: [...emptyRows, ...remaining.map((row) => [...row])], cleared };
}

export function scoreForLines(cleared, level) {
  return ([0, 100, 300, 500, 800][cleared] || 0) * Math.max(1, level);
}

export function dropDistance(board, piece) {
  let distance = 0;
  while (!collides(board, movePiece(piece, 0, distance + 1))) distance += 1;
  return distance;
}
