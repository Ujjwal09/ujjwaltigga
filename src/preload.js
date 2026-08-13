const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tg', {
  // data
  getDay: (dateKey) => ipcRenderer.invoke('day:get', dateKey),
  setDay: (dateKey, slots) => ipcRenderer.invoke('day:set', dateKey, slots),
  getAll: () => ipcRenderer.invoke('data:all'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  setTasks: (tasks) => ipcRenderer.invoke('tasks:set', tasks),
  coach: () => ipcRenderer.invoke('coach:generate'),
  // window
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  toggleTop: (on) => ipcRenderer.send('win:toggleTop', on),
  openDashboard: () => ipcRenderer.send('win:dashboard'),
  openTracker: () => ipcRenderer.send('win:tracker'),
  resize: (w, h) => ipcRenderer.send('win:resize', w, h),
});
