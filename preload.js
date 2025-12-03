const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getEnv: () => ipcRenderer.invoke('get-env'),
  platform: process.platform
});
