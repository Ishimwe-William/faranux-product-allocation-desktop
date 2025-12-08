/* ============================================
   main.js - Electron Main Process (UPDATED)
   ============================================ */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http'); // Required for local server
const fs = require('fs');     // Required to read files
require('dotenv').config();

let mainWindow;
let server;

// Load env from current directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

// MIME types to ensure files allow the browser to interpret them correctly
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Create a simple local HTTP server to serve the 'renderer' folder
function createLocalServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      // 1. Determine the file path.
      // We assume your 'index.html' and assets are inside the 'renderer' folder.
      // If the URL is '/', serve 'renderer/index.html'.
      let fileUrl = req.url === '/' ? 'index.html' : req.url;
      let filePath = path.join(__dirname, 'renderer', fileUrl);

      const extname = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[extname] || 'application/octet-stream';

      fs.readFile(filePath, (error, content) => {
        if (error) {
          if (error.code === 'ENOENT') {
            console.warn(`[Server] 404 Not Found: ${filePath}`);
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            console.error(`[Server] 500 Error: ${error.code} for ${filePath}`);
            res.writeHead(500);
            res.end('500 Internal Server Error');
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });

    // Listen on port 0 (lets the OS pick a random available port)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[Main] Local server running on port ${port}`);
      resolve(port);
    });
  });
}

async function createWindow() {
  // Start the server before creating the window
  const port = await createLocalServer();

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

  // CHANGE: Load from localhost instead of file://
  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // mainWindow.webContents.openDevTools();

  // Handle navigation to external URLs (open in browser)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith(`http://127.0.0.1:${port}`);
    if (!isLocal && (url.startsWith('http://') || url.startsWith('https://'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle popup windows (CRITICAL for Google Sign-In)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Google Auth popups to open
    if (url.startsWith('https://accounts.google.com') || url.includes('firebaseapp.com') || url.includes('auth')) {
      return { action: 'allow' };
    }

    // Open other external links in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page loaded successfully');
  });

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

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});