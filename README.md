# Conway's Game of Life

> Zero-player cellular automaton in the browser. Draw some cells, hit play, watch them live and die by three simple rules. Includes Gosper's glider gun, pulsars, and the usual cast.

**Live demo →** https://toby-qian.github.io/game-of-life/

[中文说明 / Chinese README](README.zh-CN.md)

```
· · · · · · · · · · · ·
· · ■ · · · · · · · · ·
· · · ■ · · · · · · · ·
· ■ ■ ■ · · · · · · · ·
· · · · · · · · · · · ·
         glider →
```

## Features

- **Dark theme**, grid-aligned canvas with gradient-tinted cells
- **Toroidal world** — cells wrap around the edges
- **Controls**: play / pause, single-step, clear, random fill
- **Speed slider** (1–60 fps) and **cell-size slider** (4–30 px)
- **Preset patterns**: Glider · Gosper's Glider Gun · Pulsar · LWSS · R-pentomino
- **Click & drag** to paint cells (toggles on first click)
- **Keyboard**: `Space` play/pause · `S` step · `C` clear · `R` randomize
- **Live stats** — generation count and alive population
- Pure Canvas 2D + vanilla JS. No dependencies, no build step.

## Rules (B3/S23)

A cell's fate each tick depends on its 8 neighbours:

- **Alive** cell with 2 or 3 neighbours → stays alive
- **Dead** cell with exactly 3 neighbours → becomes alive
- Everything else → dead

## Run locally

Just open `index.html` in a browser. Or:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## File layout

```
proj3-games/
├── index.html    # markup and controls
├── style.css     # dark GitHub-ish theme
└── script.js     # simulation + rendering
```

## License

MIT
