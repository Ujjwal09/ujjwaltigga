# TimeGrid

A minimalist, always-on-top desktop overlay for tracking daily time utilisation. Each day is 48 half-hour slots (shown as 24 hour-rows × two half-hour cells); click a cell to mark that time as *utilised* and tag it with a **category + specific topic**. You can **plan** future days ahead, and revisit/analyse history — with category goals, tasks, and motivation reels/notes.

## Run

```bash
npm install          # first time only
npm start
```

> **Note:** This machine has `ELECTRON_RUN_AS_NODE=1` set in the shell, which makes Electron run as plain Node and crash on launch. The `start` script clears it (`ELECTRON_RUN_AS_NODE= electron .`). Consider removing that export from your `~/.zshrc` / `~/.zprofile`, as it breaks other Electron apps too.

## The tracker panel

- **24 hour-rows**, each with two half-hour cells (`:00` / `:30`). Click a cell to select it and edit its **Category** + **specific topic**.
- **Category + topic box** — pick a category (short autocomplete list) and, optionally, a specific topic. The app **remembers** each topic's category, so you pick it only the first time; typing a known topic auto-fills its category. Cells are **colour-coded by category**; a dot marks a cell that carries a specific topic. Confirm with **✓** / cancel with **✗** (buttons appear only on a change).
- **Track / Plan toggle** — **Track** marks what you actually did (default). **Plan** sets intended topics ahead; navigate to a **future date** (**›**) to plan it (future dates auto-switch to Plan). Planned slots show as a **dashed ghost** in the category colour and **don't count** — they turn into real, counted entries only when you fill them in Track mode, which pre-fills the plan's category/topic.
- The **current slot** pulses in teal and auto-scrolls into view; **past unmarked** slots fade.
- **Full day / Collapse** — Collapse folds runs of empty hours into summary rows (an hour with any plan or actual entry stays visible).
- **‹ ›** — navigate to any past or future day.
- Footer shows hours done, **% of your daily target** (e.g. `75% of 8h`), a **planned** count, and the **Analytics ↗** link.
- Title bar: **📌** always-on-top toggle · **–** minimize · **×** close · drag the bar to move.

## Analytics dashboard

Reachable via **Analytics ↗** in the tracker; a **▦** button in the Analytics header reopens the tracker if you've closed it.

- **Daily target** box (default 8h) — drives every daily percentage; changes carry forward.
- **KPI tiles** — Today, 7-day avg, Target-hit days, current streak (all vs. your target).
- **Category goals** — per-category completion bars toward the **10 / 24 / 50 / 100h** milestones (specific topics roll up to their category).
- **Goals trend** — cumulative hours per category over time, with **D / W / M** views, week-end value labels, an adaptive 10→24→50→100 y-axis, and hover to see the nearest category's value.
- **Tasks** — add tasks with a checkbox; each shows its start date and a **days-open** age (red past 7 days). Checked tasks move to a collapsible *Completed* section.
- **Daily utilisation** — 30-day bar trend with absolute hours labeled.
- **5-week consistency heatmap**.
- **Motivation** — save **Instagram reels** (paste a public reel URL; it embeds Instagram's player — needs internet, public reels only) and keep an editable list of **notes**. Both persist locally.

All charts are hand-drawn SVG — no external/CDN chart dependencies. (The reels feature is the one exception: it embeds Instagram's own player from the web.)

## Packaging (standalone app)

```bash
npm run dist
```

Builds `dist/mac-arm64/TimeGrid.app` and `dist/TimeGrid-<version>-arm64.dmg`. The app is unsigned; on first launch on another Mac use right-click → Open, or clear quarantine with `xattr -dr com.apple.quarantine /Applications/TimeGrid.app`. It registers to launch at login when run as the packaged build.

## Layout

```
src/
  main.js            Electron main: windows, IPC, window controls
  store.js           JSON persistence ({ days, plans, catMap, settings, tasks, motivation })
  preload.js         Safe bridge exposed to the UI as window.tg
  renderer/
    index.html/renderer.js/styles.css   Tracker panel (track + plan, categories)
    dashboard.html/dashboard.js          Analytics dashboard
prototype.html            Tracker design mockup (browser)
planner-prototype.html    Planner + categories mockup (browser)
analytics-prototype.html  Analytics design mockup (browser)
nav-prototype.html        Back-button / target-% mockup (browser)
motivation-prototype.html Reels + notes mockup (browser)
```

## Storage

Plain JSON at `~/Library/Application Support/timegrid/timegrid-data.json`, shaped as
`{ "days": { "YYYY-MM-DD": { "<slot 0..47>": "topic" } }, "plans": { "YYYY-MM-DD": { "<slot>": "topic" } }, "catMap": { "<topic>": "<category>" }, "settings": { "target": 8 }, "tasks": [...], "motivation": { "reels": [...], "notes": [...] } }`.
`days` holds actual (utilised) slots; `plans` holds intended slots; `catMap` rolls specific topics up to categories.
Old flat `{ "YYYY-MM-DD": [...] }` files auto-migrate on load. Chosen over SQLite to stay
dependency-free and avoid native builds against Electron's ABI.
