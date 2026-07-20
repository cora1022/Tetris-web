import test from 'node:test';
import assert from 'node:assert/strict';
import { createSevenBag, secureRandomInt } from '../public/assets/js/random.js';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  clearCompletedLines,
  collides,
  createBoard,
  createPiece,
  dropDistance,
  mergePiece,
  rotateMatrix,
  scoreForLines,
  tryRotate,
} from '../public/assets/js/game-core.js';

function sourceFrom(values) {
  let index = 0;
  return { getRandomValues(array) { array[0] = values[index % values.length]; index += 1; return array; } };
}

test('보안 난수는 지정한 범위 안의 정수를 만든다', () => {
  assert.equal(secureRandomInt(10, sourceFrom([17])), 7);
  assert.throws(() => secureRandomInt(0, sourceFrom([0])), RangeError);
});

test('7-bag은 일곱 블록을 중복 없이 포함한다', () => {
  const bag = createSevenBag(sourceFrom([1, 2, 3, 4, 5, 6, 7]));
  assert.equal(bag.length, 7);
  assert.deepEqual([...bag].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
});

test('보드는 10×20으로 생성되고 충돌을 판정한다', () => {
  const board = createBoard();
  assert.equal(board.length, BOARD_ROWS);
  assert.equal(board[0].length, BOARD_COLUMNS);
  const piece = createPiece('O');
  assert.equal(collides(board, piece), false);
  assert.equal(collides(board, { ...piece, x: -1 }), true);
  assert.equal(collides(board, { ...piece, y: BOARD_ROWS - 1 }), true);
});

test('회전은 행과 열을 바꾸고 벽에 닿으면 위치를 보정한다', () => {
  assert.deepEqual(rotateMatrix([[1, 0], [1, 1]], true), [[1, 1], [1, 0]]);
  const board = createBoard();
  const piece = { ...createPiece('I'), matrix: [[1], [1], [1], [1]], x: 9 };
  const rotated = tryRotate(board, piece, true);
  assert.equal(collides(board, rotated), false);
});

test('완성된 줄을 지우고 위에 빈 줄을 채운다', () => {
  const board = createBoard(4, 4);
  board[2] = ['x', 'x', 'x', 'x'];
  board[3] = ['x', null, null, null];
  const result = clearCompletedLines(board);
  assert.equal(result.cleared, 1);
  assert.deepEqual(result.board[0], [null, null, null, null]);
  assert.deepEqual(result.board[3], ['x', null, null, null]);
});

test('블록 합치기, 낙하 거리와 점수 계산이 일치한다', () => {
  const board = createBoard();
  const piece = { ...createPiece('O'), x: 4, y: 0 };
  assert.equal(dropDistance(board, piece), 18);
  const landed = { ...piece, y: 18 };
  const merged = mergePiece(board, landed);
  assert.equal(merged[19][4], piece.color);
  assert.equal(scoreForLines(4, 3), 2400);
});
