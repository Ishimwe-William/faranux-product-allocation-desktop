/* ============================================
   views/settings.js - Settings View
   ============================================ */

import {store} from '../store.js';
import {updateSheetId} from '../firebase.js';
import {showCustomAlert} from '../components/modal.js';

export function renderSettingsView() {

    const versionPromise = (async () => {
        try {
            if (window.electronAPI && window.electronAPI.getEnv) {
                const env = await window.electronAPI.getEnv();
                return env?.APP_VERSION;
            }
            return 'Unknown';
        } catch (e) {
            console.warn('Failed to load app version:', e);
            return 'Unknown';
        }
    })();

    const container = document.getElementById('view-container');

    // 1. Get current state
    const state = store.getState();
    const currentSheetId = state.config?.sheetId || '';
    const currentUser = state.auth?.user;
    const lastUpdated = state.config?.lastUpdated
        ? new Date(state.config.lastUpdated).toLocaleString()
        : 'Never';

    // Update breadcrumbs
    document.getElementById('breadcrumbs').textContent = 'Settings';

    // Render View
    container.innerHTML = `
    <div class="settings-view-container">
      <div class="card">
        <div class="settings-card-header">
          <h3 class="settings-card-title">General Configuration</h3>
        </div>
        
        <div class="settings-form-group">
          <label for="sheet-id-input" class="settings-label">Google Sheet ID</label>
          <div class="settings-input-wrapper">
             <input type="text" 
                   id="sheet-id-input" 
                   placeholder="Enter your Google Sheet ID" 
                   class="settings-input-field"
                   value="${currentSheetId}">
          </div>
          <p class="settings-helper-text">
            <span class="material-icons settings-helper-icon">info</span>
            This ID is loaded from Firebase. Changing it will update the app for all users.
          </p>
        </div>
        
        <div class="settings-actions">
          <button id="save-settings-btn" class="btn btn-primary">Save Settings</button>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="settings-card-header padded">
            <h3 class="settings-card-title">Appearance</h3>
        </div>
        
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-icon-box">
              <span class="material-icons">palette</span>
            </div>
            <div class="settings-row-info">
              <h4>App Theme</h4>
              <p>Choose your preferred visual style</p>
            </div>
          </div>
          <div class="settings-row-right">
            <div class="theme-options" id="theme-options">
              <label class="theme-option"><input type="radio" name="theme" value="system"> System</label>
              <label class="theme-option"><input type="radio" name="theme" value="light"> Light</label>
              <label class="theme-option"><input type="radio" name="theme" value="dark"> Dark</label>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
         <div class="settings-card-header">
            <h3 class="settings-card-title">System Information</h3>
         </div>
         <div class="system-info-grid">
           <div class="system-info-row">
             <span class="system-label">Current User</span>
             <span class="system-value mono">${currentUser?.email || 'Not logged in'}</span>
           </div>
           <div class="system-info-row">
             <span class="system-label">Last Config Update</span>
             <span class="system-value">${lastUpdated}</span>
           </div>
           <div class="system-info-row">
             <span class="system-label">App Version</span>
             <span class="system-value" id="app-version-display">Loading...</span>
           </div>
         </div>
      </div>
    </div>
  `;

    // Update version after environment is loaded
    versionPromise.then(version => {
        const versionElement = document.getElementById('app-version-display');
        if (versionElement) {
            versionElement.textContent = version;
        }
    });

    // 2. Setup Event Listeners (Save Button)
    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const input = document.getElementById('sheet-id-input');
        const btn = document.getElementById('save-settings-btn');
        const newId = input.value.trim();

        // Validation
        if (!newId) {
            await showCustomAlert('Validation Error', 'Please enter a valid Google Sheet ID.', 'error');
            return;
        }

        if (!currentUser) {
            await showCustomAlert('Authentication Error', 'You must be logged in to change settings.', 'error');
            return;
        }

        try {
            btn.textContent = 'Saving...';
            btn.disabled = true;

            await updateSheetId(newId, currentUser.email);
            await showCustomAlert('Success', 'Settings saved successfully! The sheet ID has been updated.', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            await showCustomAlert('Save Failed', 'Error saving settings: ' + error.message, 'error');
        } finally {
            btn.textContent = 'Save Settings';
            btn.disabled = false;
        }
    });

    // 3. Setup Theme Handling
    const themeOptions = document.getElementById('theme-options');
    const currentTheme = state.display?.theme || 'system';

    // Helper to apply theme classes
    function applyTheme(theme) {
        const htmlEl = document.documentElement;
        const body = document.body;
        body.classList.remove('theme-light', 'theme-dark');
        htmlEl.removeAttribute('data-theme');

        if (theme === 'light') {
            body.classList.add('theme-light');
            htmlEl.setAttribute('data-theme', 'light');
        } else if (theme === 'dark') {
            body.classList.add('theme-dark');
            htmlEl.setAttribute('data-theme', 'dark');
        } else if (theme === 'system') {
            const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
            const prefersDark = mq ? mq.matches : false;
            body.classList.toggle('theme-dark', prefersDark);
            body.classList.toggle('theme-light', !prefersDark);
            htmlEl.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
    }

    // Bind radio buttons
    try {
        const radios = themeOptions.querySelectorAll('input[name="theme"]');
        radios.forEach(r => {
            r.checked = (r.value === currentTheme);
            r.addEventListener('change', (e) => {
                const v = e.target.value;
                store.setDisplaySettings({theme: v});
                applyTheme(v);
            });
        });
    } catch (err) {
        // no-op if elements missing
    }

    applyTheme(currentTheme);
}