/* ============================================
   views/diagnostics.js - Modern Card-Based Diagnostics
   ============================================ */

import { store } from '../store.js';
import { testSheetConnection } from '../googleSheets.js';
import { updateSheetId } from '../firebase.js';
import { showCustomAlert, showCustomConfirm } from '../components/modal.js';

export function renderDiagnosticsView() {
  const container = document.getElementById('view-container');
  const state = store.getState();

  const breadcrumbs = document.getElementById('breadcrumbs');
  breadcrumbs.innerHTML = `
    <a href="#/settings" id="breadcrumb-settings" style="cursor:pointer;color:var(--color-text-secondary);text-decoration:none;transition:color var(--transition-fast);">Settings</a>
    <span style="margin: 0 8px; color: var(--color-text-tertiary)">›</span>
    <span>Diagnostics</span>
  `;

  const breadcrumbLink = document.getElementById('breadcrumb-settings');
  breadcrumbLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#/settings';
  });
  breadcrumbLink.addEventListener('mouseenter', () => {
    breadcrumbLink.style.color = 'var(--color-text)';
  });
  breadcrumbLink.addEventListener('mouseleave', () => {
    breadcrumbLink.style.color = 'var(--color-text-secondary)';
  });

  const currentSheetId = state.config?.sheetId || '';
  const user = state.auth?.user;

  const html = `
    <div class="diagnostics-container">

      <!-- System Information -->
      <div class="diagnostics-section">
        <div class="diagnostics-section-header">
          <h2 class="diagnostics-section-title">System Information</h2>
          <p class="diagnostics-section-subtitle">View current system status</p>
        </div>
        
        <div class="diagnostics-cards-grid">
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">App Version</div>
            <div class="diagnostic-stat-value" id="diag-app-version">...</div>
          </div>
          
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">User</div>
            <div class="diagnostic-stat-value">${user?.email || 'Not logged in'}</div>
          </div>
          
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">Products</div>
            <div class="diagnostic-stat-value">${state.products?.items?.length || 0}</div>
          </div>
          
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">Shelves</div>
            <div class="diagnostic-stat-value">${state.shelves?.items?.length || 0}</div>
          </div>
        </div>
      </div>

      <!-- Sheet Configuration -->
      <div class="diagnostics-section">
        <div class="diagnostics-section-header">
          <h2 class="diagnostics-section-title">Sheet Configuration</h2>
          <p class="diagnostics-section-subtitle">Manage Google Sheets connection</p>
        </div>
        
        <div class="card diagnostics-sheet-card">
          <div class="config-form-group">
            <label for="sheet-id-input" class="config-label">Active Sheet ID</label>
            <input type="text" 
                   id="sheet-id-input" 
                   placeholder="Enter Sheet ID or full URL" 
                   class="config-input"
                   value="${currentSheetId}">
            <div class="config-hint">
              <span class="material-icons">info</span>
              <span>This ID is shared across all users</span>
            </div>
          </div>
          
          <div class="sheet-card-actions">
            <button id="diag-copy-url" class="btn btn-secondary btn-small">
              <span class="material-icons">content_copy</span>
              Copy URL
            </button>
            <button id="diag-open-url" class="btn btn-secondary btn-small">
              <span class="material-icons">open_in_new</span>
              Open Sheet
            </button>
            <button id="diag-reset" class="btn btn-text btn-small" style="color: var(--color-error);">
              <span class="material-icons">restore</span>
              Reset
            </button>
          </div>
          
          <div class="sheet-card-divider"></div>
          
          <div class="config-actions">
            <button id="save-settings-btn" class="btn btn-primary">
              <span class="material-icons">save</span>
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      <!-- Connection Tester -->
      <div class="diagnostics-section">
        <div class="diagnostics-section-header">
          <h2 class="diagnostics-section-title">Connection Tester</h2>
          <p class="diagnostics-section-subtitle">Test your Google Sheets connection</p>
        </div>
        
        <div class="card diagnostics-test-card">
          <div class="test-card-content">
            <button id="diag-test-conn" class="btn btn-primary">
              <span class="material-icons">cloud_done</span>
              Test Connection
            </button>
          </div>
          <div id="diag-test-result" style="display: none;"></div>
        </div>
      </div>

    </div>
  `;

  container.innerHTML = html;

  // Load version
  (async () => {
    try {
      const env = window.electronAPI?.getEnv ? await window.electronAPI.getEnv() : {};
      const version = env?.APP_VERSION || '1.0.1';
      const verEl = document.getElementById('diag-app-version');
      if (verEl) verEl.textContent = version;
    } catch (e) {
      const verEl = document.getElementById('diag-app-version');
      if (verEl) verEl.textContent = '1.0.1';
    }
  })();

  // Event Listeners
  document.getElementById('diag-copy-url').addEventListener('click', async () => {
    const sid = store.getState().config?.sheetId;
    if (!sid) return await showCustomAlert('Error', 'No Sheet ID found', 'error');
    const url = `https://docs.google.com/spreadsheets/d/${sid}/edit`;
    try {
      await navigator.clipboard.writeText(url);
      await showCustomAlert('Copied', 'Sheet URL copied to clipboard', 'success');
    } catch (err) {
      await showCustomAlert('Error', 'Failed to copy to clipboard', 'error');
    }
  });

  document.getElementById('diag-open-url').addEventListener('click', async () => {
    const sid = store.getState().config?.sheetId;
    if (!sid) return await showCustomAlert('Error', 'No Sheet ID found', 'error');
    const url = `https://docs.google.com/spreadsheets/d/${sid}/edit`;
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        const result = await window.electronAPI.openExternal(url);
        if (result && result.success) return;
      }
      const opened = window.open(url, '_blank');
      if (!opened) throw new Error('Popup blocked');
    } catch (err) {
      await showCustomAlert('Error', 'Could not open URL: ' + (err.message || err), 'error');
    }
  });

  document.getElementById('diag-reset').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Reset Configuration', 'Revert to default environment Sheet ID?', 'warning');
    if (!confirmed) return;
    try {
      await updateSheetId(null, user?.email || 'unknown');
      await showCustomAlert('Success', 'Configuration reset to default.', 'success');
      renderDiagnosticsView();
    } catch (err) {
      await showCustomAlert('Error', String(err.message || err), 'error');
    }
  });

  document.getElementById('diag-test-conn').addEventListener('click', async () => {
    const btn = document.getElementById('diag-test-conn');
    const out = document.getElementById('diag-test-result');
    const icon = btn.querySelector('.material-icons');

    btn.disabled = true;
    icon.textContent = 'hourglass_empty';
    icon.style.animation = 'spin 0.8s linear infinite';
    out.style.display = 'block';
    out.className = 'test-result-pending';
    out.textContent = 'Testing connection...';

    try {
      const result = await testSheetConnection();
      icon.style.animation = '';

      if (result.success) {
        icon.textContent = 'check_circle';
        out.className = 'test-result-success';
        out.innerHTML = `
          <div class="test-result-header">
            <span class="material-icons">check_circle</span>
            <span>Connection Successful</span>
          </div>
          <div class="test-result-body">
            <div>${result.sheetTitle || 'Sheet connected'}</div>
            ${result.sheets && result.sheets.length ? `
              <div class="test-result-sheets">
                <strong>Available sheets:</strong>
                <ul>
                  ${result.sheets.map(s => `
                    <li>${s.title} — ${s.gridProperties?.rowCount || '?'}×${s.gridProperties?.columnCount || '?'}</li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        icon.textContent = 'error';
        out.className = 'test-result-error';
        out.innerHTML = `
          <div class="test-result-header">
            <span class="material-icons">error</span>
            <span>Connection Failed</span>
          </div>
          <div class="test-result-body">${result.error || 'Unknown error occurred'}</div>
        `;
      }
    } catch (err) {
      icon.style.animation = '';
      icon.textContent = 'error';
      out.className = 'test-result-error';
      out.innerHTML = `
        <div class="test-result-header">
          <span class="material-icons">error</span>
          <span>Error</span>
        </div>
        <div class="test-result-body">${String(err.message || err)}</div>
      `;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const input = document.getElementById('sheet-id-input');
    const btn = document.getElementById('save-settings-btn');
    const originalHTML = btn.innerHTML;
    const newId = input.value.trim();

    if (!newId) {
      await showCustomAlert('Validation Error', 'Please enter a valid Google Sheet ID.', 'error');
      return;
    }

    if (!user) {
      await showCustomAlert('Authentication Error', 'You must be logged in.', 'error');
      return;
    }

    try {
      btn.innerHTML = '<span class="material-icons" style="animation: spin 0.8s linear infinite;">hourglass_empty</span> Saving...';
      btn.disabled = true;

      await updateSheetId(newId, user.email);
      await showCustomAlert('Success', 'Configuration saved successfully!', 'success');
      renderDiagnosticsView();
    } catch (error) {
      await showCustomAlert('Save Failed', 'Error: ' + error.message, 'error');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });
}