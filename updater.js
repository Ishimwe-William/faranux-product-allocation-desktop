/* ============================================
   updater.js - Auto-Update Module
   ============================================ */
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

class AppUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.manualCheck = false; // Track if user manually checked for updates
        this.setupAutoUpdater();
    }

    setupAutoUpdater() {
        // Configure auto-updater
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        // Event handlers
        autoUpdater.on('checking-for-update', () => {
            log.info('Checking for updates...');
            this.sendStatusToWindow('checking-for-update');
        });

        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info.version);
            this.sendStatusToWindow('update-available', info);

            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Update Available',
                message: `A new version (${info.version}) is available!`,
                detail: 'Would you like to download it now?',
                buttons: ['Download', 'Later'],
                defaultId: 0,
                cancelId: 1
            }).then(result => {
                if (result.response === 0) {
                    autoUpdater.downloadUpdate();
                }
            });
        });

        autoUpdater.on('update-not-available', (info) => {
            log.info('Update not available. Current version:', info.version);
            this.sendStatusToWindow('update-not-available', info);

            // Only show dialog if user manually checked for updates
            if (this.manualCheck) {
                dialog.showMessageBox(this.mainWindow, {
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are running the latest version!',
                    buttons: ['OK']
                });
                this.manualCheck = false;
            }
        });

        autoUpdater.on('error', (err) => {
            log.error('Error in auto-updater:', err);
            this.sendStatusToWindow('error', err);

            // Don't show error dialog for common network errors on automatic checks
            const isNetworkError = err.message.includes('HttpError: 404') ||
                err.message.includes('Cannot parse releases feed') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('ECONNREFUSED');

            // Only show error dialog if:
            // 1. User manually checked for updates, OR
            // 2. It's not a network error
            if (this.manualCheck || !isNetworkError) {
                dialog.showErrorBox(
                    'Update Error',
                    `An error occurred while checking for updates: ${err.message}`
                );
            } else {
                log.warn('Automatic update check failed (this is normal if no releases exist yet)');
            }

            this.manualCheck = false;
        });

        autoUpdater.on('download-progress', (progressObj) => {
            let message = `Download speed: ${progressObj.bytesPerSecond}`;
            message += ` - Downloaded ${progressObj.percent.toFixed(1)}%`;
            message += ` (${progressObj.transferred}/${progressObj.total})`;

            log.info(message);
            this.sendStatusToWindow('download-progress', progressObj);
        });

        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded:', info.version);
            this.sendStatusToWindow('update-downloaded', info);

            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Update Ready',
                message: 'Update downloaded successfully!',
                detail: 'The application will restart to install the update.',
                buttons: ['Restart Now', 'Restart Later'],
                defaultId: 0,
                cancelId: 1
            }).then(result => {
                if (result.response === 0) {
                    setImmediate(() => autoUpdater.quitAndInstall(false, true));
                }
            });
        });
    }

    sendStatusToWindow(event, data = null) {
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send('update-status', { event, data });
        }
    }

    checkForUpdates(manual = false) {
        this.manualCheck = manual;
        autoUpdater.checkForUpdates();
    }

    checkForUpdatesAndNotify() {
        this.manualCheck = true;
        autoUpdater.checkForUpdatesAndNotify();
    }
}

module.exports = AppUpdater;