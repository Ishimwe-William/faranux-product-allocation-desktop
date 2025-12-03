const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'default',
    frame: true
  });

  mainWindow.loadFile('renderer/index.html');

  // Always open DevTools to see errors
  mainWindow.webContents.openDevTools();

  // Log when ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page loaded successfully');
  });

  // Log errors
  mainWindow.webContents.on('crashed', () => {
    console.error('[Main] Renderer process crashed');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Get environment variables (safe to expose public Firebase config and Google Sheets config)
ipcMain.handle('get-env', () => {
  return {
    FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    GSHEETS_API_KEY: process.env.EXPO_PUBLIC_GSHEETS_API_KEY,
    GSHEET_ID: process.env.EXPO_PUBLIC_GSHEET_ID,
    DEBUG: process.env.DEBUG === 'true',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
  };
});