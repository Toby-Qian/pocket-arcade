const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let cellSize = 12;
let cols, rows;
let grid, next;
let running = false;
let fps = 10;
let lastStep = 0;
let gen = 0;

const genEl = document.getElementById('gen');
const aliveEl = document.getElementById('alive');
const toggleBtn = document.getElementById('toggle');

function resize() {
  const maxW = Math.min(window.innerWidth - 40, 1100);
  const maxH = window.innerHeight - 260;
  cols = Math.floor(maxW / cellSize);
  rows = Math.max(20, Math.floor(maxH / cellSize));
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const old = grid;
  grid = createGrid();
  next = createGrid();
  if (old) {
    for (let y = 0; y < Math.min(rows, old.length); y++)
      for (let x = 0; x < Math.min(cols, old[0].length); x++)
        grid[y][x] = old[y][x];
  }
  draw();
}

function createGrid() {
  return Array.from({ length: rows }, () => new Uint8Array(cols));
}

function draw() {
  ctx.fillStyle = '#010409';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // grid lines
  if (cellSize >= 8) {
    ctx.strokeStyle = '#161b22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) {
      ctx.moveTo(x * cellSize + .5, 0);
      ctx.lineTo(x * cellSize + .5, canvas.height);
    }
    for (let y = 0; y <= rows; y++) {
      ctx.moveTo(0, y * cellSize + .5);
      ctx.lineTo(canvas.width, y * cellSize + .5);
    }
    ctx.stroke();
  }

  // cells
  let count = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x]) {
        count++;
        const t = (x + y) / (cols + rows);
        ctx.fillStyle = `hsl(${200 + t * 80}, 80%, 60%)`;
        ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      }
    }
  }
  aliveEl.textContent = count;
  genEl.textContent = gen;
}

function step() {
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
      const alive = grid[y][x];
      next[y][x] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
    }
  }
  [grid, next] = [next, grid];
  gen++;
}

function loop(t) {
  if (running) {
    const interval = 1000 / fps;
    if (t - lastStep >= interval) {
      step();
      draw();
      lastStep = t;
    }
  }
  requestAnimationFrame(loop);
}

// interactions
let drawing = false;
let paintValue = 1;
canvas.addEventListener('mousedown', e => {
  drawing = true;
  const { x, y } = getCell(e);
  paintValue = grid[y][x] ? 0 : 1;
  grid[y][x] = paintValue;
  draw();
});
canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const { x, y } = getCell(e);
  grid[y][x] = paintValue;
  draw();
});
window.addEventListener('mouseup', () => drawing = false);

function getCell(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cellSize);
  const y = Math.floor((e.clientY - rect.top) / cellSize);
  return { x: Math.max(0, Math.min(cols - 1, x)), y: Math.max(0, Math.min(rows - 1, y)) };
}

toggleBtn.onclick = () => {
  running = !running;
  toggleBtn.textContent = running ? '⏸ 暂停' : '▶ 开始';
};
document.getElementById('step').onclick = () => { step(); draw(); };
document.getElementById('clear').onclick = () => {
  grid = createGrid(); gen = 0; draw();
};
document.getElementById('random').onclick = () => {
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      grid[y][x] = Math.random() < 0.25 ? 1 : 0;
  gen = 0; draw();
};
document.getElementById('speed').oninput = e => {
  fps = +e.target.value;
  document.getElementById('speedVal').textContent = fps;
};
document.getElementById('cellSize').oninput = e => {
  cellSize = +e.target.value;
  document.getElementById('cellVal').textContent = cellSize;
  resize();
};

window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); toggleBtn.click(); }
  if (e.key === 's') { step(); draw(); }
  if (e.key === 'c') document.getElementById('clear').click();
  if (e.key === 'r') document.getElementById('random').click();
});

// presets
const PRESETS = {
  glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  lwss: [[0,1],[0,4],[1,0],[2,0],[3,0],[3,4],[2,4]],
  rpentomino: [[0,1],[0,2],[1,0],[1,1],[2,1]],
  pulsar: (() => {
    const p = [];
    const pts = [2,3,4,8,9,10];
    for (const i of pts) { p.push([0,i],[5,i],[7,i],[12,i],[i,0],[i,5],[i,7],[i,12]); }
    return p;
  })(),
  gliderGun: [
    [0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
    [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
    [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
    [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
    [6,10],[6,16],[6,24],
    [7,11],[7,15],
    [8,12],[8,13]
  ]
};

document.getElementById('preset').onchange = e => {
  const key = e.target.value;
  if (!key) return;
  const pts = PRESETS[key];
  grid = createGrid();
  gen = 0;
  const bounds = pts.reduce((a,[y,x]) => ({
    maxY: Math.max(a.maxY,y), maxX: Math.max(a.maxX,x)
  }), {maxY:0, maxX:0});
  const oy = Math.floor((rows - bounds.maxY) / 2);
  const ox = Math.floor((cols - bounds.maxX) / 2);
  for (const [y,x] of pts) {
    const ny = oy + y, nx = ox + x;
    if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) grid[ny][nx] = 1;
  }
  draw();
  e.target.value = '';
};

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);
