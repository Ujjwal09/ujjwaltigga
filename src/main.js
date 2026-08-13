const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const store = require('./store');

let panel;      // floating tracker
let dashboard;  // analytics window

function createPanel() {
  panel = new BrowserWindow({
    width: 320,
    height: 620,
    minWidth: 260,
    minHeight: 120,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  panel.setAlwaysOnTop(true, 'floating');
  panel.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  panel.on('closed', () => { panel = null; });
}

// Reopen the tracker if it was closed, otherwise just focus it.
function showPanel() {
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); }
  else createPanel();
}

function openDashboard() {
  if (dashboard) { dashboard.focus(); return; }
  dashboard = new BrowserWindow({
    width: 860,
    height: 640,
    title: 'TimeGrid — Analytics',
    backgroundColor: '#14151a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  dashboard.loadFile(path.join(__dirname, 'renderer', 'dashboard.html'));
  dashboard.on('closed', () => { dashboard = null; });
}

app.whenReady().then(() => {
  // Auto-start at login (only meaningful for the packaged app).
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  store.init(app.getPath('userData'));
  createPanel();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPanel();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: data ----
ipcMain.handle('day:get', (_e, dateKey) => store.getDay(dateKey));
ipcMain.handle('day:set', (_e, dateKey, slots) => { store.setDay(dateKey, slots); return true; });
ipcMain.handle('data:all', () => store.getAll());
ipcMain.handle('settings:get', () => store.getSettings());
ipcMain.handle('settings:set', (_e, key, value) => { store.setSetting(key, value); return true; });
ipcMain.handle('tasks:get', () => store.getTasks());
ipcMain.handle('tasks:set', (_e, tasks) => { store.setTasks(tasks); return true; });
ipcMain.handle('coach:generate', () => generateCoach());

// ---- Coach: summarise real tracked data with Claude ----
const pad2 = n => String(n).padStart(2, '0');
const keyOfDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function dayAgoDate(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

// Build a compact digest of the user's real data (no raw notes leave the machine beyond topic names).
function buildDigest() {
  const all = store.getAll();
  const settings = store.getSettings();
  const tasks = store.getTasks();
  const target = settings && settings.target ? settings.target : 8;
  const slotsOf = k => Object.keys(all[k] || {});
  const hoursOf = k => slotsOf(k).length * 0.5;

  const activeDays = Object.keys(all).filter(k => slotsOf(k).length).sort();

  // hours per named topic
  const topicHours = {};
  Object.values(all).forEach(day => Object.values(day).forEach(t => {
    if (t) topicHours[t] = (topicHours[t] || 0) + 0.5;
  }));
  const TIERS = [10, 24, 50, 100];
  const topics = Object.entries(topicHours).sort((a, b) => b[1] - a[1])
    .map(([name, h]) => ({ name, hours: h, nextGoal: TIERS.find(t => h < t) || 'reached 100h' }));

  // last 7 days
  const last7 = [];
  for (let i = 6; i >= 0; i--) { const d = dayAgoDate(i); last7.push({ date: keyOfDate(d), hours: hoursOf(keyOfDate(d)) }); }
  const last7Hours = last7.reduce((s, x) => s + x.hours, 0);
  const targetHitDays = last7.filter(x => x.hours >= target).length;

  // streak (consecutive days up to today with any hours)
  let streak = 0;
  for (let i = 0; i < 365; i++) { if (hoursOf(keyOfDate(dayAgoDate(i))) > 0) streak++; else break; }

  // hour-of-day pattern: completion count per hour across all data
  const hourHits = Array(24).fill(0);
  activeDays.forEach(k => slotsOf(k).forEach(i => { hourHits[Math.floor(Number(i) / 2)]++; }));
  const ranked = hourHits.map((c, h) => ({ h, c })).filter(x => x.c > 0).sort((a, b) => b.c - a.c);
  const bestHours = ranked.slice(0, 3).map(x => `${pad2(x.h)}:00`);

  const now = Date.now();
  const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / 86400000));
  const openTasks = tasks.filter(t => !t.done).map(t => ({ name: t.name, daysOpen: daysBetween(t.start, now) }));
  const completedTasks = tasks.filter(t => t.done).length;

  return {
    dailyTargetHours: target,
    totalDaysTracked: activeDays.length,
    totalHours: Object.values(topicHours).reduce((s, h) => s + h, 0),
    topicsWithGoals: topics,
    last7Days: last7,
    last7TotalHours: last7Hours,
    targetHitDaysOutOf7: targetHitDays,
    currentStreakDays: streak,
    mostProductiveHoursOfDay: bestHours,
    openTasks,
    completedTaskCount: completedTasks,
  };
}

// Resolve the OpenAI key: environment variable wins; otherwise fall back to
// ~/.timegrid/config.json  ->  { "OPENAI_API_KEY": "sk-..." }
function resolveOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const cfgPath = path.join(require('os').homedir(), '.timegrid', 'config.json');
    const cfg = JSON.parse(require('fs').readFileSync(cfgPath, 'utf8'));
    return cfg.OPENAI_API_KEY || null;
  } catch {
    return null;
  }
}

async function generateCoach() {
  const apiKey = resolveOpenAIKey();
  if (!apiKey) return { ok: false, code: 'no_key' };

  const digest = buildDigest();
  if (!digest.totalDaysTracked) return { ok: false, code: 'no_data' };

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string' },
      stats: { type: 'string' },
      learning: { type: 'string' },
      improve: { type: 'string' },
      actions: { type: 'array', items: { type: 'string' } },
      bottom: { type: 'string' },
    },
    required: ['headline', 'stats', 'learning', 'improve', 'actions', 'bottom'],
  };

  const system = [
    'You are a warm but honest personal study coach inside a time-tracking app.',
    'You are given a JSON digest of the user\'s REAL tracked study data. Base every statement strictly on that data — never invent numbers, topics, or events not present in it.',
    'Goal: motivate the user, analyse their learning curve, and name concrete areas to improve.',
    'Tone: encouraging and specific; honest about stalls without being harsh. On a low or empty week, reframe supportively and suggest starting small rather than scolding.',
    'Fields: "headline" a short motivating title (may include one emoji); "stats" a one-line recap of the week using the digest numbers; "learning" 1-2 sentences on what is going well / the learning curve; "improve" 1-2 sentences on where it is flattening or a topic being neglected; "actions" 1-3 short, concrete next steps grounded in the data (mention specific topics/tasks/hours); "bottom" one motivating closing line tying back to a goal (may include one emoji).',
    'Keep it concise. Refer to hours and the 10/24/50/100h topic goals where relevant.',
  ].join(' ');

  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Here is my tracked data:\n\n' + JSON.stringify(digest, null, 2) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'coach_summary', schema, strict: true },
      },
    });
    const data = JSON.parse(resp.choices[0].message.content);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, code: 'error', message: String(err && err.message ? err.message : err) };
  }
}

// ---- IPC: window controls ----
ipcMain.on('win:minimize', () => panel && panel.minimize());
ipcMain.on('win:close', () => panel && panel.close());
ipcMain.on('win:toggleTop', (_e, on) => panel && panel.setAlwaysOnTop(on, 'floating'));
ipcMain.on('win:dashboard', () => openDashboard());
ipcMain.on('win:tracker', () => showPanel());
ipcMain.on('win:resize', (_e, w, h) => {
  if (!panel) return;
  const [x, y] = panel.getPosition();
  panel.setBounds({ x, y, width: Math.round(w), height: Math.round(h) }, false);
});
