// Simple JSON-file store in Electron's userData dir.
// Shape: { "YYYY-MM-DD": { "<slotIndex 0..47>": "topic" } }
// A present slot key = "utilised"; its value is the topic ("" = no topic).
const fs = require('fs');
const path = require('path');

let filePath;
let cache = {};

// Back-compat: older data stored days as arrays of slot indexes.
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
    for (const k of Object.keys(raw)) cache[k] = normalizeDay(raw[k]);
  } catch {
    cache = {};
  }
}

function flush() {
  fs.writeFileSync(filePath, JSON.stringify(cache), 'utf8');
}

function getDay(dateKey) {
  return cache[dateKey] || {};
}

function setDay(dateKey, slots) {
  if (slots && Object.keys(slots).length) cache[dateKey] = slots;
  else delete cache[dateKey];
  flush();
}

// Everything, for the analytics dashboard.
function getAll() {
  return cache;
}

module.exports = { init, getDay, setDay, getAll };
