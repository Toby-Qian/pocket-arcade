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
})();
