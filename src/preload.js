const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tg', {
  // data
  getDay: (dateKey) => ipcRenderer.invoke('day:get', dateKey),
  setDay: (dateKey, slots) => ipcRenderer.invoke('day:set', dateKey, slots),
  getAll: () => ipcRenderer.invoke('data:all'),
  // window
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  toggleTop: (on) => ipcRenderer.send('win:toggleTop', on),
  openDashboard: () => ipcRenderer.send('win:dashboard'),
  resize: (w, h) => ipcRenderer.send('win:resize', w, h),
});
