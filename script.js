(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  initTabs();
  initLifeGame();
  initSnakeGame();
  initMemoryGame();

  function initTabs() {
    const tabs = $$(".tab");
    const panels = $$(".game-panel");

    function activate(key) {
      tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.target === key));
      panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === key));
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activate(tab.dataset.target));
    });

    $$("[data-jump]").forEach((link) => {
      link.addEventListener("click", () => activate(link.dataset.jump));
    });
  }

  function initLifeGame() {
    const canvas = $("#lifeCanvas");
    const ctx = canvas.getContext("2d");
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

    const PRESETS = {
      glider: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
      lwss: [[0, 1], [0, 4], [1, 0], [2, 0], [3, 0], [3, 4], [2, 4]],
      rpentomino: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
      pulsar: (() => {
        const points = [];
        const indexes = [2, 3, 4, 8, 9, 10];
        indexes.forEach((i) => points.push([0, i], [5, i], [7, i], [12, i], [i, 0], [i, 5], [i, 7], [i, 12]));
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

    function createGrid() {
      return Array.from({ length: rows }, () => new Uint8Array(cols));
    }

    function resizeLifeCanvas() {
      const cardWidth = canvas.parentElement.clientWidth;
      const width = Math.max(320, Math.min(cardWidth - 2, 820));
      const height = Math.max(320, Math.round(width * (window.innerWidth < 720 ? 0.9 : 0.68)));
      canvas.width = width;
      canvas.height = height;

      const oldGrid = grid;
      cols = Math.max(12, Math.floor(canvas.width / cellSize));
      rows = Math.max(12, Math.floor(canvas.height / cellSize));
      grid = createGrid();
      next = createGrid();

      if (oldGrid.length) {
        const copyRows = Math.min(rows, oldGrid.length);
        const copyCols = Math.min(cols, oldGrid[0].length);
        for (let y = 0; y < copyRows; y++) {
          for (let x = 0; x < copyCols; x++) {
            grid[y][x] = oldGrid[y][x];
          }
        }
      }

      drawLife();
    }

    function drawLife() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#020817";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (cellSize >= 8) {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
          ctx.moveTo(x * cellSize + 0.5, 0);
          ctx.lineTo(x * cellSize + 0.5, canvas.height);
        }
        for (let y = 0; y <= rows; y++) {
          ctx.moveTo(0, y * cellSize + 0.5);
          ctx.lineTo(canvas.width, y * cellSize + 0.5, canvas.height);
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
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const ny = (y + dy + rows) % rows;
              const nx = (x + dx + cols) % cols;
              neighbors += grid[ny][nx];
            }
          }
          const alive = grid[y][x];
          next[y][x] = alive ? (neighbors === 2 || neighbors === 3 ? 1 : 0) : (neighbors === 3 ? 1 : 0);
        }
      }
      [grid, next] = [next, grid];
      gen++;
    }

    function loopLife(time) {
      if (running) {
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

    function onPointerDown(event) {
      drawing = true;
      const point = pointToCell(event.clientX, event.clientY);
      paintValue = grid[point.y][point.x] ? 0 : 1;
      grid[point.y][point.x] = paintValue;
      drawLife();
    }

    function onPointerMove(event) {
      if (!drawing) return;
      const point = pointToCell(event.clientX, event.clientY);
      grid[point.y][point.x] = paintValue;
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

      const offsetY = Math.floor((rows - bounds.maxY) / 2);
      const offsetX = Math.floor((cols - bounds.maxX) / 2);

      points.forEach(([y, x]) => {
        const ny = offsetY + y;
        const nx = offsetX + x;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          grid[ny][nx] = 1;
        }
      });

      drawLife();
    }

    toggleBtn.addEventListener("click", () => {
      running = !running;
      toggleBtn.textContent = running ? "暂停" : "开始";
    });

    stepBtn.addEventListener("click", () => {
      stepLife();
      drawLife();
    });

    clearBtn.addEventListener("click", () => {
      grid = createGrid();
      gen = 0;
      drawLife();
    });

    randomBtn.addEventListener("click", () => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          grid[y][x] = Math.random() < 0.25 ? 1 : 0;
        }
      }
      gen = 0;
      drawLife();
    });

    speedInput.addEventListener("input", (event) => {
      fps = Number(event.target.value);
      speedVal.textContent = `${fps} fps`;
    });

    cellSizeInput.addEventListener("input", (event) => {
      cellSize = Number(event.target.value);
      cellVal.textContent = `${cellSize} px`;
      resizeLifeCanvas();
    });

    presetSelect.addEventListener("change", (event) => {
      placePreset(event.target.value);
      event.target.value = "";
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", () => { drawing = false; });

    window.addEventListener("keydown", (event) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (event.code === "Space") {
        event.preventDefault();
        toggleBtn.click();
      }
      if (event.key.toLowerCase() === "s") {
        stepBtn.click();
      }
      if (event.key.toLowerCase() === "c") {
        clearBtn.click();
      }
      if (event.key.toLowerCase() === "r") {
        randomBtn.click();
      }
    });

    window.addEventListener("resize", resizeLifeCanvas);

    resizeLifeCanvas();
    speedVal.textContent = `${fps} fps`;
    cellVal.textContent = `${cellSize} px`;
    requestAnimationFrame(loopLife);
  }

  function initSnakeGame() {
    const canvas = $("#snakeCanvas");
    const ctx = canvas.getContext("2d");
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
      canvas.width = Math.max(320, width);
      canvas.height = canvas.width;
      cell = canvas.width / gridSize;
      drawSnake();
    }

    function resetSnake() {
      snake = [
        { x: 5, y: 8 },
        { x: 4, y: 8 },
        { x: 3, y: 8 }
      ];
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
    }

    function spawnFood() {
      do {
        food = {
          x: Math.floor(Math.random() * gridSize),
          y: Math.floor(Math.random() * gridSize)
        };
      } while (snake.some((segment) => segment.x === food.x && segment.y === food.y));
    }

    function setDirection(dir) {
      const opposites = {
        up: "down",
        down: "up",
        left: "right",
        right: "left"
      };
      if (opposites[direction] === dir) return;
      nextDirection = dir;
    }

    function drawRoundedCell(x, y, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      const px = x * cell + 2;
      const py = y * cell + 2;
      const size = cell - 4;
      const radius = Math.max(4, size * 0.22);
      ctx.moveTo(px + radius, py);
      ctx.arcTo(px + size, py, px + size, py + size, radius);
      ctx.arcTo(px + size, py + size, px, py + size, radius);
      ctx.arcTo(px, py + size, px, py, radius);
      ctx.arcTo(px, py, px + size, py, radius);
      ctx.closePath();
      ctx.fill();
    }

    function drawSnake() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#04101d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= gridSize; i++) {
        const p = i * cell + 0.5;
        ctx.moveTo(p, 0);
        ctx.lineTo(p, canvas.height);
        ctx.moveTo(0, p);
        ctx.lineTo(canvas.width, p);
      }
      ctx.stroke();

      snake.forEach((segment, index) => {
        drawRoundedCell(segment.x, segment.y, index === 0 ? "#fcd34d" : "#38bdf8");
      });

      if (food) {
        drawRoundedCell(food.x, food.y, "#fb7185");
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
        snake.some((segment) => segment.x === head.x && segment.y === head.y)
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

    startBtn.addEventListener("click", () => {
      if (gameOver) resetSnake();
      running = true;
      updateSnakeHud("进行中");
      startLoop();
    });

    pauseBtn.addEventListener("click", () => {
      running = !running;
      updateSnakeHud(running ? "进行中" : "已暂停");
      if (running) startLoop();
    });

    resetBtn.addEventListener("click", () => {
      running = false;
      resetSnake();
    });

    speedInput.addEventListener("input", (event) => {
      speed = Number(event.target.value);
      updateSnakeHud(running ? "进行中" : "等待开始");
      if (running) startLoop();
    });

    touchButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setDirection(button.dataset.dir);
      });
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "ArrowUp") setDirection("up");
      if (key === "ArrowDown") setDirection("down");
      if (key === "ArrowLeft") setDirection("left");
      if (key === "ArrowRight") setDirection("right");
    });

    window.addEventListener("resize", resizeSnakeCanvas);

    updateSnakeHud("等待开始");
    resizeSnakeCanvas();
    resetSnake();
  }

  function initMemoryGame() {
    const board = $("#memoryBoard");
    const restartBtn = $("#memoryRestart");
    const movesEl = $("#memoryMoves");
    const pairsEl = $("#memoryPairs");
    const statusEl = $("#memoryStatus");
    const symbols = ["A", "B", "C", "D", "E", "F", "G", "H"];

    let cards = [];
    let flipped = [];
    let lock = false;
    let moves = 0;
    let matchedPairs = 0;

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
        id: index,
        value,
        matched: false
      }));

      flipped = [];
      lock = false;
      moves = 0;
      matchedPairs = 0;
      board.innerHTML = "";

      cards.forEach((card) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "memory-card";
        button.dataset.id = String(card.id);
        button.setAttribute("aria-label", "memory card");
        button.innerHTML = `
          <span class="memory-card__face memory-card__face--front">LAB</span>
          <span class="memory-card__face memory-card__face--back">${card.value}</span>
        `;
        board.appendChild(button);
      });

      updateMemoryHud("准备开始");
    }

    function revealCard(button) {
      if (lock) return;
      const id = Number(button.dataset.id);
      const card = cards.find((item) => item.id === id);
      if (!card || card.matched || flipped.includes(card.id)) return;

      button.classList.add("is-flipped");
      flipped.push(card.id);

      if (flipped.length < 2) {
        updateMemoryHud("继续寻找另一张");
        return;
      }

      moves += 1;
      const [firstId, secondId] = flipped;
      const first = cards.find((item) => item.id === firstId);
      const second = cards.find((item) => item.id === secondId);

      if (first.value === second.value) {
        first.matched = true;
        second.matched = true;
        matchedPairs += 1;
        board.querySelector(`[data-id="${first.id}"]`).classList.add("is-matched");
        board.querySelector(`[data-id="${second.id}"]`).classList.add("is-matched");
        flipped = [];

        if (matchedPairs === symbols.length) {
          updateMemoryHud("全部完成");
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
      const button = event.target.closest(".memory-card");
      if (!button) return;
      revealCard(button);
    });

    restartBtn.addEventListener("click", buildBoard);

    buildBoard();
  }
})();
