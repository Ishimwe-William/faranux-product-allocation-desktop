/* ============================================
   views/wooSettings.js - WooCommerce Settings
   ============================================ */

import { store } from '../store.js';
import { updateWooConfig } from '../firebase.js';
import { testWooConnection, fetchWooProducts } from '../woocommerce.js';
import { showCustomAlert, showCustomConfirm } from '../components/modal.js';

export function renderWooSettingsView() {
    const container = document.getElementById('view-container');
    const state = store.getState();
    const wooState = state.woocommerce || {};

    const breadcrumbs = document.getElementById('breadcrumbs');
    breadcrumbs.innerHTML = `
    <a href="#/settings" style="cursor:pointer;color:var(--color-text-secondary);text-decoration:none;">Settings</a>
    <span style="margin: 0 8px; color: var(--color-text-tertiary)">›</span>
    <span>WooCommerce</span>
  `;

    const currentConfig = state.config?.woocommerce || {};
    const user = state.auth?.user;

    const html = `
    <div class="diagnostics-container">

      <!-- System Information -->
      <div class="diagnostics-section">
        <div class="diagnostics-section-header">
          <h2 class="diagnostics-section-title">WooCommerce Integration</h2>
          <p class="diagnostics-section-subtitle">Connect your online store</p>
        </div>
        
        <div class="diagnostics-cards-grid">
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">Status</div>
            <div class="diagnostic-stat-value" style="color: ${currentConfig.enabled ? 'var(--color-success)' : 'var(--color-text-tertiary)'}">
              ${currentConfig.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">Products Synced</div>
            <div class="diagnostic-stat-value">${state.woocommerce?.products?.length || 0}</div>
          </div>
          
          <div class="card diagnostic-stat-card">
            <div class="diagnostic-stat-label">Last Sync</div>
            <div class="diagnostic-stat-value" style="font-size: 13px;">
              ${state.woocommerce?.lastSync ? new Date(state.woocommerce.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Never'}
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration -->
      <div class="diagnostics-section">
        <div class="diagnostics-section-header">
          <h2 class="diagnostics-section-title">Store Configuration</h2>
          <p class="diagnostics-section-subtitle">Enter your WooCommerce credentials</p>
        </div>
        
        <div class="card diagnostics-sheet-card">
          <div class="config-form-group">
            <label for="woo-site-url" class="config-label">Store URL</label>
            <input type="text" 
                   id="woo-site-url" 
                   placeholder="https://yourstore.com" 
                   class="config-input"
                   value="${currentConfig.siteUrl || ''}">
            <div class="config-hint">
              <span class="material-icons">info</span>
              <span>Your WooCommerce store URL (with https://)</span>
            </div>
          </div>

          <div class="config-form-group">
            <label for="woo-consumer-key" class="config-label">Consumer Key</label>
            <div style="position: relative;">
              <input type="password" 
                     id="woo-consumer-key" 
                     placeholder="ck_xxxxxxxxxxxxxxxx" 
                     class="config-input"
                     value="${currentConfig.consumerKey || ''}">
              <button id="toggle-key-visibility" class="btn-icon-small" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%);">
                <span class="material-icons">visibility</span>
              </button>
            </div>
          </div>

          <div class="config-form-group">
            <label for="woo-consumer-secret" class="config-label">Consumer Secret</label>
            <div style="position: relative;">
              <input type="password" 
                     id="woo-consumer-secret" 
                     placeholder="cs_xxxxxxxxxxxxxxxx" 
                     class="config-input"
                     value="${currentConfig.consumerSecret || ''}">
              <button id="toggle-secret-visibility" class="btn-icon-small" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%);">
                <span class="material-icons">visibility</span>
              </button>
            </div>
          </div>

          <div class="config-form-group">
            <label class="config-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="woo-enabled" ${currentConfig.enabled ? 'checked' : ''}>
              <span>Enable WooCommerce Integration</span>
            </label>
          </div>
          
          <div class="sheet-card-divider"></div>
          
          <div class="config-actions">
            <button id="test-woo-connection" class="btn btn-secondary">
              <span class="material-icons">cloud_done</span>
              Test Connection
            </button>
            <button id="save-woo-settings" class="btn btn-primary">
              <span class="material-icons">save</span>
              Save Configuration
            </button>
          </div>

          <div id="woo-test-result" style="display: none; margin-top: 16px;"></div>
        </div>
      </div>

      <!-- Sync Section -->
      <div class="diagnostics-section">
        <div class="diagnostics-section-header">
          <h2 class="diagnostics-section-title">Data Synchronization</h2>
          <p class="diagnostics-section-subtitle">Sync products from WooCommerce</p>
        </div>
        
        <div class="card diagnostics-test-card">
          <div class="test-card-content">
            <button id="sync-woo-products" class="btn btn-primary" ${!currentConfig.enabled || wooState?.loading ? 'disabled' : ''} >
              <span class="material-icons">cloud_sync</span>
              Sync Products Now
            </button>
          </div>
        </div>
      </div>

    </div>
  `;

    container.innerHTML = html;

    // Event Listeners
    setupEventListeners(currentConfig, user);
}

function setupEventListeners(currentConfig, user) {
    // Toggle visibility buttons
    document.getElementById('toggle-key-visibility').addEventListener('click', () => {
        const input = document.getElementById('woo-consumer-key');
        const icon = document.querySelector('#toggle-key-visibility .material-icons');
        if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            icon.textContent = 'visibility';
        }
    });

    document.getElementById('toggle-secret-visibility').addEventListener('click', () => {
        const input = document.getElementById('woo-consumer-secret');
        const icon = document.querySelector('#toggle-secret-visibility .material-icons');
        if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            icon.textContent = 'visibility';
        }
    });

    // Test connection
    document.getElementById('test-woo-connection').addEventListener('click', async () => {
        const btn = document.getElementById('test-woo-connection');
        const resultEl = document.getElementById('woo-test-result');
        const icon = btn.querySelector('.material-icons');

        const siteUrl = document.getElementById('woo-site-url').value.trim();
        const key = document.getElementById('woo-consumer-key').value.trim();
        const secret = document.getElementById('woo-consumer-secret').value.trim();

        if (!siteUrl || !key || !secret) {
            await showCustomAlert('Validation Error', 'Please fill in all fields', 'error');
            return;
        }

        btn.disabled = true;
        icon.textContent = 'hourglass_empty';
        icon.style.animation = 'spin 0.8s linear infinite';
        resultEl.style.display = 'block';
        resultEl.className = 'test-result-pending';
        resultEl.textContent = 'Testing connection...';

        try {
            const result = await testWooConnection(siteUrl, key, secret);
            icon.style.animation = '';

            if (result.success) {
                icon.textContent = 'check_circle';
                resultEl.className = 'test-result-success';
                resultEl.innerHTML = `
          <div class="test-result-header">
            <span class="material-icons">check_circle</span>
            <span>Connection Successful</span>
          </div>
          <div class="test-result-body">
            ${result.data ? `Found ${result.data.length} product(s)` : 'Connection verified'}
          </div>
        `;
            } else {
                icon.textContent = 'error';
                resultEl.className = 'test-result-error';
                resultEl.innerHTML = `
          <div class="test-result-header">
            <span class="material-icons">error</span>
            <span>Connection Failed</span>
          </div>
          <div class="test-result-body">${result.message}</div>
        `;
            }
        } catch (err) {
            icon.style.animation = '';
            icon.textContent = 'error';
            resultEl.className = 'test-result-error';
            resultEl.innerHTML = `
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

    // Save settings
    document.getElementById('save-woo-settings').addEventListener('click', async () => {
        const btn = document.getElementById('save-woo-settings');
        const originalHTML = btn.innerHTML;

        const siteUrl = document.getElementById('woo-site-url').value.trim();
        const key = document.getElementById('woo-consumer-key').value.trim();
        const secret = document.getElementById('woo-consumer-secret').value.trim();
        const enabled = document.getElementById('woo-enabled').checked;

        if (!siteUrl || !key || !secret) {
            await showCustomAlert('Validation Error', 'Please fill in all fields', 'error');
            return;
        }

        if (!user) {
            await showCustomAlert('Authentication Error', 'You must be logged in.', 'error');
            return;
        }

        try {
            btn.innerHTML = '<span class="material-icons" style="animation: spin 0.8s linear infinite;">hourglass_empty</span> Saving...';
            btn.disabled = true;

            await updateWooConfig({
                siteUrl,
                consumerKey: key,
                consumerSecret: secret,
                enabled
            }, user.email);

            await showCustomAlert('Success', 'WooCommerce settings saved!', 'success');

            // Enable sync button if enabled
            const syncBtn = document.getElementById('sync-woo-products');
            if (syncBtn) syncBtn.disabled = !enabled;
        } catch (error) {
            await showCustomAlert('Save Failed', 'Error: ' + error.message, 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });

    // Sync products
    document.getElementById('sync-woo-products').addEventListener('click', async () => {
        const btn = document.getElementById('sync-woo-products');
        const icon = btn.querySelector('.material-icons');

        try {
            icon.style.animation = 'spin 0.8s linear infinite';
            btn.disabled = true;

            await fetchWooProducts();
            await showCustomAlert('Success', 'WooCommerce products synced!', 'success');
            renderWooSettingsView(); // Refresh view
        } catch (error) {
            await showCustomAlert('Sync Failed', error.message, 'error');
        } finally {
            icon.style.animation = '';
            btn.disabled = false;
        }
    });
}