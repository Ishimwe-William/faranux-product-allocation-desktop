/* ============================================
   views/settings.js - Settings View
   ============================================ */

import { store } from '../store.js';
import { updateSheetId } from '../firebase.js';

export function renderSettingsView() {
  const container = document.getElementById('view-container');

  // 1. Get current state from the store
  const state = store.getState();
  const currentSheetId = state.config?.sheetId || '';
  const currentUser = state.auth?.user;
  const lastUpdated = state.config?.lastUpdated
      ? new Date(state.config.lastUpdated).toLocaleString()
      : 'Never';

  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Settings';

  const html = `
    <div class="settings-containefr">
      <div class="settings-header">
        <h2>Settings</h2>
      </div>
      <div class="settings-content">
        
        <div class="settings-section">
          <h3>General Settings</h3>
          <div class="settings-item">
            <label for="sheet-id-input">Google Sheet ID</label>
            <input type="text" 
                   id="sheet-id-input" 
                   placeholder="Enter your Google Sheet ID" 
                   class="settings-input"
                   value="${currentSheetId}">
            <p style="font-size: 12px; color: #888; margin-top: 8px;">
              This ID is loaded from Firebase. Changing it will update the app for all users.
            </p>
          </div>
          <button id="save-settings-btn" class="btn btn-primary">Save Settings</button>
        </div>

        <div class="settings-section" style="border-top: 1px solid var(--color-border); padding-top: 20px;">
           <h3 style="color: var(--color-text-secondary);">System Information</h3>
           <div style="display: grid; gap: 10px; font-size: 13px; color: var(--color-text);">
             <div style="display: flex; justify-content: space-between;">
               <span>Current User:</span>
               <span style="font-weight: 500;">${currentUser?.email || 'Not logged in'}</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
               <span>Last Config Update:</span>
               <span style="font-weight: 500;">${lastUpdated}</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
               <span>App Version:</span>
               <span style="font-weight: 500;">1.0.0</span>
             </div>
           </div>
        </div>

      </div>
    </div>
  `;

  container.innerHTML = html;

  // 2. Add Event Listener to Save Button
  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const input = document.getElementById('sheet-id-input');
    const btn = document.getElementById('save-settings-btn');
    const newId = input.value.trim();

    // Validation
    if (!newId) {
      alert('Please enter a valid Google Sheet ID.');
      return;
    }

    if (!currentUser) {
      alert('You must be logged in to change settings.');
      return;
    }

    // Save Logic
    try {
      btn.textContent = 'Saving...';
      btn.disabled = true;

      // Call the Firebase update function
      await updateSheetId(newId, currentUser.email);

      alert('Settings saved successfully! The sheet ID has been updated in Firebase.');

      // The firebase.js listener will automatically detect this change and update the store
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      btn.textContent = 'Save Settings';
      btn.disabled = false;
    }
  });
}