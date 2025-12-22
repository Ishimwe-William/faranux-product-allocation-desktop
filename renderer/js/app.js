/* ============================================
   js/app.js
   ============================================ */

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showErrorScreen('JavaScript Error', event.error?.message || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    showErrorScreen('Unhandled Promise Rejection', event.reason?.message || String(event.reason));
});

import {store} from './store.js';
import {router} from './router.js';
import {initializeFirebase, signIn, signUp, signOut} from './firebase.js';
import {fetchProducts, fetchLocations, buildShelves} from './googleSheets.js';
import {fetchWooProducts} from './woocommerce.js';
import {initContextMenu} from './contextMenu.js';

import {renderShelvesView} from './views/shelves.js';
import {renderShelfDetailView} from './views/shelfDetail.js';
import {renderBoxDetailView} from './views/boxDetail.js';
import {renderProductsView} from './views/products.js';
import {renderSettingsView} from './views/settings.js';
import {renderDiagnosticsView} from './views/diagnostics.js';
import {renderWooSettingsView} from './views/wooSettings.js';
import {renderAnalyticsView} from './views/analytics.js';
import {
    setupAuthHandlers as initAuthHandlers,
    showAuthScreen,
    hideAuthScreen,
    resetAuthForm,
    updateUserDisplay
} from './views/auth.js';

import {notificationService} from './notifications.js';
import {renderNotificationCenter} from './views/notifications.js';
import { subscribeToConfig } from './firebase.js';

import {showCustomConfirm} from './components/modal.js';

let authScreen, appContainer, authForm, authError;
let loadingOverlay, loadingText;

let wasAuthenticated = false;
let prevState = null;
let unsubscribeConfig = null;

async function initApp() {
    authScreen = document.getElementById('auth-screen');
    appContainer = document.getElementById('app-container');
    authForm = document.getElementById('auth-form');
    authError = document.getElementById('auth-error');
    loadingOverlay = document.getElementById('loading-overlay');
    loadingText = document.getElementById('loading-text');

    showLoading('Initializing...');

    try {
        const {auth, db} = await initializeFirebase();
        initContextMenu();

        prevState = store.getState();
        store.subscribe(handleStateChange);

        setupAuthHandlers();
        setupAppHandlers();
        registerRoutes();

        await loadInitialData();

        // Setup auth state listener with notification initialization
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                store.setUser({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                });

                // Initialize notification service
                try {
                    await notificationService.initialize(db, user.uid);
                    console.log('[App] Notification service initialized');
                } catch (err) {
                    console.error('[App] Failed to initialize notifications:', err);
                }

                // --- FIX 2: Correct usage of unsubscribeConfig ---
                if (unsubscribeConfig) {
                    unsubscribeConfig();
                }

                // Remove 'const' here so we update the global variable
                unsubscribeConfig = subscribeToConfig((config) => {
                    // Config updates handled automatically via store
                });

                await loadInitialData();
                wasAuthenticated = true;
                showApp();

                if (window.location.hash === '' || window.location.hash === '#/') {
                    router.navigate('/shelves');
                }

            } else {
                notificationService.cleanup();
                store.setUser(null);
                store.setGoogleToken(null);

                // --- FIX 3: Cleanup correctly ---
                if (unsubscribeConfig) {
                    unsubscribeConfig();
                    unsubscribeConfig = null;
                }

                wasAuthenticated = false;
                showAuth();
            }
        });

        try {
            const theme = store.getState().display?.theme || 'system';
            applyTheme(theme);
            store.subscribe((s) => {
                if (s.display && s.display.theme) applyTheme(s.display.theme);
            });
        } catch (err) {
            // ignore theme apply errors
        }

        const state = store.getState();
        wasAuthenticated = state.auth.isAuthenticated;
        if (state.auth.isAuthenticated) {
            showApp();
            updateSidebarUI(state.display?.sidebarCollapsed || false);
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('App initialization error:', error);
        showErrorScreen('Failed to Initialize App', error.message || String(error));
    } finally {
        hideLoading();
    }
}

function setupAuthHandlers() {
    initAuthHandlers();
}

function setupAppHandlers() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        const isConfirmed = await showCustomConfirm(
            'Logout',
            'Are you sure you want to logout?',
            'warning'
        );

        if (isConfirmed) {
            await signOut();
            resetAuthForm();
            showAuthScreen(authScreen, appContainer);
        }
    });

    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const state = store.getState();
            const newCollapsedState = !state.display.sidebarCollapsed;
            store.setDisplaySettings({sidebarCollapsed: newCollapsedState});
            updateSidebarUI(newCollapsedState);
        });
    }

    const navButtons = document.querySelectorAll('[id^="nav-"][id$="-btn"]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const route = btn.getAttribute('data-route');
            if (route) {
                router.navigate('/' + route);
            }
        });
    });

    // Notification button handler
    const notificationBtn = document.getElementById('notification-btn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            router.navigate('/notifications');
        });
    }

    document.getElementById('sync-btn').addEventListener('click', async () => {
        await loadAllData();
    });

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const route = item.getAttribute('data-route');
            if (route) {
                e.preventDefault();
                router.navigate('/' + route);
            }
        });
    });
}

function registerRoutes() {
    router.register('/shelves', renderShelvesView);
    router.register('/shelf', renderShelfDetailView);
    router.register('/box', renderBoxDetailView);
    router.register('/products', renderProductsView);
    router.register('/analytics', renderAnalyticsView);
    router.register('/notifications', renderNotificationCenter);
    router.register('/settings', renderSettingsView);
    router.register('/settings/diagnostics', renderDiagnosticsView);
    router.register('/settings/woocommerce', renderWooSettingsView);
}

function handleStateChange(state) {
    if (state.auth.isAuthenticated && !wasAuthenticated) {
        wasAuthenticated = true;
        showApp();
        router.navigate('/shelves');
        loadInitialData();
    } else if (!state.auth.isAuthenticated && wasAuthenticated) {
        wasAuthenticated = false;
        showAuth();
    }

    if (state.auth.user) {
        const email = state.auth.user.email;
        const displayEmail = email.length > 20 ? email.substring(0, 20) + '...' : email;
        updateUserDisplay(displayEmail);
    }

    const lastSync = state.products.lastSync || state.shelves.lastSync;
    if (lastSync) {
        const syncTime = document.getElementById('sync-time');
        if (syncTime) {
            const date = new Date(lastSync);
            syncTime.textContent = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        }
    }

    // Handle notification badge
    if (state.notificationCount !== undefined) {
        const topBarBadge = document.querySelector('#notification-btn');
        const sidebarBadge = document.querySelector('.nav-item[data-route="notifications"]');

        if (topBarBadge) {
            topBarBadge.setAttribute('data-count', state.notificationCount);
        }
        if (sidebarBadge) {
            sidebarBadge.setAttribute('data-count', state.notificationCount);
        }
    }

    // Update Sidebar Progress
    updateSidebarSyncStatus(state.woocommerce);

    // Refresh active view if data changes
    try {
        const prevShelvesCount = prevState?.shelves?.items?.length || 0;
        const newShelvesCount = state?.shelves?.items?.length || 0;

        const prevWooCount = prevState?.woocommerce?.products?.length || 0;
        const newWooCount = state?.woocommerce?.products?.length || 0;

        // FIX 2: Add Notification Count Check
        const prevNotifCount = prevState?.notifications?.length || 0;
        const newNotifCount = state?.notifications?.length || 0;

        const wooLoadingChanged = prevState?.woocommerce?.loading !== state?.woocommerce?.loading;

        // Add the notification check to the condition
        if (prevShelvesCount !== newShelvesCount ||
            prevWooCount !== newWooCount ||
            prevNotifCount !== newNotifCount || // <--- Added this check
            wooLoadingChanged) {

            if (router && typeof router.handleRoute === 'function') {
                router.handleRoute();
            }
        }
    } catch (err) {
        console.warn('Failed to auto-refresh route on state change:', err);
    }

    prevState = state;
}

function updateSidebarSyncStatus(wooState) {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter) return;

    // Check if progress bar already exists
    let progressEl = document.getElementById('sidebar-woo-progress');
    const userInfo = sidebarFooter.querySelector('.user-info');

    if (wooState && wooState.loading) {
        // Calculate percentage if total is known, otherwise indeterminate
        const {count, total} = wooState.progress || {count: 0, total: 0};
        const width = total > 0 ? (count / total) * 100 : 100;
        const isIndeterminate = !total || total === 0;

        const html = `
            <div style="margin-bottom: 12px; font-size: 11px; color: var(--color-text-secondary); padding: 0 4px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-weight: 500;">
                    <span>Syncing...</span>
                    <span>${count} ${total ? '/ ' + total : ''}</span>
                </div>
                <div style="height: 4px; background: rgba(128,128,128,0.2); border-radius: 2px; overflow: hidden;">
                    <div style="
                        height: 100%; 
                        background: var(--color-primary); 
                        width: ${isIndeterminate ? '30%' : width + '%'}; 
                        transition: width 0.3s ease;
                        ${isIndeterminate ? 'animation: indeterminate 1.5s infinite linear;' : ''}
                    "></div>
                </div>
            </div>
        `;

        if (!progressEl) {
            // Create new element
            progressEl = document.createElement('div');
            progressEl.id = 'sidebar-woo-progress';
            progressEl.innerHTML = html;
            // Insert strictly before user-info
            if (userInfo) {
                sidebarFooter.insertBefore(progressEl, userInfo);
            } else {
                sidebarFooter.appendChild(progressEl);
            }
        } else {
            // Update existing
            progressEl.innerHTML = html;
        }
    } else {
        // Remove if not loading
        if (progressEl) progressEl.remove();
    }
}

async function loadInitialData() {
    await loadAllData();
}

async function loadAllData() {
    showLoading('Syncing data...');

    try {
        store.setProductsLoading(true);
        store.setShelvesLoading(true);

        const [products, locations] = await Promise.all([
            fetchProducts(),
            fetchLocations()
        ]);

        store.setProducts(products, locations);

        const shelves = buildShelves(locations);
        store.setShelves(shelves);

        // Sync WooCommerce in background (non-blocking)
        const wooEnabled = store.getState().config?.woocommerce?.enabled;
        if (wooEnabled) {
            fetchWooProducts().catch(e => {
                console.warn('WooCommerce sync failed:', e);
            });
        }

    } catch (error) {
        console.error('Error loading data:', error);
        store.setProductsLoading(false);
        store.setShelvesLoading(false);
    } finally {
        hideLoading();
    }
}

function showAuth() {
    resetAuthForm();
    showAuthScreen(authScreen, appContainer);
}

function showApp() {
    hideAuthScreen(authScreen, appContainer);
}

function showLoading(message = 'Loading...') {
    loadingText.textContent = message;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showErrorScreen(title, message) {
    const errorScreen = document.getElementById('error-screen');
    const errorTitle = document.querySelector('#error-screen h1');
    const errorMsg = document.getElementById('error-message');
    const errorDetails = document.getElementById('error-details');

    if (errorScreen) {
        errorMsg.textContent = message || 'An unknown error occurred';
        errorDetails.textContent = `${title}\n\n${message || '(no details)'}`;
        errorScreen.style.display = 'flex';
    }

    console.error(`[Error Screen] ${title}: ${message}`);
}

export {showLoading, hideLoading};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
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
    } else {
        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        const prefersDark = mq ? mq.matches : false;
        body.classList.toggle('theme-dark', prefersDark);
        body.classList.toggle('theme-light', !prefersDark);
        htmlEl.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        if (mq) {
            mq.addEventListener ? mq.addEventListener('change', (e) => {
                body.classList.toggle('theme-dark', e.matches);
                body.classList.toggle('theme-light', !e.matches);
                htmlEl.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }) : mq.addListener((e) => {
                body.classList.toggle('theme-dark', e.matches);
                body.classList.toggle('theme-light', !e.matches);
                htmlEl.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            });
        }
    }
}

function updateSidebarUI(isCollapsed) {
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.classList.toggle('sidebar-collapsed', isCollapsed);
    }
}

const style = document.createElement('style');
style.textContent = `
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
`;
document.head.appendChild(style);