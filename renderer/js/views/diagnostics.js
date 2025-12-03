/* ============================================
   views/diagnostics.js - Diagnostics View
   ============================================ */

import { store } from '../store.js';

export function renderDiagnosticsView() {
  const container = document.getElementById('view-container');
  const state = store.getState();
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Settings > Diagnostics';
  
  const html = `
    <div class="diagnostics-container">
      <div class="diagnostics-header">
        <h2>Diagnostics</h2>
        <button class="btn btn-text" onclick="history.back()">
          <span class="material-icons">arrow_back</span>
          Back
        </button>
      </div>
      <div class="diagnostics-content">
        <div class="diagnostic-section">
          <h3>System Information</h3>
          <div class="diagnostic-item">
            <span class="label">App Version:</span>
            <span class="value">${state.app?.version || 'Unknown'}</span>
          </div>
          <div class="diagnostic-item">
            <span class="label">User:</span>
            <span class="value">${state.auth?.user?.email || 'Not logged in'}</span>
          </div>
          <div class="diagnostic-item">
            <span class="label">Products Loaded:</span>
            <span class="value">${state.products?.items?.length || 0}</span>
          </div>
          <div class="diagnostic-item">
            <span class="label">Shelves Loaded:</span>
            <span class="value">${state.shelves?.items?.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}
