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

// ---- IPC: window controls ----
ipcMain.on('win:minimize', () => panel && panel.minimize());
ipcMain.on('win:close', () => panel && panel.close());
ipcMain.on('win:toggleTop', (_e, on) => panel && panel.setAlwaysOnTop(on, 'floating'));
ipcMain.on('win:dashboard', () => openDashboard());
ipcMain.on('win:resize', (_e, w, h) => {
  if (!panel) return;
  const [x, y] = panel.getPosition();
  panel.setBounds({ x, y, width: Math.round(w), height: Math.round(h) }, false);
});
