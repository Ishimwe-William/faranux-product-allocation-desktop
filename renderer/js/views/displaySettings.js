/* ============================================
   views/displaySettings.js - Display Settings View
   ============================================ */

import { store } from '../store.js';

export function renderDisplaySettingsView() {
  const container = document.getElementById('view-container');
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Settings > Display';
  
  const html = `
    <div class="display-settings-container">
      <div class="display-settings-header">
        <h2>Display Settings</h2>
        <button class="btn btn-text" onclick="history.back()">
          <span class="material-icons">arrow_back</span>
          Back
        </button>
      </div>
      <div class="display-settings-content">
        <div class="settings-section">
          <h3>Display Preferences</h3>
          <div class="settings-item">
            <label>
              <input type="checkbox" checked> Dark Theme
            </label>
          </div>
          <div class="settings-item">
            <label>
              <input type="checkbox" checked> Show Compact View
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}
