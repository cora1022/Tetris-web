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
  resolveHold,
  scoreForLines,
  tryRotate,
} from './game-core.js?v=20260720-2';
import { createSevenBag } from './random.js?v=20260720-2';

const boardCanvas = document.querySelector('[data-board]');
const nextCanvas = document.querySelector('[data-next]');
const holdCanvas = document.querySelector('[data-hold]');
const boardContext = boardCanvas.getContext('2d');
const nextContext = nextCanvas.getContext('2d');
const holdContext = holdCanvas.getContext('2d');
const scoreElement = document.querySelector('[data-score]');
const linesElement = document.querySelector('[data-lines]');
const levelElement = document.querySelector('[data-level]');
const highScoreElement = document.querySelector('[data-high-score]');
const pauseButton = document.querySelector('[data-pause]');
const overlay = document.querySelector('[data-overlay]');
const overlayTitle = document.querySelector('[data-overlay-title]');
const overlayText = document.querySelector('[data-overlay-text]');
const liveStatus = document.querySelector('[data-live-status]');
const holdButtons = document.querySelectorAll('[data-action="hold"]');

const STORAGE_KEY = 'cora:tetris:high-score:v1';
const CELL_SIZE = 30;
const LOCK_DELAY = 450;
const MAX_LOCK_RESETS = 15;
const HORIZONTAL_DELAY = 135;
const HORIZONTAL_REPEAT = 42;
const SOFT_DROP_REPEAT = 42;
let board = createBoard();
let activePiece = null;
let nextType = null;
let heldType = null;
let canHold = true;
let bag = [];
let score = 0;
let lines = 0;
let level = 1;
let highScore = readHighScore();
let state = 'idle';
let dropCounter = 0;
let lastTime = 0;
let animationFrame = 0;
let lockCounter = 0;
let lockResets = 0;
const input = {
  left: false,
  right: false,
  down: false,
  horizontal: 0,
  horizontalHeld: 0,
  horizontalRepeat: 0,
  downRepeat: 0,
};

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
  holdButtons.forEach((button) => { button.disabled = state !== 'running' || !canHold; });
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

function drawPreview(context, canvas, type) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!type) return;
  const piece = createPiece(type);
  const size = 24;
  const width = piece.matrix[0].length * size;
  const height = piece.matrix.length * size;
  piece.x = (canvas.width - width) / (size * 2);
  piece.y = (canvas.height - height) / (size * 2);
  drawPiece(context, piece, 0, 1, size);
}

function draw() {
  drawBoard();
  drawPreview(nextContext, nextCanvas, nextType);
  drawPreview(holdContext, holdCanvas, heldType);
  updateStats();
}

function resetLockState() {
  lockCounter = 0;
  lockResets = 0;
}

function resetInputState() {
  input.left = false;
  input.right = false;
  input.down = false;
  input.horizontal = 0;
  input.horizontalHeld = 0;
  input.horizontalRepeat = 0;
  input.downRepeat = 0;
}

function isGrounded(piece = activePiece) {
  return Boolean(piece) && collides(board, movePiece(piece, 0, 1));
}

function resetGroundedLock(wasGrounded) {
  if (wasGrounded && lockResets < MAX_LOCK_RESETS) {
    lockCounter = 0;
    lockResets += 1;
  }
}

function spawnNextPiece() {
  activePiece = createPiece(nextType);
  nextType = takeType();
  resetLockState();
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
  canHold = true;
  spawnNextPiece();
}

function stepDown(manual = false) {
  if (state !== 'running') return false;
  const candidate = movePiece(activePiece, 0, 1);
  if (collides(board, candidate)) return false;
  activePiece = candidate;
  if (manual) score += 1;
  dropCounter = 0;
  resetLockState();
  draw();
  return true;
}

function moveHorizontal(direction) {
  if (state !== 'running') return;
  const wasGrounded = isGrounded();
  const candidate = movePiece(activePiece, direction, 0);
  if (!collides(board, candidate)) {
    activePiece = candidate;
    resetGroundedLock(wasGrounded);
  }
  draw();
}

function rotate(clockwise) {
  if (state !== 'running') return;
  const previousPiece = activePiece;
  const wasGrounded = isGrounded();
  activePiece = tryRotate(board, activePiece, clockwise);
  if (activePiece !== previousPiece) resetGroundedLock(wasGrounded);
  draw();
}

function holdPiece() {
  if (state !== 'running' || !canHold) return;
  const held = resolveHold(activePiece.type, heldType, nextType);
  heldType = held.heldType;
  activePiece = createPiece(held.activeType);
  if (held.consumeNext) nextType = takeType();
  canHold = false;
  dropCounter = 0;
  resetLockState();
  if (collides(board, activePiece)) {
    finishGame();
    return;
  }
  setStatus(`${heldType} 블록을 보관했습니다.`);
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
  resetInputState();
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
  processHeldInput(delta);
  dropCounter += delta;
  if (dropCounter >= dropInterval()) stepDown(false);
  if (state === 'running' && isGrounded()) {
    lockCounter += delta;
    if (lockCounter >= LOCK_DELAY) lockPiece();
  } else {
    lockCounter = 0;
  }
  draw();
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
  heldType = null;
  canHold = true;
  resetInputState();
  resetLockState();
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
    resetInputState();
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
    hold: holdPiece,
  };
  actions[action]?.();
}

function setContinuousInput(action, pressed) {
  input[action] = pressed;
  if (action === 'down') {
    input.downRepeat = 0;
    if (pressed) stepDown(true);
    return;
  }

  const direction = action === 'left' ? -1 : 1;
  if (pressed) {
    input.horizontal = direction;
    input.horizontalHeld = 0;
    input.horizontalRepeat = 0;
    moveHorizontal(direction);
  } else if (input.horizontal === direction) {
    const fallback = input.left ? -1 : input.right ? 1 : 0;
    input.horizontal = fallback;
    input.horizontalHeld = 0;
    input.horizontalRepeat = 0;
    if (fallback) moveHorizontal(fallback);
  }
}

function processHeldInput(delta) {
  if (input.horizontal) {
    const previousHeld = input.horizontalHeld;
    input.horizontalHeld += delta;
    if (input.horizontalHeld >= HORIZONTAL_DELAY) {
      input.horizontalRepeat += previousHeld < HORIZONTAL_DELAY
        ? input.horizontalHeld - HORIZONTAL_DELAY
        : delta;
      while (input.horizontalRepeat >= HORIZONTAL_REPEAT) {
        moveHorizontal(input.horizontal);
        input.horizontalRepeat -= HORIZONTAL_REPEAT;
      }
    }
  }
  if (input.down) {
    input.downRepeat += delta;
    while (input.downRepeat >= SOFT_DROP_REPEAT) {
      stepDown(true);
      input.downRepeat -= SOFT_DROP_REPEAT;
    }
  }
}

document.querySelector('[data-start]').addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
document.querySelectorAll('[data-action]').forEach((button) => {
  const action = button.dataset.action;
  const continuous = action === 'left' || action === 'right' || action === 'down';

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (continuous) {
      button.setPointerCapture?.(event.pointerId);
      setContinuousInput(action, true);
    } else {
      performAction(action);
    }
  });

  if (continuous) {
    const stopContinuousInput = (event) => {
      event.preventDefault();
      setContinuousInput(action, false);
    };
    button.addEventListener('pointerup', stopContinuousInput);
    button.addEventListener('pointercancel', stopContinuousInput);
    button.addEventListener('lostpointercapture', stopContinuousInput);
  }
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
  if (event.key === 'c' || event.key === 'C' || event.key === 'Shift') {
    if (state === 'running') {
      event.preventDefault();
      if (!event.repeat) holdPiece();
    }
    return;
  }
  const action = keyActions[event.key];
  if (action && state === 'running') {
    event.preventDefault();
    if (action === 'left' || action === 'right' || action === 'down') {
      if (!event.repeat) setContinuousInput(action, true);
    } else if (!event.repeat) {
      performAction(action);
    }
  }
});

document.addEventListener('keyup', (event) => {
  const keyActions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down' };
  const action = keyActions[event.key];
  if (action) setContinuousInput(action, false);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'running') togglePause();
});
window.addEventListener('blur', resetInputState);

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

highScoreElement.textContent = highScore.toLocaleString('ko-KR');
draw();
