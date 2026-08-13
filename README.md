# TimeGrid

A minimalist, always-on-top desktop overlay for tracking daily time utilisation. Each day is 48 half-hour slots (shown as 24 hour-rows × two half-hour cells); click a cell to mark that time as *utilised* and tag it with what you were learning. Every day is stored and can be revisited, navigated, and analysed — with topic goals, tasks, and an optional AI coach.

## Run

```bash
npm install          # first time only
npm start
```

> **Note:** This machine has `ELECTRON_RUN_AS_NODE=1` set in the shell, which makes Electron run as plain Node and crash on launch. The `start` script clears it (`ELECTRON_RUN_AS_NODE= electron .`). Consider removing that export from your `~/.zshrc` / `~/.zprofile`, as it breaks other Electron apps too.

## The tracker panel

- **24 hour-rows**, each with two half-hour cells (`:00` / `:30`). Click a cell to select it, mark it utilised, and edit its **learning note**.
- **Learning box** — the selected cell's topic loads here; type a topic and confirm with **✓** or cancel with **✗** (buttons appear only when there's a change). Cells are color-coded by topic, with a dot marking a cell that carries a note.
- The **current slot** pulses in teal and auto-scrolls into view; **past unmarked** slots fade.
- **Full day / Collapse** — Collapse folds runs of empty hours into summary rows; works on today *and* any past date you navigate to.
- **‹ ›** — navigate to previous days to review or edit them (can't go past today).
- Footer shows hours done and **% of your daily target** (e.g. `75% of 8h`), plus the **Analytics ↗** link.
- Title bar: **📌** always-on-top toggle · **–** minimize · **×** close · drag the bar to move.

## Analytics dashboard

Reachable via **Analytics ↗** in the tracker; a **▦** button in the Analytics header reopens the tracker if you've closed it.

- **Daily target** box (default 8h) — drives every daily percentage; changes carry forward.
- **KPI tiles** — Today, 7-day avg, Target-hit days, current streak (all vs. your target).
- **Topic goals** — per-topic completion bars toward the **10 / 24 / 50 / 100h** milestones.
- **Goals trend** — cumulative hours per topic over time, with **D / W / M** views, week-end value labels, an adaptive 10→24→50→100 y-axis, and hover to see the nearest topic's value.
- **Tasks** — add tasks with a checkbox; each shows its start date and a **days-open** age (red past 7 days). Checked tasks move to a collapsible *Completed* section.
- **Daily utilisation** — 30-day bar trend with absolute hours labeled.
- **Hour-of-day pattern** and a **5-week consistency heatmap**.
- **Your Coach** *(optional, needs an OpenAI key — see below)* — generates a motivational read of your learning curve and concrete areas to improve, grounded strictly in your tracked data.

All charts are hand-drawn SVG — no external/CDN chart dependencies.

## AI Coach setup (optional)

The Coach sends a compact **digest** of your data (topic hours, weekly totals, streak, tasks — not raw notes) to OpenAI and renders the summary. It's opt-in and only runs when you click **Generate**.

The key is resolved in the **main process** (never in the page, never stored by the app), in this order:

1. `OPENAI_API_KEY` environment variable, or
2. `~/.timegrid/config.json` → `{ "OPENAI_API_KEY": "sk-..." }`

```bash
mkdir -p ~/.timegrid
printf '{ "OPENAI_API_KEY": "sk-..." }' > ~/.timegrid/config.json
```

- This file lives **outside the repo** (your home folder), so it can never be committed.
- Optional model override: add `"OPENAI_MODEL": "gpt-4o"` to the JSON (default is `gpt-4o`).
- macOS note: apps launched from Finder don't inherit your shell's env vars, so the config-file route is the reliable one for the packaged app.

## Packaging (standalone app)

```bash
npm run dist
```

Builds `dist/mac-arm64/TimeGrid.app` and `dist/TimeGrid-<version>-arm64.dmg`. The app is unsigned; on first launch on another Mac use right-click → Open, or clear quarantine with `xattr -dr com.apple.quarantine /Applications/TimeGrid.app`. It registers to launch at login when run as the packaged build.

## Layout

```
src/
  main.js            Electron main: windows, IPC, window controls, Coach (OpenAI)
  store.js           JSON persistence ({ days, settings, tasks })
  preload.js         Safe bridge exposed to the UI as window.tg
  renderer/
    index.html/renderer.js/styles.css   Tracker panel
    dashboard.html/dashboard.js          Analytics dashboard + Coach card
prototype.html            Tracker design mockup (browser)
analytics-prototype.html  Analytics design mockup (browser)
nav-prototype.html        Back-button / target-% mockup (browser)
coach-prototype.html      Coach card mockup (browser)
```

## Storage

Plain JSON at `~/Library/Application Support/timegrid/timegrid-data.json`, shaped as
`{ "days": { "YYYY-MM-DD": { "<slot 0..47>": "topic" } }, "settings": { "target": 8 }, "tasks": [...] }`.
Old flat `{ "YYYY-MM-DD": [...] }` files auto-migrate on load. Chosen over SQLite to stay
dependency-free and avoid native builds against Electron's ABI.
