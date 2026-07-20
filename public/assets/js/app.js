import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  clearCompletedLines,
  collides,
  createBoard,
  createPiece,
  dropDistance,
  mergePiece,
  movePiece,
  scoreForLines,
  tryRotate,
} from './game-core.js';
import { createSevenBag } from './random.js';

const boardCanvas = document.querySelector('[data-board]');
const nextCanvas = document.querySelector('[data-next]');
const boardContext = boardCanvas.getContext('2d');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.querySelector('[data-score]');
const linesElement = document.querySelector('[data-lines]');
const levelElement = document.querySelector('[data-level]');
const highScoreElement = document.querySelector('[data-high-score]');
const pauseButton = document.querySelector('[data-pause]');
const overlay = document.querySelector('[data-overlay]');
const overlayTitle = document.querySelector('[data-overlay-title]');
const overlayText = document.querySelector('[data-overlay-text]');
const liveStatus = document.querySelector('[data-live-status]');

const STORAGE_KEY = 'cora:tetris:high-score:v1';
const CELL_SIZE = 30;
let board = createBoard();
let activePiece = null;
let nextType = null;
let bag = [];
let score = 0;
let lines = 0;
let level = 1;
let highScore = readHighScore();
let state = 'idle';
let dropCounter = 0;
let lastTime = 0;
let animationFrame = 0;

function readHighScore() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // 저장이 막혀도 게임은 계속할 수 있습니다.
  }
}

function takeType() {
  if (bag.length === 0) bag = createSevenBag();
  return bag.pop();
}

function dropInterval() {
  return Math.max(95, 850 - (level - 1) * 65);
}

function setStatus(message) {
  liveStatus.textContent = message;
}

function updateStats() {
  scoreElement.textContent = score.toLocaleString('ko-KR');
  linesElement.textContent = String(lines);
  levelElement.textContent = String(level);
  highScoreElement.textContent = Math.max(highScore, score).toLocaleString('ko-KR');
  boardCanvas.setAttribute('aria-label', `테트리스 게임판. 점수 ${score}점, 지운 줄 ${lines}개, 레벨 ${level}`);
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function drawCell(context, x, y, color, size = CELL_SIZE, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  context.fillStyle = 'rgba(255,255,255,.2)';
  context.fillRect(x * size + 3, y * size + 3, size - 6, 3);
  context.strokeStyle = 'rgba(15,23,42,.22)';
  context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  context.restore();
}

function drawPiece(context, piece, offsetY = 0, alpha = 1, size = CELL_SIZE) {
  piece.matrix.forEach((row, y) => row.forEach((cell, x) => {
    if (cell && piece.y + y + offsetY >= 0) {
      drawCell(context, piece.x + x, piece.y + y + offsetY, piece.color, size, alpha);
    }
  }));
}

function drawBoard() {
  boardContext.fillStyle = '#11172b';
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.strokeStyle = 'rgba(255,255,255,.055)';
  boardContext.lineWidth = 1;
  for (let x = 1; x < BOARD_COLUMNS; x += 1) {
    boardContext.beginPath();
    boardContext.moveTo(x * CELL_SIZE + 0.5, 0);
    boardContext.lineTo(x * CELL_SIZE + 0.5, boardCanvas.height);
    boardContext.stroke();
  }
  for (let y = 1; y < BOARD_ROWS; y += 1) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * CELL_SIZE + 0.5);
    boardContext.lineTo(boardCanvas.width, y * CELL_SIZE + 0.5);
    boardContext.stroke();
  }
  board.forEach((row, y) => row.forEach((color, x) => {
    if (color) drawCell(boardContext, x, y, color);
  }));
  if (activePiece) {
    drawPiece(boardContext, activePiece, dropDistance(board, activePiece), 0.2);
    drawPiece(boardContext, activePiece);
  }
}

function drawNext() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextType) return;
  const piece = createPiece(nextType);
  const size = 24;
  const width = piece.matrix[0].length * size;
  const height = piece.matrix.length * size;
  piece.x = (nextCanvas.width - width) / (size * 2);
  piece.y = (nextCanvas.height - height) / (size * 2);
  drawPiece(nextContext, piece, 0, 1, size);
}

function draw() {
  drawBoard();
  drawNext();
  updateStats();
}

function spawnNextPiece() {
  activePiece = createPiece(nextType);
  nextType = takeType();
  if (collides(board, activePiece)) finishGame();
}

function lockPiece() {
  board = mergePiece(board, activePiece);
  const result = clearCompletedLines(board);
  board = result.board;
  if (result.cleared > 0) {
    score += scoreForLines(result.cleared, level);
    lines += result.cleared;
    level = Math.floor(lines / 10) + 1;
    setStatus(`${result.cleared}줄을 지웠습니다. 현재 점수 ${score}점입니다.`);
  }
  spawnNextPiece();
}

function stepDown(manual = false) {
  if (state !== 'running') return;
  const candidate = movePiece(activePiece, 0, 1);
  if (collides(board, candidate)) {
    lockPiece();
  } else {
    activePiece = candidate;
    if (manual) score += 1;
  }
  dropCounter = 0;
  draw();
}

function moveHorizontal(direction) {
  if (state !== 'running') return;
  const candidate = movePiece(activePiece, direction, 0);
  if (!collides(board, candidate)) activePiece = candidate;
  draw();
}

function rotate(clockwise) {
  if (state !== 'running') return;
  activePiece = tryRotate(board, activePiece, clockwise);
  draw();
}

function hardDrop() {
  if (state !== 'running') return;
  const distance = dropDistance(board, activePiece);
  activePiece = movePiece(activePiece, 0, distance);
  score += distance * 2;
  lockPiece();
  dropCounter = 0;
  draw();
}

function finishGame() {
  state = 'over';
  cancelAnimationFrame(animationFrame);
  pauseButton.disabled = true;
  pauseButton.textContent = '일시정지';
  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
  }
  showOverlay('게임 종료', `${score.toLocaleString('ko-KR')}점을 기록했습니다.`);
  setStatus(`게임이 끝났습니다. 최종 점수는 ${score}점입니다.`);
  draw();
}

function update(time = 0) {
  if (state !== 'running') return;
  const delta = Math.min(100, time - lastTime);
  lastTime = time;
  dropCounter += delta;
  if (dropCounter >= dropInterval()) stepDown(false);
  if (state === 'running') animationFrame = requestAnimationFrame(update);
}

function startGame() {
  cancelAnimationFrame(animationFrame);
  board = createBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  activePiece = createPiece(takeType());
  nextType = takeType();
  state = 'running';
  pauseButton.disabled = false;
  pauseButton.textContent = '일시정지';
  hideOverlay();
  setStatus('새 게임을 시작했습니다.');
  draw();
  boardCanvas.focus({ preventScroll: true });
  lastTime = performance.now();
  animationFrame = requestAnimationFrame(update);
}

function togglePause() {
  if (state === 'running') {
    state = 'paused';
    cancelAnimationFrame(animationFrame);
    pauseButton.textContent = '계속하기';
    showOverlay('일시정지', '계속하기 버튼이나 P 키를 누르세요.');
    setStatus('게임을 일시정지했습니다.');
  } else if (state === 'paused') {
    state = 'running';
    pauseButton.textContent = '일시정지';
    hideOverlay();
    setStatus('게임을 계속합니다.');
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(update);
    boardCanvas.focus({ preventScroll: true });
  }
}

function performAction(action) {
  const actions = {
    left: () => moveHorizontal(-1),
    right: () => moveHorizontal(1),
    down: () => stepDown(true),
    rotate: () => rotate(true),
    'rotate-back': () => rotate(false),
    drop: hardDrop,
  };
  actions[action]?.();
}

document.querySelector('[data-start]').addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    performAction(button.dataset.action);
  });
});

document.addEventListener('keydown', (event) => {
  const keyActions = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowUp: 'rotate',
    z: 'rotate-back',
    Z: 'rotate-back',
    ' ': 'drop',
  };
  if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
    if (state === 'running' || state === 'paused') {
      event.preventDefault();
      togglePause();
    }
    return;
  }
  const action = keyActions[event.key];
  if (action && state === 'running') {
    event.preventDefault();
    performAction(action);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'running') togglePause();
});

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

highScoreElement.textContent = highScore.toLocaleString('ko-KR');
draw();
