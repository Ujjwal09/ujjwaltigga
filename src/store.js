// Simple JSON-file store in Electron's userData dir.
// New shape: { days: { "YYYY-MM-DD": { "<slot>": "topic" } }, settings: {...}, tasks: [...] }
// Old shape (auto-migrated): a flat { "YYYY-MM-DD": {...} } object of days.
const fs = require('fs');
const path = require('path');

let filePath;
let cache = { days: {}, settings: { target: 8 }, tasks: [] };

// Back-compat: older days stored as arrays of slot indexes.
function normalizeDay(v) {
  if (Array.isArray(v)) {
    const o = {};
    v.forEach(i => { o[i] = ''; });
    return o;
  }
  return v || {};
}

function init(userDataDir) {
  filePath = path.join(userDataDir, 'timegrid-data.json');
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (raw && raw.days) {
      // new format
      for (const k of Object.keys(raw.days)) cache.days[k] = normalizeDay(raw.days[k]);
      cache.settings = Object.assign({ target: 8 }, raw.settings || {});
      cache.tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    } else if (raw) {
      // old flat format: every key is a date
      for (const k of Object.keys(raw)) cache.days[k] = normalizeDay(raw[k]);
    }
  } catch {
    // keep defaults
  }
}

function flush() {
  fs.writeFileSync(filePath, JSON.stringify(cache), 'utf8');
}

function getDay(dateKey) {
  return cache.days[dateKey] || {};
}

function setDay(dateKey, slots) {
  if (slots && Object.keys(slots).length) cache.days[dateKey] = slots;
  else delete cache.days[dateKey];
  flush();
}

// All days, for the analytics dashboard.
function getAll() {
  return cache.days;
}

function getSettings() {
  return cache.settings;
}
function setSetting(key, value) {
  cache.settings[key] = value;
  flush();
}

function getTasks() {
  return cache.tasks;
}
function setTasks(tasks) {
  cache.tasks = tasks || [];
  flush();
}

module.exports = { init, getDay, setDay, getAll, getSettings, setSetting, getTasks, setTasks };
