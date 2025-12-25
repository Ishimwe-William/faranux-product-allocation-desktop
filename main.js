/* ==========================================================================
   main.js - Electron Main Process Entry Point
   ==========================================================================
   This file controls the application lifecycle, creates the native browser
   window, manages the auto-updater, and handles all communication between
   the OS and the web interface (Renderer process) via IPC.
   ========================================================================== */

const { app, BrowserWindow, ipcMain, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const AppUpdater = require('./updater'); // Custom updater logic
const appPackage = require('./package.json');

// Initialize environment variables
require('dotenv').config();
// Ensure .env is loaded specifically from the current directory (helpful for production builds)
require('dotenv').config({ path: path.join(__dirname, '.env') });

let mainWindow;  // Reference to the main application window
let server;      // Reference to the local static file server
let appUpdater;  // Reference to the auto-updater instance
let authServer;  // Temporary server for handling Google OAuth callbacks

// Set the internal application name (used for User Data directories)
app.setName('Inventory Manager');

// MIME types for the local static server to serve files correctly
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

/**
 * Creates a dynamic "Badge" icon for Windows Taskbar.
 * MacOS handles badges natively, but Windows requires an "Overlay Icon".
 * This function draws a red circle with a white number using the Canvas API.
 * * @param {number} count - The number of unread notifications
 * @returns {Promise<nativeImage>} - Electron NativeImage object
 */
async function createBadgeIcon(count) {
    try {
        const { createCanvas } = require('canvas');

        // 1. Setup Canvas
        // 128x128 provides high enough resolution for Windows taskbar scaling
        const size = 128;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // 2. Clear Canvas (Ensure transparency)
        ctx.clearRect(0, 0, size, size);

        // 3. Define Dimensions & Alignment
        // Slightly offset to ensure the shadow doesn't get clipped
        const centerX = (size / 2) + 5;
        const centerY = (size / 2) + 5;
        const radius = (size / 2) - 5;

        // 4. Add Drop Shadow
        // A black shadow ensures the red badge is visible on light taskbars
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 3;

        // 5. Draw The Circle Badge (Background)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000'; // Bright Notification Red
        ctx.fill();

        // Reset shadow so the text inside remains crisp
        ctx.shadowColor = 'transparent';

        // 6. Draw Text (The Counter)
        const text = count > 99 ? '99+' : String(count);

        // Dynamic Font Sizing:
        // Adjust font size based on how many digits are displayed to fit the circle
        let fontSize;
        let yOffset;

        if (text.length === 1) {
            fontSize = 95;
            yOffset = 4;
        } else if (text.length === 2) {
            fontSize = 75;
            yOffset = 4;
        } else {
            fontSize = 55; // Smaller font for "99+"
            yOffset = 2;
        }

        ctx.fillStyle = '#ffffff'; // White text
        ctx.font = `bold ${fontSize}px "Segoe UI", "Arial", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(text, centerX, centerY + yOffset);

        // Convert canvas buffer to Electron NativeImage
        const buffer = canvas.toBuffer('image/png');
        const image = nativeImage.createFromBuffer(buffer);

        if (image.isEmpty()) {
            console.error('[Main] Created badge image is empty');
            return null;
        }

        return image;

    } catch (e) {
        console.error('[Main] Exception creating badge:', e);
        return null;
    }
}

/**
 * Starts a local HTTP server to serve the React/HTML renderer files.
 * This avoids "file://" protocol restrictions (CORS, loading local resources).
 * * @returns {Promise<number>} - The port number the server is listening on.
 */
function createLocalServer() {
    return new Promise((resolve) => {
        server = http.createServer((req, res) => {
            // Default to index.html for root, otherwise serve specific file
            let fileUrl = req.url === '/' ? 'index.html' : req.url;
            let filePath = path.join(__dirname, 'renderer', fileUrl);

            const extname = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[extname] || 'application/octet-stream';

            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        // File not found
                        console.warn(`[Server] 404 Not Found: ${filePath}`);
                        res.writeHead(404);
                        res.end('404 Not Found');
                    } else {
                        // Server error
                        console.error(`[Server] 500 Error: ${error.code} for ${filePath}`);
                        res.writeHead(500);
                        res.end('500 Internal Server Error');
                    }
                } else {
                    // Success: Serve file with correct MIME type
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        });

        // Listen on port 0 (OS assigns a random available free port)
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            console.log(`[Main] Local server running on port ${port}`);
            resolve(port);
        });
    });
}

/**
 * Initializes and creates the Main Electron Window.
 */
async function createWindow() {
    // Wait for local server to start
    const port = await createLocalServer();

    // NOTE: App User Model ID is required for Windows Toast Notifications
    /*
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.bunsenplus.fxproductallocation');
    }
    */

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        icon: path.join(__dirname, 'assets/icons/icon.png'),
        webPreferences: {
            nodeIntegration: false, // SECURITY: Disable Node in renderer
            contextIsolation: true, // SECURITY: Protect global scope
            preload: path.join(__dirname, 'preload.js') // Bridge script
        },
        backgroundColor: '#1a1a1a', // Dark mode background to prevent white flash on load
        titleBarStyle: 'default',
        frame: true
    });

    // Load the app from the local server
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);

    // --- SECURITY HANDLERS ---

    // 1. Prevent in-app navigation to external sites
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const isLocal = url.startsWith(`http://127.0.0.1:${port}`);
        // If it's not our local server, open in default system browser
        if (!isLocal && (url.startsWith('http://') || url.startsWith('https://'))) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // 2. Handle window.open() requests
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Allow Google Auth & Firebase popups
        if (url.startsWith('https://accounts.google.com') || url.includes('firebaseapp.com') || url.includes('auth')) {
            return { action: 'allow' };
        }
        // Deny everything else and open in system browser
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Cleanup when window closes
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Initialize context menu (Right-click) and Updater
    setupContextMenu();
    appUpdater = new AppUpdater(mainWindow);

    // Check for updates shortly after launch
    setTimeout(() => {
        appUpdater.checkForUpdates();
    }, 3000);
}

/**
 * Adds a standard Right-Click Context Menu.
 * Electron does not have a default context menu (Cut/Copy/Paste), so we must build it.
 */
function setupContextMenu() {
    mainWindow.webContents.on('context-menu', (event, params) => {
        const { selectionText, isEditable, linkURL, mediaType } = params;
        const menuTemplate = [];

        // Add 'Copy' if text is selected
        if (selectionText) {
            menuTemplate.push(
                { label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C' },
                { type: 'separator' }
            );
        }

        // Add Editing inputs (Cut/Paste) for text boxes
        if (isEditable) {
            if (selectionText) {
                menuTemplate.push(
                    { label: 'Cut', role: 'cut', accelerator: 'CmdOrCtrl+X' },
                    { label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C' }
                );
            }
            menuTemplate.push(
                { label: 'Paste', role: 'paste', accelerator: 'CmdOrCtrl+V' },
                { type: 'separator' },
                { label: 'Select All', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }
            );
        }

        // Add Link options
        if (linkURL) {
            menuTemplate.push(
                { label: 'Open Link', click: () => shell.openExternal(linkURL) },
                { label: 'Copy Link Address', click: () => { require('electron').clipboard.writeText(linkURL); } },
                { type: 'separator' }
            );
        }

        // Add Image options
        if (mediaType === 'image') {
            menuTemplate.push(
                { label: 'Copy Image', role: 'copyImageAt' },
                { label: 'Save Image As...', role: 'downloadURL' },
                { type: 'separator' }
            );
        }

        // Always available developer tools
        menuTemplate.push(
            { label: 'Inspect Element', click: () => mainWindow.webContents.inspectElement(params.x, params.y), accelerator: 'CmdOrCtrl+Shift+I' },
            { label: 'Reload', role: 'reload', accelerator: 'CmdOrCtrl+R' }
        );

        if (menuTemplate.length > 0) {
            Menu.buildFromTemplate(menuTemplate).popup({ window: mainWindow });
        }
    });
}

// --- APP LIFECYCLE EVENTS ---

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    // Mac behavior: keep app in dock until Cmd+Q
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    // Mac behavior: Re-create window if dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ==========================================================================
   IPC HANDLERS (Communication between Renderer and Main)
   ========================================================================== */

/**
 * Returns environment variables to the renderer.
 * Using IPC is safer than exposing process.env directly in preload.
 */
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
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
        WOO_CONSUMER_KEY: process.env.CONSUMER_KEY,
        WOO_CONSUMER_SECRET: process.env.CONSUMER_SECRET,
        DEBUG: process.env.DEBUG === 'true',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    };
});

ipcMain.handle('get-app-version', () => appPackage.version);

/**
 * Handles setting the unread count badge.
 * Logic differs by Operating System.
 */
ipcMain.handle('set-badge-count', async (event, count) => {
    if (!mainWindow) {
        console.warn('[Main] No window available for badge update');
        return { success: false, error: 'No window' };
    }

    try {
        if (process.platform === 'darwin') {
            // macOS: Native dock badge support
            app.dock.setBadge(count > 0 ? String(count) : '');
            return { success: true };

        } else if (process.platform === 'win32') {
            // Windows: Needs a generated Overlay Icon
            if (count > 0) {
                const badgeIcon = await createBadgeIcon(count);

                if (badgeIcon && !badgeIcon.isEmpty()) {
                    const description = `${count} unread notification${count !== 1 ? 's' : ''}`;
                    mainWindow.setOverlayIcon(badgeIcon, description);
                } else {
                    console.warn('[Main] Badge icon creation returned null or empty image');
                    return { success: false, error: 'Failed to create badge icon' };
                }
            } else {
                // Clear the overlay
                mainWindow.setOverlayIcon(null, '');
            }
            return { success: true };

        } else if (process.platform === 'linux') {
            // Linux: Basic badge count support
            app.setBadgeCount(count);
            return { success: true };
        }

        return { success: true };

    } catch (error) {
        console.error('[Main] Error setting badge:', error);
        return { success: false, error: error.message };
    }
});

/**
 * Handles Google OAuth Login loopback.
 * Creates a temporary local server to catch the Google redirect callback.
 */
ipcMain.handle('login-google', async (event, clientId) => {
    return new Promise((resolve, reject) => {
        // Spin up temporary auth server
        authServer = http.createServer((req, res) => {
            const urlObj = new URL(req.url, `http://127.0.0.1:4200`);

            // Step 2: Google redirects here with token in hash
            if (urlObj.pathname === '/callback') {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(`
    <html>
      <head>
        <title>Authenticating...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
            text-align: center;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          h1 { color: #333; margin-bottom: 16px; font-size: 24px; }
          p { color: #666; margin-bottom: 0; line-height: 1.5; }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px auto;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h1>We're authenticating...</h1>
          <p>Please check your app for successful login.</p>
          <p style="font-size: 0.9em; margin-top: 10px; color: #999;">You can close this tab once the app updates.</p>
        </div>
        <script>
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          
          if (params.has('id_token')) {
            fetch('/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id_token: params.get('id_token'),
                access_token: params.get('access_token')
              })
            }).then(() => {
               document.querySelector('h1').textContent = "Success!";
               document.querySelector('p').textContent = "You can now return to the app.";
               document.querySelector('.spinner').style.display = 'none';
            });
          } else {
            document.querySelector('h1').textContent = "Authentication Failed";
            document.querySelector('p').textContent = "No token found. Please try again.";
            document.querySelector('.spinner').style.display = 'none';
          }
        </script>
      </body>
    </html>
  `);
                return;
            }

            // Step 3: Receive token from the client-side script above
            if (req.method === 'POST' && req.url === '/token') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        res.writeHead(200);
                        res.end('Auth successful');
                        resolve(data); // Pass token back to Main -> Renderer
                    } catch (e) { reject(e); }
                    finally {
                        // Close server after successful auth
                        if (authServer) authServer.close();
                        authServer = null;
                    }
                });
                return;
            }
        });

        // Step 1: Start listener and open external browser for Google Login
        authServer.listen(4200, '127.0.0.1', () => {
            const redirectUri = 'http://127.0.0.1:4200/callback';
            const scope = encodeURIComponent('email profile openid https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly');
            shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?response_type=token%20id_token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&nonce=${Date.now()}`);
        });

        authServer.on('error', (err) => {
            if (authServer) authServer.close();
            reject(new Error('Auth server failed: ' + err.message));
        });
    });
});

ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-for-updates', async () => {
    if (appUpdater) {
        appUpdater.checkForUpdates(true); // 'true' forces a check
        return { success: true };
    }
    return { success: false, error: 'Updater not initialized' };
});

/**
 * Proxies requests to WooCommerce API.
 * This is done in the Main process to:
 * 1. Bypass CORS issues in the Renderer.
 * 2. Keep Basic Auth headers generation internal.
 */
ipcMain.handle('woo-request', async (event, { siteUrl, consumerKey, consumerSecret, endpoint, method = 'GET' }) => {
    return new Promise((resolve) => {
        if (!siteUrl || !consumerKey || !consumerSecret) return resolve({ success: false, error: 'Missing config' });

        const baseUrl = siteUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        // Create Basic Auth header
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

        fetch(`${baseUrl}/wp-json/wc/v3${cleanEndpoint}`, {
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Electron-Inventory-App'
            }
        })
            .then(async res => {
                if (!res.ok) throw new Error(`Woo Error ${res.status}: ${await res.text()}`);
                return res.json();
            })
            .then(data => resolve({ success: true, data }))
            .catch(error => resolve({ success: false, error: error.message }));
    });
});