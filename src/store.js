// Simple JSON-file store in Electron's userData dir.
// Shape: { "YYYY-MM-DD": [slotIndex, ...] }  // indices 0..47 marked "utilised"
const fs = require('fs');
const path = require('path');

let filePath;
let cache = {};

function init(userDataDir) {
  filePath = path.join(userDataDir, 'timegrid-data.json');
  try {
    cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    cache = {};
  }
}

function flush() {
  fs.writeFileSync(filePath, JSON.stringify(cache), 'utf8');
}

function getDay(dateKey) {
  return cache[dateKey] || [];
}

function setDay(dateKey, slots) {
  if (slots && slots.length) cache[dateKey] = slots;
  else delete cache[dateKey];
  flush();
}

// Everything, for the analytics dashboard.
function getAll() {
  return cache;
}

module.exports = { init, getDay, setDay, getAll };
