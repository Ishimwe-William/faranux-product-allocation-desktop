/* ============================================
   preload.js - Electron Preload Script
   ============================================ */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getEnv: () => ipcRenderer.invoke('get-env'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  wooRequest: (params) => ipcRenderer.invoke('woo-request', params),
  platform: process.platform
});