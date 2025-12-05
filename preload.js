const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getEnv: () => ipcRenderer.invoke('get-env'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  platform: process.platform
});