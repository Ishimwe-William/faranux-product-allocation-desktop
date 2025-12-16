/* ==================================
   main.js - Electron Main Process
   ================================== */
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
require('dotenv').config();

let mainWindow;
let server;

require('dotenv').config({ path: path.join(__dirname, '.env') });

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

function createLocalServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
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

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[Main] Local server running on port ${port}`);
      resolve(port);
    });
  });
}

async function createWindow() {
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

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith(`http://127.0.0.1:${port}`);
    if (!isLocal && (url.startsWith('http://') || url.startsWith('https://'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://accounts.google.com') || url.includes('firebaseapp.com') || url.includes('auth')) {
      return { action: 'allow' };
    }

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

  // Setup context menu for right-click
  setupContextMenu();
}

function setupContextMenu() {
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { selectionText, isEditable, linkURL, mediaType } = params;

    const menuTemplate = [];

    // Text selection options
    if (selectionText) {
      menuTemplate.push(
          {
            label: 'Copy',
            role: 'copy',
            accelerator: 'CmdOrCtrl+C'
          },
          { type: 'separator' }
      );
    }

    // Editable field options
    if (isEditable) {
      if (selectionText) {
        menuTemplate.push(
            {
              label: 'Cut',
              role: 'cut',
              accelerator: 'CmdOrCtrl+X'
            },
            {
              label: 'Copy',
              role: 'copy',
              accelerator: 'CmdOrCtrl+C'
            }
        );
      }

      menuTemplate.push(
          {
            label: 'Paste',
            role: 'paste',
            accelerator: 'CmdOrCtrl+V'
          },
          { type: 'separator' },
          {
            label: 'Select All',
            role: 'selectAll',
            accelerator: 'CmdOrCtrl+A'
          }
      );
    }

    // Link options
    if (linkURL) {
      menuTemplate.push(
          {
            label: 'Open Link',
            click: () => {
              shell.openExternal(linkURL);
            }
          },
          {
            label: 'Copy Link Address',
            click: () => {
              const { clipboard } = require('electron');
              clipboard.writeText(linkURL);
            }
          },
          { type: 'separator' }
      );
    }

    // Image options
    if (mediaType === 'image') {
      menuTemplate.push(
          {
            label: 'Copy Image',
            role: 'copyImageAt'
          },
          {
            label: 'Save Image As...',
            role: 'downloadURL'
          },
          { type: 'separator' }
      );
    }

    // Developer tools (always available)
    menuTemplate.push(
        {
          label: 'Inspect Element',
          click: () => {
            mainWindow.webContents.inspectElement(params.x, params.y);
          },
          accelerator: 'CmdOrCtrl+Shift+I'
        },
        {
          label: 'Reload',
          role: 'reload',
          accelerator: 'CmdOrCtrl+R'
        }
    );

    // Only show menu if there are items
    if (menuTemplate.length > 0) {
      const contextMenu = Menu.buildFromTemplate(menuTemplate);
      contextMenu.popup({ window: mainWindow });
    }
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
    WOO_CONSUMER_KEY: process.env.CONSUMER_KEY,
    WOO_CONSUMER_SECRET: process.env.CONSUMER_SECRET,
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

ipcMain.handle('woo-request', async (event, { siteUrl, consumerKey, consumerSecret, endpoint, method = 'GET' }) => {
  return new Promise((resolve) => {
    if (!siteUrl || !consumerKey || !consumerSecret) {
      return resolve({ success: false, error: 'Missing WooCommerce configuration' });
    }

    const baseUrl = siteUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${baseUrl}/wp-json/wc/v3${cleanEndpoint}`;

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const options = {
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Electron-Inventory-App'
      }
    };

    fetch(fullUrl, options)
        .then(async response => {
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`WooCommerce Error ${response.status}: ${text}`);
          }
          return response.json();
        })
        .then(data => resolve({ success: true, data }))
        .catch(error => {
          console.error('Woo Request Failed:', error);
          resolve({ success: false, error: error.message });
        });
  });
});