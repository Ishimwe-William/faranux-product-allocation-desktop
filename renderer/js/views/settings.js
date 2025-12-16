/* ============================================
   views/settings.js - Modern Card-Based Settings
   ============================================ */

import {store} from '../store.js';
import {signOut} from '../firebase.js';
import {fetchProducts, fetchLocations, buildShelves} from '../googleSheets.js';
import {fetchWooProducts} from '../woocommerce.js';
import {showCustomAlert, showCustomConfirm} from '../components/modal.js';

export function renderSettingsView() {
    const versionPromise = (async () => {
        try {
            if (window.electronAPI && window.electronAPI.getEnv) {
                const env = await window.electronAPI.getEnv();
                return env?.APP_VERSION;
            }
            return '1.0.1';
        } catch (e) {
            return '1.0.1';
        }
    })();

    const container = document.getElementById('view-container');
    const state = store.getState();
    const currentUser = state.auth?.user;

    document.getElementById('breadcrumbs').textContent = 'Settings';

    container.innerHTML = `
    <div class="settings-container">
      
      <!-- Profile Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Profile</h2>
        </div>
        <div class="card profile-card">
          <div class="profile-content">
            <div class="profile-avatar">
              <span class="material-icons">account_circle</span>
            </div>
            <div class="profile-details">
              <div class="profile-email" title="${currentUser?.email || 'Not logged in'}">${currentUser?.email || 'Not logged in'}</div>
              <div class="profile-label">Signed in</div>
            </div>
            <button id="settings-logout-btn" class="btn btn-secondary btn-small">
              <span class="material-icons">logout</span>
              Logout
            </button>
          </div>
        </div>
      </div>

      <!-- Data Management Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Data Management</h2>
          <p class="settings-section-subtitle">View and sync your inventory data</p>
        </div>
        
        <div class="settings-cards-grid">
          <!-- Products Card -->
          <div class="card settings-data-card">
            <div class="data-card-header">
              <div class="data-card-icon">
                <span class="material-icons">inventory_2</span>
              </div>
              <button id="sync-products-btn" class="btn-icon-small" title="Sync Products">
                <span class="material-icons">refresh</span>
              </button>
            </div>
            <div class="data-card-body">
              <div class="data-card-count" id="products-count">${state.products.items.length}</div>
              <div class="data-card-label">Products</div>
              <div class="data-card-time" id="products-last-sync">
                ${state.products.lastSync ? new Date(state.products.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Never synced'}
              </div>
            </div>
          </div>

          <!-- Shelves Card -->
          <div class="card settings-data-card">
            <div class="data-card-header">
              <div class="data-card-icon">
                <span class="material-icons">shelves</span>
              </div>
              <button id="sync-shelves-btn" class="btn-icon-small" title="Sync Shelves">
                <span class="material-icons">refresh</span>
              </button>
            </div>
            <div class="data-card-body">
              <div class="data-card-count" id="shelves-count">${state.shelves.items.length}</div>
              <div class="data-card-label">Shelves</div>
              <div class="data-card-time" id="shelves-last-sync">
                ${state.shelves.lastSync ? new Date(state.shelves.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Never synced'}
              </div>
            </div>
          </div>

          <!-- Full Sync Card -->
          <div class="card settings-action-card card-clickable" id="full-sync-card">
            <div class="action-card-icon-wrapper">
              <span class="material-icons">cloud_sync</span>
            </div>
            <div class="action-card-text">
              <div class="action-card-title">Full Sync</div>
              <div class="action-card-subtitle">Refresh all data</div>
            </div>
            <span class="material-icons action-card-arrow">arrow_forward</span>
          </div>
        </div>
      </div>

      <!-- Appearance Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Appearance</h2>
          <p class="settings-section-subtitle">Customize the look and feel</p>
        </div>
        <div class="card settings-option-card">
          <div class="option-card-left">
            <div class="option-card-icon">
              <span class="material-icons">palette</span>
            </div>
            <div class="option-card-info">
              <div class="option-card-title">Theme</div>
              <div class="option-card-subtitle">Choose your preferred appearance</div>
            </div>
          </div>
          <div class="theme-selector" id="theme-options">
            <label class="theme-radio">
              <input type="radio" name="theme" value="system">
              <span class="theme-radio-label">System</span>
            </label>
            <label class="theme-radio">
              <input type="radio" name="theme" value="light">
              <span class="theme-radio-label">Light</span>
            </label>
            <label class="theme-radio">
              <input type="radio" name="theme" value="dark">
              <span class="theme-radio-label">Dark</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Integrations Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Integrations</h2>
          <p class="settings-section-subtitle">Connect external services</p>
        </div>
        <div class="card settings-option-card card-clickable" id="open-woocommerce">
          <div class="option-card-left">
            <div class="option-card-icon">
              <span class="material-icons">shopping_cart</span>
            </div>
            <div class="option-card-info">
              <div class="option-card-title">WooCommerce</div>
              <div class="option-card-subtitle">Sync with your online store</div>
            </div>
          </div>
          <span class="material-icons option-card-arrow">chevron_right</span>
        </div>
      </div>

      <!-- Advanced Section -->
      <div class="settings-section">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Advanced</h2>
          <p class="settings-section-subtitle">Configuration and diagnostics</p>
        </div>
        <div class="card settings-option-card card-clickable" id="open-diagnostics">
          <div class="option-card-left">
            <div class="option-card-icon">
              <span class="material-icons">settings_suggest</span>
            </div>
            <div class="option-card-info">
              <div class="option-card-title">Diagnostics & Setup</div>
              <div class="option-card-subtitle">Check connections and configure Sheet ID</div>
            </div>
          </div>
          <span class="material-icons option-card-arrow">chevron_right</span>
        </div>
      </div>

      <!-- About Section -->
      <div class="settings-section">
        <div class="card settings-about-card">
          <div class="about-icon">
            <span class="material-icons">info</span>
          </div>
          <div class="about-text">
            <div class="about-version">Inventory Manager v<span id="app-version-display">...</span></div>
            <div class="about-subtitle">Connected to Google Sheets</div>
          </div>
        </div>
      </div>

    </div>
  `;

    versionPromise.then(version => {
        const versionElement = document.getElementById('app-version-display');
        if (versionElement) versionElement.textContent = version;
    });

    // Event Listeners
    const syncProductsBtn = document.getElementById('sync-products-btn');
    const syncShelvesBtn = document.getElementById('sync-shelves-btn');
    const fullSyncCard = document.getElementById('full-sync-card');
    const logoutBtn = document.getElementById('settings-logout-btn');
    const diagnosticsCard = document.getElementById('open-diagnostics');
    const wooCard = document.getElementById('open-woocommerce');

    if (syncProductsBtn) syncProductsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncProducts();
    });
    if (syncShelvesBtn) syncShelvesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncShelves();
    });
    if (fullSyncCard) fullSyncCard.addEventListener('click', fullSync);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (diagnosticsCard) diagnosticsCard.addEventListener('click', () => {
        window.location.hash = '#/settings/diagnostics';
    });
    if (wooCard) wooCard.addEventListener('click', () => {
        window.location.hash = '#/settings/woocommerce';
    });

    // Theme handling
    const currentTheme = state.display?.theme || 'system';
    const themeOptions = document.getElementById('theme-options');
    if (themeOptions) {
        const radios = themeOptions.querySelectorAll('input[name="theme"]');
        radios.forEach(r => {
            r.checked = (r.value === currentTheme);
            r.addEventListener('change', (e) => {
                const v = e.target.value;
                store.setDisplaySettings({theme: v});
                applyTheme(v);
            });
        });
    }

    async function syncProducts() {
        if (!syncProductsBtn) return;
        try {
            const icon = syncProductsBtn.querySelector('.material-icons');
            icon.style.animation = 'spin 0.8s linear infinite';
            syncProductsBtn.disabled = true;
            store.setProductsLoading(true);

            const [products, locations] = await Promise.all([fetchProducts(), fetchLocations()]);
            store.setProducts(products, locations);
            const shelves = buildShelves(locations);
            store.setShelves(shelves);

            const prodCount = document.getElementById('products-count');
            const prodLast = document.getElementById('products-last-sync');
            if (prodCount) prodCount.textContent = (products || []).length;
            if (prodLast) {
                const time = new Date(store.getState().products.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                prodLast.textContent = time;
            }

            await showCustomAlert('Success', 'Products synced successfully.', 'success');
        } catch (error) {
            console.error('Sync products failed:', error);
            await showCustomAlert('Sync Failed', String(error.message || error), 'error');
        } finally {
            if (syncProductsBtn) {
                const icon = syncProductsBtn.querySelector('.material-icons');
                icon.style.animation = '';
                syncProductsBtn.disabled = false;
            }
            store.setProductsLoading(false);
        }
    }

    async function syncShelves() {
        if (!syncShelvesBtn) return;
        try {
            const icon = syncShelvesBtn.querySelector('.material-icons');
            icon.style.animation = 'spin 0.8s linear infinite';
            syncShelvesBtn.disabled = true;
            store.setShelvesLoading(true);

            const locations = await fetchLocations();
            const shelves = buildShelves(locations);
            store.setShelves(shelves);

            const shelCount = document.getElementById('shelves-count');
            const shelLast = document.getElementById('shelves-last-sync');
            if (shelCount) shelCount.textContent = (shelves || []).length;
            if (shelLast) {
                const time = new Date(store.getState().shelves.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                shelLast.textContent = time;
            }

            await showCustomAlert('Success', 'Shelves synced successfully.', 'success');
        } catch (error) {
            console.error('Sync shelves failed:', error);
            await showCustomAlert('Sync Failed', String(error.message || error), 'error');
        } finally {
            if (syncShelvesBtn) {
                const icon = syncShelvesBtn.querySelector('.material-icons');
                icon.style.animation = '';
                syncShelvesBtn.disabled = false;
            }
            store.setShelvesLoading(false);
        }
    }

    async function fullSync() {
        const ok = await showCustomConfirm('Sync All Data', 'Reload all products, shelves, and WooCommerce data?', 'warning');
        if (!ok) return;

        const card = document.getElementById('full-sync-card');
        const originalContent = card.innerHTML;

        try {
            card.innerHTML = `
                <div class="action-card-icon-wrapper">
                    <span class="material-icons" style="animation: spin 0.8s linear infinite;">hourglass_empty</span>
                </div>
                <div class="action-card-text">
                    <div class="action-card-title">Syncing...</div>
                </div>
            `;
            card.style.pointerEvents = 'none';

            store.setProductsLoading(true);
            store.setShelvesLoading(true);

            const [products, locations] = await Promise.all([fetchProducts(), fetchLocations()]);
            store.setProducts(products, locations);
            const shelves = buildShelves(locations);
            store.setShelves(shelves);

            // Sync WooCommerce if enabled
            const wooEnabled = store.getState().config?.woocommerce?.enabled;
            if (wooEnabled) {
                try {
                    await fetchWooProducts();
                } catch (e) {
                    console.warn('WooCommerce sync failed:', e);
                }
            }

            const prodCount = document.getElementById('products-count');
            const prodLast = document.getElementById('products-last-sync');
            const shelCount = document.getElementById('shelves-count');
            const shelLast = document.getElementById('shelves-last-sync');

            if (prodCount) prodCount.textContent = (products || []).length;
            if (shelCount) shelCount.textContent = (shelves || []).length;
            if (prodLast) {
                const time = new Date(store.getState().products.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                prodLast.textContent = time;
            }
            if (shelLast) {
                const time = new Date(store.getState().shelves.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                shelLast.textContent = time;
            }

            await showCustomAlert('Success', 'All data synced successfully.', 'success');
        } catch (error) {
            console.error('Full sync failed:', error);
            await showCustomAlert('Sync Failed', String(error.message || error), 'error');
        } finally {
            card.innerHTML = originalContent;
            card.style.pointerEvents = '';
            store.setProductsLoading(false);
            store.setShelvesLoading(false);
        }
    }

    async function handleLogout() {
        const confirmed = await showCustomConfirm('Logout', 'Are you sure you want to logout?', 'warning');
        if (!confirmed) return;
        try {
            await signOut();
        } catch (err) {
            console.error('Logout failed:', err);
            await showCustomAlert('Logout Failed', String(err.message || err), 'error');
        }
    }

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
}