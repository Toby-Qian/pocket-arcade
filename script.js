(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  // ---------- shared helpers ----------
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

  /**
   * Size a canvas crisply. Sets backing store to CSS-size * DPR and scales the
   * 2D context so subsequent draws use CSS pixel units.
   */
  function fitCanvas(canvas, cssWidth, cssHeight) {
    const dpr = DPR();
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  // Which game panel is currently visible. Updated by initTabs.
  let activePanel = "life";
  const panelListeners = new Set();
  const onPanelChange = (fn) => panelListeners.add(fn);

  initTabs();
  initLifeGame();
  initSnakeGame();
  initMemoryGame();
  init2048Game();
  initMinesweeper();
  initTetrisGame();
  initPuzzleGame();
  initMoleGame();

  function initTabs() {
    const tabs = $$(".tab");
    const panels = $$(".game-panel");

    function activate(key) {
      activePanel = key;
      tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.target === key));
      panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === key));
      panelListeners.forEach((fn) => fn(key));
    }

    tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.target)));

    $$("[data-jump]").forEach((link) => {
      link.addEventListener("click", (e) => {
        // still allow anchor scroll but activate the panel too
        activate(link.dataset.jump);
      });
    });
  }

  // ---------- Conway's Game of Life ----------
  function initLifeGame() {
    const canvas = $("#lifeCanvas");
    const toggleBtn = $("#lifeToggle");
    const stepBtn = $("#lifeStep");
    const clearBtn = $("#lifeClear");
    const randomBtn = $("#lifeRandom");
    const speedInput = $("#lifeSpeed");
    const cellSizeInput = $("#lifeCellSize");
    const presetSelect = $("#lifePreset");
    const speedVal = $("#lifeSpeedVal");
    const cellVal = $("#lifeCellVal");
    const genEl = $("#lifeGen");
    const aliveEl = $("#lifeAlive");

    let ctx;
    let cssW = 0;
    let cssH = 0;
    let cellSize = 12;
    let cols = 0;
    let rows = 0;
    let grid = [];
    let next = [];
    let running = false;
    let fps = 10;
    let gen = 0;
    let lastStep = 0;
    let drawing = false;
    let paintValue = 1;
    let lastPaint = null;

    const PRESETS = {
      glider: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
      lwss: [[0, 1], [0, 4], [1, 0], [2, 0], [3, 0], [3, 4], [2, 4]],
      rpentomino: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
      pulsar: (() => {
        const points = [];
        const idx = [2, 3, 4, 8, 9, 10];
        idx.forEach((i) => points.push([0, i], [5, i], [7, i], [12, i], [i, 0], [i, 5], [i, 7], [i, 12]));
        return points;
      })(),
      gliderGun: [
        [0, 24], [1, 22], [1, 24], [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
        [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35],
        [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
        [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
        [6, 10], [6, 16], [6, 24],
        [7, 11], [7, 15],
        [8, 12], [8, 13]
      ]
    };

    const createGrid = () => Array.from({ length: rows }, () => new Uint8Array(cols));

    function resizeLifeCanvas() {
      const cardWidth = canvas.parentElement.clientWidth;
      const width = Math.max(320, Math.min(cardWidth - 2, 820));
      const height = Math.max(320, Math.round(width * (window.innerWidth < 720 ? 0.9 : 0.68)));

      const fit = fitCanvas(canvas, width, height);
      ctx = fit.ctx;
      cssW = width;
      cssH = height;

      const oldGrid = grid;
      cols = Math.max(12, Math.floor(cssW / cellSize));
      rows = Math.max(12, Math.floor(cssH / cellSize));
      grid = createGrid();
      next = createGrid();

      if (oldGrid.length) {
        const copyRows = Math.min(rows, oldGrid.length);
        const copyCols = Math.min(cols, oldGrid[0].length);
        for (let y = 0; y < copyRows; y++) {
          for (let x = 0; x < copyCols; x++) grid[y][x] = oldGrid[y][x];
        }
      }

      drawLife();
    }

    function drawLife() {
      ctx.fillStyle = "#020817";
      ctx.fillRect(0, 0, cssW, cssH);

      if (cellSize >= 8) {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
          const px = x * cellSize + 0.5;
          ctx.moveTo(px, 0);
          ctx.lineTo(px, cssH);
        }
        for (let y = 0; y <= rows; y++) {
          const py = y * cellSize + 0.5;
          ctx.moveTo(0, py);
          ctx.lineTo(cssW, py);
        }
        ctx.stroke();
      }

      let alive = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!grid[y][x]) continue;
          alive++;
          const glow = (x + y) / (cols + rows);
          ctx.fillStyle = `hsl(${190 + glow * 90} 92% 63%)`;
          ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
        }
      }

      aliveEl.textContent = String(alive);
      genEl.textContent = String(gen);
    }

    function stepLife() {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const ny = (y + dy + rows) % rows;
              const nx = (x + dx + cols) % cols;
              n += grid[ny][nx];
            }
          }
          const a = grid[y][x];
          next[y][x] = a ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
        }
      }
      [grid, next] = [next, grid];
      gen++;
    }

    function loopLife(time) {
      if (running && activePanel === "life") {
        const interval = 1000 / fps;
        if (time - lastStep >= interval) {
          stepLife();
          drawLife();
          lastStep = time;
        }
      }
      requestAnimationFrame(loopLife);
    }

    function pointToCell(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / rect.width) * cols);
      const y = Math.floor(((clientY - rect.top) / rect.height) * rows);
      return {
        x: Math.max(0, Math.min(cols - 1, x)),
        y: Math.max(0, Math.min(rows - 1, y))
      };
    }

    // Bresenham — fills gaps when pointer moves fast between frames
    function paintLine(a, b, value) {
      let { x: x0, y: y0 } = a;
      const { x: x1, y: y1 } = b;
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (true) {
        grid[y0][x0] = value;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }

    function onPointerDown(event) {
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      drawing = true;
      const p = pointToCell(event.clientX, event.clientY);
      paintValue = grid[p.y][p.x] ? 0 : 1;
      grid[p.y][p.x] = paintValue;
      lastPaint = p;
      drawLife();
    }

    function onPointerMove(event) {
      if (!drawing) return;
      const p = pointToCell(event.clientX, event.clientY);
      if (lastPaint && (p.x !== lastPaint.x || p.y !== lastPaint.y)) {
        paintLine(lastPaint, p, paintValue);
      } else {
        grid[p.y][p.x] = paintValue;
      }
      lastPaint = p;
      drawLife();
    }

    function placePreset(key) {
      const points = PRESETS[key];
      if (!points) return;
      grid = createGrid();
      gen = 0;

      const bounds = points.reduce((acc, [y, x]) => ({
        maxY: Math.max(acc.maxY, y),
        maxX: Math.max(acc.maxX, x)
      }), { maxY: 0, maxX: 0 });

      const oy = Math.floor((rows - bounds.maxY) / 2);
      const ox = Math.floor((cols - bounds.maxX) / 2);

      points.forEach(([y, x]) => {
        const ny = oy + y;
        const nx = ox + x;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) grid[ny][nx] = 1;
      });

      drawLife();
    }

    toggleBtn.addEventListener("click", () => {
      running = !running;
      toggleBtn.textContent = running ? "暂停" : "开始";
    });
    stepBtn.addEventListener("click", () => { stepLife(); drawLife(); });
    clearBtn.addEventListener("click", () => { grid = createGrid(); gen = 0; drawLife(); });
    randomBtn.addEventListener("click", () => {
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          grid[y][x] = Math.random() < 0.25 ? 1 : 0;
      gen = 0; drawLife();
    });

    speedInput.addEventListener("input", (e) => {
      fps = Number(e.target.value);
      speedVal.textContent = `${fps} fps`;
    });
    cellSizeInput.addEventListener("input", (e) => {
      cellSize = Number(e.target.value);
      cellVal.textContent = `${cellSize} px`;
      resizeLifeCanvas();
    });
    presetSelect.addEventListener("change", (e) => {
      placePreset(e.target.value);
      e.target.value = "";
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    const stopDraw = () => { drawing = false; lastPaint = null; };
    window.addEventListener("pointerup", stopDraw);
    window.addEventListener("pointercancel", stopDraw);

    window.addEventListener("keydown", (event) => {
      if (activePanel !== "life") return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (event.code === "Space") { event.preventDefault(); toggleBtn.click(); }
      else if (event.key.toLowerCase() === "s") stepBtn.click();
      else if (event.key.toLowerCase() === "c") clearBtn.click();
      else if (event.key.toLowerCase() === "r") randomBtn.click();
    });

    // Pause when user switches away from Life tab, so the RAF step halts.
    onPanelChange((key) => {
      if (key !== "life" && running) {
        running = false;
        toggleBtn.textContent = "开始";
      }
    });

    // Debounced resize — layout settles during mobile rotation
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeLifeCanvas, 120);
    });

    resizeLifeCanvas();
    speedVal.textContent = `${fps} fps`;
    cellVal.textContent = `${cellSize} px`;
    requestAnimationFrame(loopLife);
  }

  // ---------- Neon Snake ----------
  function initSnakeGame() {
    const canvas = $("#snakeCanvas");
    const startBtn = $("#snakeStart");
    const pauseBtn = $("#snakePause");
    const resetBtn = $("#snakeReset");
    const speedInput = $("#snakeSpeed");
    const speedVal = $("#snakeSpeedVal");
    const scoreEl = $("#snakeScore");
    const bestEl = $("#snakeBest");
    const statusEl = $("#snakeStatus");
    const touchButtons = $$(".touchpad__btn");

    const storageKey = "mini-arcade-snake-best";
    const gridSize = 16;
    let ctx;
    let cssW = 0;
    let cell = 30;
    let snake = [];
    let food = null;
    let direction = "right";
    let nextDirection = "right";
    let running = false;
    let gameOver = false;
    let speed = 9;
    let score = 0;
    let best = Number(localStorage.getItem(storageKey) || 0);
    let loopId = null;

    function resizeSnakeCanvas() {
      const width = Math.min(canvas.parentElement.clientWidth - 2, 560);
      const size = Math.max(300, width);
      const fit = fitCanvas(canvas, size, size);
      ctx = fit.ctx;
      cssW = size;
      cell = cssW / gridSize;
      drawSnake();
    }

    function resetSnake() {
      snake = [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }];
      direction = "right";
      nextDirection = "right";
      score = 0;
      gameOver = false;
      spawnFood();
      updateSnakeHud("等待开始");
      drawSnake();
    }

    function updateSnakeHud(status) {
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
      statusEl.textContent = status;
      speedVal.textContent = `${speed} tick/s`;
      pauseBtn.textContent = running ? "暂停" : "继续";
    }

    function spawnFood() {
      do {
        food = {
          x: Math.floor(Math.random() * gridSize),
          y: Math.floor(Math.random() * gridSize)
        };
      } while (snake.some((s) => s.x === food.x && s.y === food.y));
    }

    function setDirection(dir) {
      const opp = { up: "down", down: "up", left: "right", right: "left" };
      // Block 180° turns against the *current* committed direction
      if (opp[direction] === dir) return;
      nextDirection = dir;
    }

    function drawRoundedCell(x, y, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      const px = x * cell + 2;
      const py = y * cell + 2;
      const size = cell - 4;
      const r = Math.max(4, size * 0.22);
      ctx.moveTo(px + r, py);
      ctx.arcTo(px + size, py, px + size, py + size, r);
      ctx.arcTo(px + size, py + size, px, py + size, r);
      ctx.arcTo(px, py + size, px, py, r);
      ctx.arcTo(px, py, px + size, py, r);
      ctx.closePath();
      ctx.fill();
    }

    function drawSnake() {
      ctx.fillStyle = "#04101d";
      ctx.fillRect(0, 0, cssW, cssW);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= gridSize; i++) {
        const p = i * cell + 0.5;
        ctx.moveTo(p, 0); ctx.lineTo(p, cssW);
        ctx.moveTo(0, p); ctx.lineTo(cssW, p);
      }
      ctx.stroke();

      snake.forEach((seg, i) => drawRoundedCell(seg.x, seg.y, i === 0 ? "#fcd34d" : "#38bdf8"));
      if (food) drawRoundedCell(food.x, food.y, "#fb7185");

      if (gameOver) {
        ctx.fillStyle = "rgba(2, 8, 23, 0.72)";
        ctx.fillRect(0, 0, cssW, cssW);
        ctx.fillStyle = "#fb7185";
        ctx.font = "700 32px 'Segoe UI', 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Game Over", cssW / 2, cssW / 2 - 10);
        ctx.font = "500 15px 'Segoe UI', 'PingFang SC', sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("点开始再来一局", cssW / 2, cssW / 2 + 22);
      }
    }

    function tickSnake() {
      if (!running) return;
      direction = nextDirection;

      const head = { ...snake[0] };
      if (direction === "up") head.y -= 1;
      if (direction === "down") head.y += 1;
      if (direction === "left") head.x -= 1;
      if (direction === "right") head.x += 1;

      if (
        head.x < 0 || head.x >= gridSize ||
        head.y < 0 || head.y >= gridSize ||
        snake.some((s) => s.x === head.x && s.y === head.y)
      ) {
        running = false;
        gameOver = true;
        if (score > best) {
          best = score;
          localStorage.setItem(storageKey, String(best));
        }
        updateSnakeHud("游戏结束");
        drawSnake();
        return;
      }

      snake.unshift(head);
      if (food && head.x === food.x && head.y === food.y) {
        score += 1;
        spawnFood();
        updateSnakeHud("进行中");
      } else {
        snake.pop();
      }
      drawSnake();
    }

    function startLoop() {
      clearInterval(loopId);
      loopId = setInterval(tickSnake, 1000 / speed);
    }
    function stopLoop() { clearInterval(loopId); loopId = null; }

    startBtn.addEventListener("click", () => {
      if (gameOver) resetSnake();
      running = true;
      updateSnakeHud("进行中");
      startLoop();
    });

    pauseBtn.addEventListener("click", () => {
      if (gameOver) return; // disabled semantically — a reset is needed first
      running = !running;
      updateSnakeHud(running ? "进行中" : "已暂停");
      if (running) startLoop(); else stopLoop();
    });

    resetBtn.addEventListener("click", () => {
      running = false;
      stopLoop();
      resetSnake();
    });

    speedInput.addEventListener("input", (e) => {
      speed = Number(e.target.value);
      updateSnakeHud(running ? "进行中" : (gameOver ? "游戏结束" : "等待开始"));
      if (running) startLoop();
    });

    // Touch pad — use pointerdown + preventDefault to eliminate the 300ms
    // click delay and stop the browser from treating it as a scroll gesture.
    touchButtons.forEach((btn) => {
      const fire = (e) => {
        e.preventDefault();
        setDirection(btn.dataset.dir);
      };
      btn.addEventListener("pointerdown", fire);
      btn.addEventListener("click", (e) => e.preventDefault());
    });

    // Swipe on the canvas itself for fullscreen mobile play.
    let swipeStart = null;
    canvas.addEventListener("pointerdown", (e) => {
      swipeStart = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!swipeStart) return;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 24) { swipeStart = null; return; }
      if (ax > ay) setDirection(dx > 0 ? "right" : "left");
      else setDirection(dy > 0 ? "down" : "up");
      swipeStart = null;
    });

    window.addEventListener("keydown", (event) => {
      if (activePanel !== "snake") return;
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
                    w: "up", s: "down", a: "left", d: "right" };
      const dir = map[event.key] || map[event.key.toLowerCase()];
      if (!dir) return;
      event.preventDefault(); // stop page scroll while playing
      setDirection(dir);
    });

    // Auto-pause when user leaves the Snake tab or hides the page
    onPanelChange((key) => {
      if (key !== "snake" && running) {
        running = false;
        stopLoop();
        updateSnakeHud("已暂停");
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running) {
        running = false;
        stopLoop();
        updateSnakeHud("已暂停");
      }
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeSnakeCanvas, 120);
    });

    updateSnakeHud("等待开始");
    resizeSnakeCanvas();
    resetSnake();
  }

  // ---------- Memory Match ----------
  function initMemoryGame() {
    const board = $("#memoryBoard");
    const restartBtn = $("#memoryRestart");
    const movesEl = $("#memoryMoves");
    const pairsEl = $("#memoryPairs");
    const statusEl = $("#memoryStatus");
    // Emoji pairs — more visual than letters, still text-only
    const symbols = ["🌙", "🌿", "🔥", "⚡", "🌸", "🪐", "🐚", "❄️"];

    let cards = [];
    let flipped = [];
    let lock = false;
    let moves = 0;
    let matchedPairs = 0;
    let startedAt = 0;

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function updateMemoryHud(status) {
      movesEl.textContent = String(moves);
      pairsEl.textContent = `${matchedPairs} / ${symbols.length}`;
      statusEl.textContent = status;
    }

    function buildBoard() {
      cards = shuffle([...symbols, ...symbols]).map((value, index) => ({
        id: index, value, matched: false
      }));
      flipped = [];
      lock = false;
      moves = 0;
      matchedPairs = 0;
      startedAt = 0;
      board.innerHTML = "";

      cards.forEach((card) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "memory-card";
        button.dataset.id = String(card.id);
        button.setAttribute("aria-label", `翻牌 ${card.id + 1}`);
        button.innerHTML = `
          <span class="memory-card__face memory-card__face--front">✦</span>
          <span class="memory-card__face memory-card__face--back">${card.value}</span>
        `;
        board.appendChild(button);
      });

      updateMemoryHud("准备开始");
    }

    function revealCard(button) {
      if (lock) return;
      const id = Number(button.dataset.id);
      const card = cards.find((c) => c.id === id);
      if (!card || card.matched || flipped.includes(card.id)) return;

      if (!startedAt) startedAt = performance.now();

      button.classList.add("is-flipped");
      flipped.push(card.id);

      if (flipped.length < 2) {
        updateMemoryHud("再翻一张看看");
        return;
      }

      moves += 1;
      const [firstId, secondId] = flipped;
      const first = cards.find((c) => c.id === firstId);
      const second = cards.find((c) => c.id === secondId);

      if (first.value === second.value) {
        first.matched = true;
        second.matched = true;
        matchedPairs += 1;
        board.querySelector(`[data-id="${first.id}"]`).classList.add("is-matched");
        board.querySelector(`[data-id="${second.id}"]`).classList.add("is-matched");
        flipped = [];

        if (matchedPairs === symbols.length) {
          const seconds = Math.round((performance.now() - startedAt) / 1000);
          updateMemoryHud(`全部完成 · ${moves} 步 / ${seconds}s`);
        } else {
          updateMemoryHud("配对成功");
        }
        return;
      }

      lock = true;
      updateMemoryHud("未配对，再试一次");
      setTimeout(() => {
        flipped.forEach((cardId) => {
          const el = board.querySelector(`[data-id="${cardId}"]`);
          if (el) el.classList.remove("is-flipped");
        });
        flipped = [];
        lock = false;
        updateMemoryHud("继续挑战");
      }, 700);
    }

    board.addEventListener("click", (event) => {
      const btn = event.target.closest(".memory-card");
      if (!btn) return;
      revealCard(btn);
    });

    restartBtn.addEventListener("click", buildBoard);

    buildBoard();
  }

  // ---------- 2048 ----------
  function init2048Game() {
    const board = $("#g2048Board");
    const bgLayer = board.querySelector(".t2048-bg");
    const tileLayer = board.querySelector(".t2048-tiles");
    const scoreEl = $("#g2048Score");
    const bestEl = $("#g2048Best");
    const statusEl = $("#g2048Status");
    const newBtn = $("#g2048New");
    const undoBtn = $("#g2048Undo");
    const storageKey = "mini-arcade-2048-best";

    const N = 4;
    const SLIDE_MS = 130;

    // Build the static background once.
    bgLayer.innerHTML = "";
    for (let i = 0; i < N * N; i++) {
      const c = document.createElement("div");
      c.className = "t2048-cell";
      bgLayer.appendChild(c);
    }

    /** @typedef {{ id:number, value:number, x:number, y:number, el:HTMLElement, merged:boolean }} Tile */

    let grid = [];            // N×N of Tile | null
    let tilesById = new Map(); // id -> Tile
    let score = 0;
    let best = Number(localStorage.getItem(storageKey) || 0);
    let prev = null;          // snapshot for undo
    let won = false;
    let dead = false;
    let busy = false;         // block input mid-animation
    let nextId = 1;
    let pendingSpawn = null;

    function createTile(value, x, y, isNew) {
      const el = document.createElement("div");
      el.className = "t2048-tile" + (isNew ? " is-new" : "");
      el.dataset.v = String(value);
      el.textContent = String(value);
      el.style.setProperty("--x", x);
      el.style.setProperty("--y", y);
      tileLayer.appendChild(el);
      const tile = { id: nextId++, value, x, y, el, merged: false };
      tilesById.set(tile.id, tile);
      return tile;
    }

    function moveTile(tile, x, y) {
      tile.x = x; tile.y = y;
      tile.el.style.setProperty("--x", x);
      tile.el.style.setProperty("--y", y);
    }

    function setTileValue(tile, value) {
      tile.value = value;
      tile.el.dataset.v = String(value);
      tile.el.textContent = String(value);
      tile.el.classList.remove("is-merged");
      // force reflow so the animation replays reliably
      void tile.el.offsetWidth;
      tile.el.classList.add("is-merged");
    }

    function destroyTile(tile) {
      tilesById.delete(tile.id);
      tile.el.remove();
    }

    function clearBoard() {
      tilesById.forEach((t) => t.el.remove());
      tilesById.clear();
      grid = Array.from({ length: N }, () => new Array(N).fill(null));
    }

    function spawnRandomTile() {
      const empty = [];
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++)
          if (!grid[y][x]) empty.push([y, x]);
      if (!empty.length) return null;
      const [y, x] = empty[Math.floor(Math.random() * empty.length)];
      const v = Math.random() < 0.9 ? 2 : 4;
      const tile = createTile(v, x, y, true);
      grid[y][x] = tile;
      return tile;
    }

    function takeSnapshot() {
      return {
        score,
        tiles: [...tilesById.values()].map((t) => ({ value: t.value, x: t.x, y: t.y }))
      };
    }

    function restoreSnapshot(snap) {
      clearBoard();
      score = snap.score;
      snap.tiles.forEach((t) => {
        const tile = createTile(t.value, t.x, t.y, false);
        grid[t.y][t.x] = tile;
      });
    }

    function newGame() {
      clearBoard();
      score = 0;
      prev = null;
      won = false;
      dead = false;
      busy = false;
      spawnRandomTile();
      spawnRandomTile();
      updateHud("进行中");
    }

    function updateHud(status) {
      if (score > best) {
        best = score;
        localStorage.setItem(storageKey, String(best));
      }
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
      if (status !== undefined) statusEl.textContent = status;
    }

    function anyMovePossible() {
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const t = grid[y][x];
          if (!t) return true;
          if (x + 1 < N) { const r = grid[y][x + 1]; if (!r || r.value === t.value) return true; }
          if (y + 1 < N) { const d = grid[y + 1][x]; if (!d || d.value === t.value) return true; }
        }
      return false;
    }

    function move(dir) {
      if (busy || dead) return;

      const snapshot = takeSnapshot();

      const dx = dir === "right" ? 1 : dir === "left" ? -1 : 0;
      const dy = dir === "down" ? 1 : dir === "up" ? -1 : 0;
      const xs = dx > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3];
      const ys = dy > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3];

      let moved = false;
      let gained = 0;
      const merges = []; // {winner, loser, newValue}

      // clear last-move merge flags
      tilesById.forEach((t) => { t.merged = false; });

      for (const y of ys) {
        for (const x of xs) {
          const tile = grid[y][x];
          if (!tile) continue;

          // slide until we hit an edge or a tile
          let nx = x, ny = y;
          while (true) {
            const px = nx + dx, py = ny + dy;
            if (px < 0 || px >= N || py < 0 || py >= N) break;
            if (grid[py][px]) break;
            nx = px; ny = py;
          }

          // check merge with the first obstacle beyond
          const mx = nx + dx, my = ny + dy;
          let didMerge = false;
          if (mx >= 0 && mx < N && my >= 0 && my < N) {
            const target = grid[my][mx];
            // Standard 2048 rule: a tile can only participate in one merge per move.
            if (target && target.value === tile.value && !target.merged && !tile.merged) {
              grid[y][x] = null;
              // The surviving tile occupies the target cell; the target will be removed.
              grid[my][mx] = tile;
              tile.merged = true;
              moveTile(tile, mx, my);
              const newValue = tile.value * 2;
              gained += newValue;
              merges.push({ winner: tile, loser: target, newValue });
              didMerge = true;
              moved = true;
            }
          }
          if (!didMerge && (nx !== x || ny !== y)) {
            grid[y][x] = null;
            grid[ny][nx] = tile;
            moveTile(tile, nx, ny);
            moved = true;
          }
        }
      }

      if (!moved) return; // nothing happened; don't save snapshot or spawn

      busy = true;
      score += gained;
      prev = snapshot;
      updateHud("进行中");

      // Wait for the slide transition to finish, then handle merges + spawn.
      pendingSpawn = setTimeout(() => {
        merges.forEach(({ winner, loser, newValue }) => {
          destroyTile(loser);
          setTileValue(winner, newValue);
        });

        spawnRandomTile();
        updateHud();

        // Check win / dead states
        if (!won) {
          for (const t of tilesById.values()) {
            if (t.value >= 2048) { won = true; updateHud("🎉 到达 2048"); break; }
          }
        }
        if (!anyMovePossible()) {
          dead = true;
          updateHud("没法继续了");
        }

        busy = false;
      }, SLIDE_MS);
    }

    function undo() {
      if (!prev) return;
      clearTimeout(pendingSpawn);
      restoreSnapshot(prev);
      prev = null;
      won = false;
      dead = false;
      busy = false;
      updateHud("已撤销");
    }

    newBtn.addEventListener("click", newGame);
    undoBtn.addEventListener("click", undo);

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (activePanel !== "2048") return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      const map = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
        W: "up", S: "down", A: "left", D: "right"
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    });

    // Swipe on the board
    let swipe = null;
    board.addEventListener("pointerdown", (e) => {
      swipe = { x: e.clientX, y: e.clientY };
    });
    board.addEventListener("pointerup", (e) => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      swipe = null;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 24) return;
      if (ax > ay) move(dx > 0 ? "right" : "left");
      else move(dy > 0 ? "down" : "up");
    });

    newGame();
  }

  // ---------- Minesweeper ----------
  function initMinesweeper() {
    const board = $("#minesBoard");
    const newBtn = $("#minesNew");
    const diffSelect = $("#minesDiff");
    const flagsEl = $("#minesFlags");
    const timeEl = $("#minesTime");
    const statusEl = $("#minesStatus");

    const DIFFS = {
      easy:   { cols: 9,  rows: 9,  mines: 10 },
      medium: { cols: 12, rows: 12, mines: 20 },
      hard:   { cols: 16, rows: 16, mines: 40 }
    };

    let cfg, cells, revealed, flagged, mineSet, flags, firstClick, dead, won;
    let timerId = null;
    let elapsed = 0;

    function buildMines(firstX, firstY) {
      const total = cfg.cols * cfg.rows;
      const forbidden = new Set();
      // protect first click and its 8 neighbours so starts aren't instadeath
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = firstX + dx, ny = firstY + dy;
          if (nx >= 0 && nx < cfg.cols && ny >= 0 && ny < cfg.rows) {
            forbidden.add(ny * cfg.cols + nx);
          }
        }
      mineSet = new Set();
      while (mineSet.size < cfg.mines) {
        const r = Math.floor(Math.random() * total);
        if (forbidden.has(r)) continue;
        mineSet.add(r);
      }
    }

    function countAround(x, y) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= cfg.cols || ny < 0 || ny >= cfg.rows) continue;
          if (mineSet.has(ny * cfg.cols + nx)) n++;
        }
      return n;
    }

    function startTimer() {
      stopTimer();
      elapsed = 0;
      timeEl.textContent = "0s";
      timerId = setInterval(() => {
        elapsed++;
        timeEl.textContent = `${elapsed}s`;
      }, 1000);
    }
    function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

    function updateHud(status) {
      flagsEl.textContent = `${flags} / ${cfg.mines}`;
      statusEl.textContent = status;
    }

    function buildBoard() {
      stopTimer();
      cfg = DIFFS[diffSelect.value] || DIFFS.medium;
      cells = [];
      revealed = new Uint8Array(cfg.cols * cfg.rows);
      flagged = new Uint8Array(cfg.cols * cfg.rows);
      mineSet = new Set();
      flags = 0;
      firstClick = true;
      dead = false;
      won = false;
      elapsed = 0;
      timeEl.textContent = "0s";

      board.style.setProperty("--cols", cfg.cols);
      board.innerHTML = "";

      for (let y = 0; y < cfg.rows; y++) {
        for (let x = 0; x < cfg.cols; x++) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "mine-cell";
          cell.dataset.x = String(x);
          cell.dataset.y = String(y);
          cell.setAttribute("aria-label", `${x},${y}`);
          board.appendChild(cell);
          cells.push(cell);
        }
      }

      updateHud("等待点击");
    }

    function idx(x, y) { return y * cfg.cols + x; }

    function reveal(x, y) {
      if (dead || won) return;
      const i = idx(x, y);
      if (revealed[i] || flagged[i]) return;

      if (firstClick) {
        buildMines(x, y);
        firstClick = false;
        startTimer();
      }

      if (mineSet.has(i)) {
        revealed[i] = 1;
        dead = true;
        stopTimer();
        showAllMines(i);
        updateHud("💥 踩雷了");
        return;
      }

      // Flood-fill for empty regions
      const queue = [[x, y]];
      while (queue.length) {
        const [cx, cy] = queue.pop();
        const ci = idx(cx, cy);
        if (revealed[ci] || flagged[ci]) continue;
        revealed[ci] = 1;
        const n = countAround(cx, cy);
        paintRevealed(cx, cy, n);
        if (n === 0) {
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || nx >= cfg.cols || ny < 0 || ny >= cfg.rows) continue;
              if (!revealed[idx(nx, ny)]) queue.push([nx, ny]);
            }
        }
      }
      checkWin();
    }

    function paintRevealed(x, y, n) {
      const cell = cells[idx(x, y)];
      cell.classList.add("is-open");
      cell.dataset.n = String(n);
      cell.textContent = n ? String(n) : "";
    }

    function showAllMines(hitIdx) {
      mineSet.forEach((i) => {
        const cell = cells[i];
        cell.classList.add("is-mine");
        cell.textContent = "💣";
        if (i === hitIdx) cell.classList.add("is-hit");
      });
    }

    function toggleFlag(x, y) {
      if (dead || won) return;
      const i = idx(x, y);
      if (revealed[i]) return;
      flagged[i] = flagged[i] ? 0 : 1;
      flags += flagged[i] ? 1 : -1;
      cells[i].classList.toggle("is-flag", !!flagged[i]);
      cells[i].textContent = flagged[i] ? "🚩" : "";
      updateHud("进行中");
      checkWin();
    }

    function checkWin() {
      const total = cfg.cols * cfg.rows;
      let openCount = 0;
      for (let i = 0; i < total; i++) if (revealed[i]) openCount++;
      if (openCount === total - cfg.mines) {
        won = true;
        stopTimer();
        updateHud(`🎉 胜利 · ${elapsed}s`);
      } else {
        updateHud("进行中");
      }
    }

    // Click to reveal, right-click to flag
    board.addEventListener("click", (e) => {
      const cell = e.target.closest(".mine-cell");
      if (!cell) return;
      const x = Number(cell.dataset.x), y = Number(cell.dataset.y);
      reveal(x, y);
    });
    board.addEventListener("contextmenu", (e) => {
      const cell = e.target.closest(".mine-cell");
      if (!cell) return;
      e.preventDefault();
      toggleFlag(Number(cell.dataset.x), Number(cell.dataset.y));
    });

    // Long-press for touch flagging
    let pressTimer = null;
    let pressedCell = null;
    let longPressed = false;
    board.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      const cell = e.target.closest(".mine-cell");
      if (!cell) return;
      pressedCell = cell;
      longPressed = false;
      pressTimer = setTimeout(() => {
        longPressed = true;
        toggleFlag(Number(cell.dataset.x), Number(cell.dataset.y));
        if (navigator.vibrate) navigator.vibrate(20);
      }, 420);
    });
    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
      pressedCell = null;
    };
    board.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch" && longPressed) {
        // Suppress the synthetic click that follows a long-press
        e.preventDefault();
      }
      cancelPress();
    });
    board.addEventListener("pointercancel", cancelPress);
    board.addEventListener("pointerleave", cancelPress);
    // Swallow the click that trails a long-press (prevents also revealing)
    board.addEventListener("click", (e) => {
      if (longPressed) {
        longPressed = false;
        e.stopImmediatePropagation();
      }
    }, true);

    newBtn.addEventListener("click", buildBoard);
    diffSelect.addEventListener("change", buildBoard);

    onPanelChange((key) => {
      if (key !== "mines") stopTimer();
      else if (!firstClick && !dead && !won) startTimer();
    });

    buildBoard();
  }

  // ---------- Tetris ----------
  function initTetrisGame() {
    const canvas = $("#tetrisCanvas");
    const nextCanvas = $("#tetrisNext");
    const startBtn = $("#tetrisStart");
    const pauseBtn = $("#tetrisPause");
    const resetBtn = $("#tetrisReset");
    const scoreEl = $("#tetrisScore");
    const bestEl = $("#tetrisBest");
    const linesEl = $("#tetrisLines");
    const pad = $$(".tetris-pad button");

    const COLS = 10;
    const ROWS = 20;
    const storageKey = "mini-arcade-tetris-best";

    // Tetromino definitions: each rotation is a set of cell offsets from origin.
    const PIECES = {
      I: { color: "#38bdf8", cells: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]] },
      O: { color: "#fcd34d", cells: [[[1,0],[2,0],[1,1],[2,1]]] },
      T: { color: "#a855f7", cells: [[[0,1],[1,1],[2,1],[1,0]], [[1,0],[1,1],[1,2],[2,1]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[1,1],[1,2],[0,1]]] },
      S: { color: "#22c55e", cells: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]] },
      Z: { color: "#fb7185", cells: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]] },
      J: { color: "#6366f1", cells: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]] },
      L: { color: "#f97316", cells: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]] }
    };
    const TYPES = Object.keys(PIECES);

    let ctx, nextCtx;
    let cssW = 0, cssH = 0, cell = 24;
    let board;          // ROWS × COLS of color | null
    let piece;          // {type, rot, x, y}
    let nextPiece;
    let dropMs = 750;
    let lastDrop = 0;
    let running = false;
    let over = false;
    let score = 0;
    let lines = 0;
    let best = Number(localStorage.getItem(storageKey) || 0);
    let rafId = null;
    let lastFrame = 0;

    function resizeTetris() {
      const w = canvas.parentElement.clientWidth;
      const maxH = Math.min(window.innerHeight - 200, 720);
      // Keep a 1:2 aspect so the 10x20 grid fills neatly.
      let width = Math.min(w - 2, 360);
      let height = width * 2;
      if (height > maxH) {
        height = maxH;
        width = height / 2;
      }
      const fit = fitCanvas(canvas, width, height);
      ctx = fit.ctx;
      cssW = width; cssH = height;
      cell = cssW / COLS;
      const nfit = fitCanvas(nextCanvas, 96, 96);
      nextCtx = nfit.ctx;
      draw();
    }

    function emptyBoard() {
      return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    }

    function randomPiece() {
      const t = TYPES[Math.floor(Math.random() * TYPES.length)];
      return { type: t, rot: 0, x: 3, y: 0 };
    }

    function cellsOf(p) {
      return PIECES[p.type].cells[p.rot % PIECES[p.type].cells.length];
    }

    function collides(p, dx, dy, drot) {
      const rot = (p.rot + (drot || 0) + 4) % PIECES[p.type].cells.length;
      const cells = PIECES[p.type].cells[rot];
      for (const [cx, cy] of cells) {
        const nx = p.x + cx + (dx || 0);
        const ny = p.y + cy + (dy || 0);
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
      return false;
    }

    function lockPiece() {
      for (const [cx, cy] of cellsOf(piece)) {
        const nx = piece.x + cx;
        const ny = piece.y + cy;
        if (ny < 0) { over = true; running = false; return; }
        board[ny][nx] = PIECES[piece.type].color;
      }
      clearLines();
      piece = nextPiece;
      nextPiece = randomPiece();
      if (collides(piece, 0, 0, 0)) {
        over = true;
        running = false;
        if (score > best) { best = score; localStorage.setItem(storageKey, String(best)); }
      }
    }

    function clearLines() {
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every((c) => c)) {
          board.splice(y, 1);
          board.unshift(new Array(COLS).fill(null));
          cleared++;
          y++; // recheck this row
        }
      }
      if (cleared) {
        lines += cleared;
        const addMap = [0, 100, 300, 500, 800];
        score += addMap[cleared];
        // Speed up every 10 lines
        const level = Math.floor(lines / 10);
        dropMs = Math.max(80, 750 - level * 60);
        if (score > best) { best = score; localStorage.setItem(storageKey, String(best)); }
      }
      updateHud();
    }

    function updateHud() {
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
      linesEl.textContent = String(lines);
      pauseBtn.textContent = running ? "暂停" : "继续";
    }

    function drawCell(g, x, y, color, c) {
      g.fillStyle = color;
      g.fillRect(x * c + 1, y * c + 1, c - 2, c - 2);
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(x * c + 1, y * c + 1, c - 2, 3);
    }

    function draw() {
      ctx.fillStyle = "#020817";
      ctx.fillRect(0, 0, cssW, cssH);
      // subtle grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= COLS; i++) { const p = i * cell + 0.5; ctx.moveTo(p, 0); ctx.lineTo(p, cssH); }
      for (let i = 0; i <= ROWS; i++) { const p = i * cell + 0.5; ctx.moveTo(0, p); ctx.lineTo(cssW, p); }
      ctx.stroke();

      // board
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
          if (board[y][x]) drawCell(ctx, x, y, board[y][x], cell);

      // ghost piece
      if (piece && !over) {
        let ghostY = piece.y;
        while (!collides(piece, 0, ghostY - piece.y + 1, 0)) ghostY++;
        const color = PIECES[piece.type].color;
        ctx.globalAlpha = 0.22;
        for (const [cx, cy] of cellsOf(piece)) {
          const gy = ghostY + cy;
          if (gy >= 0) drawCell(ctx, piece.x + cx, gy, color, cell);
        }
        ctx.globalAlpha = 1;

        // active piece
        for (const [cx, cy] of cellsOf(piece)) {
          const py = piece.y + cy;
          if (py >= 0) drawCell(ctx, piece.x + cx, py, color, cell);
        }
      }

      if (over) {
        ctx.fillStyle = "rgba(2, 8, 23, 0.75)";
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = "#fb7185";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "700 28px 'Segoe UI', 'PingFang SC', sans-serif";
        ctx.fillText("Game Over", cssW / 2, cssH / 2 - 12);
        ctx.font = "500 14px 'Segoe UI', 'PingFang SC', sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("点开始再来一局", cssW / 2, cssH / 2 + 14);
      }

      drawNext();
    }

    function drawNext() {
      if (!nextCtx || !nextPiece) return;
      nextCtx.fillStyle = "#091625";
      nextCtx.fillRect(0, 0, 96, 96);
      const c = 20;
      const cells = PIECES[nextPiece.type].cells[0];
      // Center roughly
      let minX = 4, maxX = 0, minY = 4, maxY = 0;
      for (const [x, y] of cells) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const ox = (96 - (maxX - minX + 1) * c) / 2 - minX * c;
      const oy = (96 - (maxY - minY + 1) * c) / 2 - minY * c;
      for (const [x, y] of cells) {
        nextCtx.fillStyle = PIECES[nextPiece.type].color;
        nextCtx.fillRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2);
      }
    }

    function tick(t) {
      if (!running) { rafId = requestAnimationFrame(tick); return; }
      if (activePanel !== "tetris") { rafId = requestAnimationFrame(tick); return; }
      if (!lastFrame) lastFrame = t;
      if (t - lastDrop >= dropMs) {
        softDrop();
        lastDrop = t;
      }
      lastFrame = t;
      rafId = requestAnimationFrame(tick);
    }

    function softDrop() {
      if (over) return;
      if (!collides(piece, 0, 1, 0)) { piece.y++; draw(); }
      else { lockPiece(); draw(); }
    }

    function hardDrop() {
      if (over) return;
      let drop = 0;
      while (!collides(piece, 0, drop + 1, 0)) drop++;
      piece.y += drop;
      score += drop * 2;
      lockPiece();
      updateHud();
      draw();
    }

    function move(dx) {
      if (over || !running) return;
      if (!collides(piece, dx, 0, 0)) { piece.x += dx; draw(); }
    }
    function rotate() {
      if (over || !running) return;
      // Basic wall kicks: try 0, -1, +1, -2, +2
      for (const k of [0, -1, 1, -2, 2]) {
        if (!collides(piece, k, 0, 1)) { piece.x += k; piece.rot = (piece.rot + 1) % PIECES[piece.type].cells.length; draw(); return; }
      }
    }

    function newGame() {
      board = emptyBoard();
      piece = randomPiece();
      nextPiece = randomPiece();
      score = 0; lines = 0;
      dropMs = 750;
      over = false;
      running = true;
      lastDrop = performance.now();
      updateHud();
      draw();
    }

    startBtn.addEventListener("click", () => {
      if (over || !piece) newGame();
      else { running = true; updateHud(); }
    });
    pauseBtn.addEventListener("click", () => {
      if (over) return;
      running = !running;
      updateHud();
    });
    resetBtn.addEventListener("click", () => { running = false; newGame(); running = false; updateHud(); });

    window.addEventListener("keydown", (e) => {
      if (activePanel !== "tetris") return;
      const key = e.key;
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "soft", ArrowUp: "rotate",
                    a: "left", d: "right", s: "soft", w: "rotate",
                    A: "left", D: "right", S: "soft", W: "rotate" };
      if (key === " " || e.code === "Space") { e.preventDefault(); hardDrop(); return; }
      const action = map[key];
      if (!action) return;
      e.preventDefault();
      if (action === "left") move(-1);
      else if (action === "right") move(1);
      else if (action === "soft") { softDrop(); lastDrop = performance.now(); }
      else if (action === "rotate") rotate();
    });

    pad.forEach((btn) => {
      const fire = (e) => {
        e.preventDefault();
        const d = btn.dataset.tDir;
        if (d === "left") move(-1);
        else if (d === "right") move(1);
        else if (d === "rotate") rotate();
        else if (d === "soft") { softDrop(); lastDrop = performance.now(); }
        else if (d === "hard") hardDrop();
      };
      btn.addEventListener("pointerdown", fire);
      btn.addEventListener("click", (e) => e.preventDefault());
    });

    onPanelChange((key) => {
      if (key !== "tetris" && running) { running = false; updateHud(); }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running) { running = false; updateHud(); }
    });

    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resizeTetris, 120); });

    resizeTetris();
    // initialize a static preview state
    board = emptyBoard();
    piece = randomPiece();
    nextPiece = randomPiece();
    updateHud();
    draw();
    rafId = requestAnimationFrame(tick);
  }

  // ---------- 15-Puzzle (Sliding tiles) ----------
  function initPuzzleGame() {
    const board = $("#puzzleBoard");
    const shuffleBtn = $("#puzzleShuffle");
    const solveBtn = $("#puzzleSolve");
    const sizeSelect = $("#puzzleSize");
    const movesEl = $("#puzzleMoves");
    const timeEl = $("#puzzleTime");
    const statusEl = $("#puzzleStatus");

    let N = 4;
    let tiles = [];       // length N*N; tiles[i] is value at position i (0 = empty)
    let moves = 0;
    let started = 0;
    let solved = true;
    let timerId = null;

    function startTimer() {
      stopTimer();
      started = performance.now();
      timerId = setInterval(() => {
        const s = Math.round((performance.now() - started) / 1000);
        timeEl.textContent = `${s}s`;
      }, 250);
    }
    function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

    function isSolved() {
      for (let i = 0; i < N * N - 1; i++) if (tiles[i] !== i + 1) return false;
      return tiles[N * N - 1] === 0;
    }

    function render() {
      board.style.setProperty("--n", N);
      board.innerHTML = "";
      for (let i = 0; i < N * N; i++) {
        const v = tiles[i];
        const el = document.createElement("button");
        el.type = "button";
        el.className = "puzzle-tile" + (v === 0 ? " is-empty" : "") + (v && v === i + 1 ? " is-home" : "");
        el.textContent = v ? String(v) : "";
        el.dataset.i = String(i);
        board.appendChild(el);
      }
      movesEl.textContent = String(moves);
      statusEl.textContent = solved ? "已还原" : (moves === 0 ? "准备好了" : "进行中");
    }

    function emptyIndex() { return tiles.indexOf(0); }

    // Try to move the tile at index i if it's adjacent to the empty slot.
    function tryMove(i) {
      if (solved) return;
      const e = emptyIndex();
      const ex = e % N, ey = Math.floor(e / N);
      const ix = i % N, iy = Math.floor(i / N);
      if (Math.abs(ex - ix) + Math.abs(ey - iy) !== 1) return;

      if (!started) startTimer();
      tiles[e] = tiles[i];
      tiles[i] = 0;
      moves++;
      if (isSolved()) {
        solved = true;
        stopTimer();
        const s = Math.round((performance.now() - started) / 1000);
        render();
        statusEl.textContent = `🎉 还原 · ${moves} 步 / ${s}s`;
        return;
      }
      render();
    }

    // Shuffle by performing random valid moves — always solvable.
    function shuffle() {
      tiles = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
      let last = -1;
      for (let k = 0; k < N * N * 40; k++) {
        const e = tiles.indexOf(0);
        const ex = e % N, ey = Math.floor(e / N);
        const options = [];
        if (ex > 0) options.push(e - 1);
        if (ex < N - 1) options.push(e + 1);
        if (ey > 0) options.push(e - N);
        if (ey < N - 1) options.push(e + N);
        const choices = options.filter((o) => o !== last);
        const pick = choices[Math.floor(Math.random() * choices.length)];
        tiles[e] = tiles[pick];
        tiles[pick] = 0;
        last = e;
      }
      moves = 0;
      started = 0;
      solved = false;
      stopTimer();
      timeEl.textContent = "0s";
      render();
      statusEl.textContent = "开始吧";
    }

    function reset() {
      tiles = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
      moves = 0;
      started = 0;
      solved = true;
      stopTimer();
      timeEl.textContent = "0s";
      render();
    }

    board.addEventListener("click", (e) => {
      const t = e.target.closest(".puzzle-tile");
      if (!t) return;
      tryMove(Number(t.dataset.i));
    });

    // Arrow keys slide the tile from the opposite side into the empty slot.
    window.addEventListener("keydown", (e) => {
      if (activePanel !== "puzzle") return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const d = map[e.key]; if (!d) return;
      e.preventDefault();
      const emp = emptyIndex();
      const ex = emp % N, ey = Math.floor(emp / N);
      let src = -1;
      if (d === "up" && ey < N - 1) src = emp + N;
      if (d === "down" && ey > 0) src = emp - N;
      if (d === "left" && ex < N - 1) src = emp + 1;
      if (d === "right" && ex > 0) src = emp - 1;
      if (src >= 0) tryMove(src);
    });

    shuffleBtn.addEventListener("click", shuffle);
    solveBtn.addEventListener("click", reset);
    sizeSelect.addEventListener("change", () => { N = Number(sizeSelect.value); reset(); });

    onPanelChange((key) => { if (key !== "puzzle") stopTimer(); });

    reset();
  }

  // ---------- Whack-a-Mole ----------
  function initMoleGame() {
    const board = $("#moleBoard");
    const startBtn = $("#moleStart");
    const diffSelect = $("#moleDiff");
    const scoreEl = $("#moleScore");
    const bestEl = $("#moleBest");
    const timeEl = $("#moleTime");
    const storageKey = "mini-arcade-mole-best";

    const DIFFS = {
      easy:   { up: 950, gap: 350, duration: 30 },
      medium: { up: 700, gap: 250, duration: 30 },
      hard:   { up: 500, gap: 180, duration: 30 }
    };

    const HOLES = 9;
    let holes = [];       // button elements
    let score = 0;
    let best = Number(localStorage.getItem(storageKey) || 0);
    let running = false;
    let endAt = 0;
    let timerId = null;
    let moleIdx = -1;
    let moleTimer = null;

    board.innerHTML = "";
    for (let i = 0; i < HOLES; i++) {
      const hole = document.createElement("button");
      hole.type = "button";
      hole.className = "mole-hole";
      hole.setAttribute("aria-label", "地鼠洞 " + (i + 1));
      hole.innerHTML = '<span class="mole-head">🐹</span>';
      board.appendChild(hole);
      holes.push(hole);
    }

    function updateHud() {
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
    }

    function popMole() {
      if (!running) return;
      const cfg = DIFFS[diffSelect.value] || DIFFS.medium;
      // Avoid re-using the same hole back-to-back
      let idx;
      do { idx = Math.floor(Math.random() * HOLES); } while (idx === moleIdx && HOLES > 1);
      moleIdx = idx;
      holes[idx].classList.add("is-up");
      moleTimer = setTimeout(() => {
        holes[idx].classList.remove("is-up");
        moleTimer = setTimeout(popMole, cfg.gap);
      }, cfg.up);
    }

    function hit(i) {
      if (!running) return;
      if (holes[i].classList.contains("is-up") && !holes[i].classList.contains("is-hit")) {
        holes[i].classList.add("is-hit");
        setTimeout(() => holes[i].classList.remove("is-hit"), 220);
        score++;
        updateHud();
      }
    }

    function tickTimer() {
      const remain = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
      timeEl.textContent = remain + "s";
      if (remain <= 0) end();
    }

    function start() {
      const cfg = DIFFS[diffSelect.value] || DIFFS.medium;
      clearTimers();
      holes.forEach((h) => h.classList.remove("is-up", "is-hit"));
      score = 0;
      moleIdx = -1;
      running = true;
      endAt = performance.now() + cfg.duration * 1000;
      updateHud();
      timeEl.textContent = cfg.duration + "s";
      timerId = setInterval(tickTimer, 200);
      popMole();
    }

    function end() {
      running = false;
      clearTimers();
      holes.forEach((h) => h.classList.remove("is-up"));
      if (score > best) { best = score; localStorage.setItem(storageKey, String(best)); }
      updateHud();
      timeEl.textContent = "结束";
    }

    function clearTimers() {
      if (timerId) { clearInterval(timerId); timerId = null; }
      if (moleTimer) { clearTimeout(moleTimer); moleTimer = null; }
    }

    holes.forEach((h, i) => {
      h.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(i); });
      h.addEventListener("click", (e) => e.preventDefault());
    });

    startBtn.addEventListener("click", start);

    onPanelChange((key) => { if (key !== "mole" && running) end(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && running) end(); });

    updateHud();
    timeEl.textContent = "30s";
  }
})();
