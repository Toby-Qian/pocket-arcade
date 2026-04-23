# Pocket Arcade

> A zero-install, zero-login browser arcade with five instant-play games: Conway's Game of Life, Neon Snake, Memory Match, 2048, and Minesweeper. Pure HTML + CSS + JavaScript — no build step, no framework.

**Live site →** https://toby-qian.github.io/pocket-arcade/

**语言 / Language:** **English** · [简体中文](README.zh-CN.md)

---

## Games

| # | Game | Vibe | Controls |
|---|------|------|----------|
| 1 | [Game of Life](#1-conways-game-of-life) | slow · observational | click / drag to paint · `Space` · `S` · `C` · `R` |
| 2 | [Neon Snake](#2-neon-snake)            | fast · arcade         | Arrow keys / WASD · swipe on canvas · on-screen D-pad |
| 3 | [Memory Match](#3-memory-match)        | chill · bite-sized    | tap / click |
| 4 | [2048](#4-2048)                        | puzzle · numbers      | Arrow keys / WASD · swipe · `Ctrl+Z` to undo |
| 5 | [Minesweeper](#5-minesweeper)          | logic · classic       | left-click reveal · right-click flag · long-press flag on mobile |

### 1. Conway's Game of Life
Paint cells on a dark toroidal grid, press play, and watch three tiny rules generate surprisingly complex life. Presets include **Glider**, **Gosper's Glider Gun**, **Pulsar**, **LWSS**, and **R-pentomino**. Adjustable speed (1–60 fps) and cell size (4–30 px).

### 2. Neon Snake
The classic, reshaped for mobile. The canvas is swipeable, there is an on-screen D-pad, and keyboard arrows / WASD work on desktop. Best score is saved locally.

### 3. Memory Match
Eight emoji pairs shuffled on a 4×4 board. Tap to flip, find all pairs in as few moves as possible. The HUD shows move count, pairs found, and the clock when you finish.

### 4. 2048
Combine matching tiles until you reach 2048 — or keep going. Includes **one-step undo** (button or `Ctrl+Z`), score tracking, and a local best score.

### 5. Minesweeper
Three difficulties (9×9 / 12×12 / 16×16), first click is always safe and reveals a cleared region. On phones, long-press a cell to plant a flag (a short vibration confirms it).

---

## Why this version is different

- Built as a **user-facing mini game site**, not a single demo
- **Shared controls layer** — keyboard events are scoped to the active tab, so pressing Space on the Snake tab won't toggle Life
- **Mobile-first**: `touch-action` tuned per surface, `env(safe-area-inset-*)` padding, no 300 ms click delay on D-pad buttons
- **Crisp canvas**: every canvas is sized with `devicePixelRatio`, so pixels stay sharp on Retina and mobile
- Games **auto-pause** when the tab is switched or the browser tab is hidden — no CPU burn in the background
- Zero dependencies, ~20 KB total, copy the folder anywhere and double-click `index.html`

## Run locally

```bash
# any static server works
python -m http.server 8000
# then open http://localhost:8000
```

Or just double-click `index.html` in a file browser — no server required.

## Files

```text
proj3-games/
├── index.html          # layout, tabs, all five game panels
├── style.css           # dark theme, responsive, touch-optimized
├── script.js           # each game in its own IIFE-scoped init function
├── README.md           # this file
└── README.zh-CN.md     # Chinese version
```

## License

MIT
