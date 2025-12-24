/* ============================================
   preload.js - Electron Preload Script
   ============================================ */
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getEnv: () => ipcRenderer.invoke('get-env'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    wooRequest: (params) => ipcRenderer.invoke('woo-request', params),
    loginGoogle: (clientId) => ipcRenderer.invoke('login-google', clientId),
    setBadgeCount: (count) => ipcRenderer.invoke('set-badge-count', count),
    platform: process.platform,

    // Auto-updater methods
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    },
    removeUpdateStatusListener: () => {
        ipcRenderer.removeAllListeners('update-status');
    }
});