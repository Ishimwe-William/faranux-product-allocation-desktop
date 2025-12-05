const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
require('dotenv').config();

let mainWindow;

require('dotenv').config({ path: path.join(__dirname, '.env') });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
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

  // Handle navigation to external URLs - open in default browser instead of within Electron
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.startsWith(mainWindow.webContents.getURL())) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  // Also handle new window requests (right-click > open in new window)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Always open DevTools to see errors
  // mainWindow.webContents.openDevTools();

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
    APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
    DEBUG: process.env.DEBUG === 'true',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
  };
});

// Open external URLs in default browser
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});