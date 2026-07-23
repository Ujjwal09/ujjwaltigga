# TimeGrid

A minimalist, always-on-top desktop overlay for tracking daily time utilisation. Each day is 48 half-hour slots (shown as 24 hour-rows × two half-hour cells); click a cell to mark that time as *utilised*. Every day is stored and can be revisited, navigated, and analysed.

## Run

```bash
npm install          # first time only
npm start
```

> **Note:** This machine has `ELECTRON_RUN_AS_NODE=1` set in the shell, which makes Electron run as plain Node and crash on launch. The `start` script clears it (`ELECTRON_RUN_AS_NODE= electron .`). Consider removing that export from your `~/.zshrc` / `~/.zprofile`, as it breaks other Electron apps too.

## The tracker panel

- **24 hour-rows**, each with two half-hour cells (`:00` / `:30`). Click a cell to toggle utilised.
- The **current slot** pulses in teal and auto-scrolls into view; **past unmarked** slots fade.
- **Full day / Collapse** — Collapse folds past & future hours into summary rows around the current hour.
- **‹ ›** — navigate to previous days to review or edit them (can't go past today).
- Title bar: **📌** always-on-top toggle · **–** minimize · **×** close · drag the bar to move.
- **Analytics ↗** (bottom) opens the dashboard.

## Analytics dashboard

Dependency-free SVG charts:
- KPI tiles — Today, 7-day avg, 30-day avg, current streak
- 30-day daily-utilisation bar trend
- Hour-of-day pattern (when you're most accountable)
- 5-week consistency heatmap

## Layout

```
src/
  main.js            Electron main: floating + analytics windows, IPC, window controls
  store.js           JSON persistence (one record per day)
  preload.js         Safe bridge exposed to the UI as window.tg
  renderer/
    index.html/renderer.js/styles.css   Tracker panel
    dashboard.html/dashboard.js          Analytics dashboard
prototype.html       Original browser mockup of the design
```

## Storage

Plain JSON at `~/Library/Application Support/timegrid/timegrid-data.json`, shaped as
`{ "YYYY-MM-DD": [slotIndex, ...] }` (indices 0–47). Chosen over SQLite to stay dependency-free
and avoid native builds against Electron's ABI. Easy to migrate later if SQL queries are wanted.
