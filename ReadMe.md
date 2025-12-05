# Electron Inventory Management App - File Structure

```
inventory-manager/
│
├── main.js                          # Electron main process
├── preload.js                       # Preload script for IPC
├── package.json                     # Dependencies and scripts
│
├── renderer/
│   ├── index.html                   # Main window HTML
│   ├── css/
│   │   ├── variables.css           # CSS custom properties (colors, spacing)
│   │   ├── reset.css               # CSS reset
│   │   ├── layout.css              # Main layout styles
│   │   ├── components.css          # Reusable component styles
│   │   ├── sidebar.css             # Sidebar navigation
│   │   ├── shelves.css             # Shelves view styles
│   │   ├── products.css            # Products search styles
│   │   ├── settings.css            # Settings view styles
│   │   └── auth.css                # Authentication styles
│   │
│   ├── js/
│   │   ├── app.js                  # Main app initialization
│   │   ├── router.js               # Client-side routing
│   │   ├── store.js                # State management
│   │   ├── firebase.js             # Firebase integration
│   │   ├── googleSheets.js         # Google Sheets API
│   │   │
│   │   ├── views/
│   │   │   ├── auth.js             # Login/Register view
│   │   │   ├── shelves.js          # Shelves list view
│   │   │   ├── shelfDetail.js      # Shelf grid view
│   │   │   ├── boxDetail.js        # Box contents view
│   │   │   ├── products.js         # Product search view
│   │   │   ├── settings.js         # Settings view
│   │   │   ├── displaySettings.js  # Display settings view
│   │   │   └── diagnostics.js      # Diagnostics view
│   │   │
│   │   ├── components/
│   │   │   ├── sidebar.js          # Sidebar component
│   │   │   ├── topbar.js           # Top navigation bar
│   │   │   ├── card.js             # Card component
│   │   │   ├── modal.js            # Modal dialogs
│   │   │   └── loader.js           # Loading indicator
│   │   │
│   │   └── utils/
│   │       ├── helpers.js          # Helper functions
│   │       ├── storage.js          # LocalStorage wrapper
│   │       └── xlsx-parser.js      # Excel file parsing
│   │
│   └── assets/
│       ├── icons/                  # App icons
│       └── images/                 # Images/logos
│
└── .env                            # Environment variables
```

## Key Files Overview

### 1. **main.js** - Electron Main Process
- Creates the main window
- Handles window management
- Manages IPC communication
- Handles app lifecycle

### 2. **preload.js** - Bridge Script
- Exposes safe APIs to renderer
- IPC communication helpers

### 3. **index.html** - Main HTML Structure
- Single-page app container
- Loads all CSS and JS
- Defines app shell (sidebar + main content)

### 4. **CSS Files**
- **variables.css**: Theme colors, spacing, typography
- **layout.css**: Grid/flexbox layouts, responsive design
- **components.css**: Buttons, cards, inputs, badges
- **View-specific CSS**: Styles for each view

### 5. **JavaScript Architecture**

#### Core Files:
- **app.js**: App initialization, auth state listener
- **router.js**: URL-based routing (hash routing)
- **store.js**: Centralized state management (similar to Redux)

#### Firebase Integration:
- **firebase.js**: Auth, Firestore operations

#### Google Sheets:
- **googleSheets.js**: Fetch products, locations, shelves

#### Views:
- Each view is a module that renders HTML and handles interactions
- Views register with the router
- Views can access the global store

#### Components:
- Reusable UI components
- Each component has render() and events

### 6. **package.json** - Dependencies
```json
{
  "name": "inventory-manager",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --debug"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "firebase": "^10.7.0",
    "xlsx": "^0.18.5"
  }
}
```

## Design Philosophy

1. **Native Desktop Look**: 
   - Sidebar navigation (like Slack)
   - Top bar with breadcrumbs
   - Proper window controls
   - Desktop-appropriate spacing

2. **No Mobile UI Elements**:
   - No bottom tabs
   - No FABs
   - Desktop-style dropdowns and modals

3. **Efficient Layout**:
   - Fixed sidebar (200-250px)
   - Main content area utilizes full space
   - Grid layouts for data display

4. **Professional Styling**:
   - Subtle shadows
   - Smooth transitions
   - Consistent spacing
   - System fonts

---

## File Contents

### 1. main.js (Electron Main Process)

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

  // Open DevTools in development
  if (process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools();
  }

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
```

### 2. preload.js (Bridge Script)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform
});
```

### 3. package.json

```json
{
  "name": "inventory-manager",
  "version": "1.0.0",
  "description": "Desktop Inventory Management System",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --debug"
  },
  "keywords": ["inventory", "management", "electron"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "electron": "^28.0.0"
  }
}
```

### 4. .env (Environment Variables)

```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

GSHEETS_API_KEY=your_google_sheets_api_key
GSHEETS_DEFAULT_SHEET_ID=your_default_sheet_id
```