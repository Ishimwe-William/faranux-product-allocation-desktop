/* ============================================
   app.js - Main Application Entry Point
   ============================================ */

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showErrorScreen('JavaScript Error', event.error?.message || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  showErrorScreen('Unhandled Promise Rejection', event.reason?.message || String(event.reason));
});

import { store } from './store.js';
import { router } from './router.js';
import { initializeFirebase, signIn, signUp, signOut } from './firebase.js';
import { fetchProducts, fetchLocations, buildShelves } from './googleSheets.js';

// Import views
import { renderShelvesView } from './views/shelves.js';
import { renderShelfDetailView } from './views/shelfDetail.js';
import { renderBoxDetailView } from './views/boxDetail.js';
import { renderProductsView } from './views/products.js';
import { renderSettingsView } from './views/settings.js';
// import { renderDisplaySettingsView } from './views/displaySettings.js';
import { renderDiagnosticsView } from './views/diagnostics.js';
import { setupAuthHandlers as initAuthHandlers, showAuthScreen, hideAuthScreen, resetAuthForm, updateUserDisplay } from './views/auth.js';

import { showCustomConfirm } from './components/modal.js';

// DOM Elements
let authScreen, appContainer, authForm, authError;
let loadingOverlay, loadingText;

// Track initialization state
let isAppInitialized = false;
let wasAuthenticated = false;
// Keep previous state snapshot to detect data changes
let prevState = null;

// Initialize app
async function initApp() {
  // Get DOM elements
  authScreen = document.getElementById('auth-screen');
  appContainer = document.getElementById('app-container');
  authForm = document.getElementById('auth-form');
  authError = document.getElementById('auth-error');
  loadingOverlay = document.getElementById('loading-overlay');
  loadingText = document.getElementById('loading-text');

  // Show loading
  showLoading('Initializing...');

  try {
    // Initialize Firebase
    await initializeFirebase();

    // Subscribe to state changes
      // Capture initial state snapshot
      prevState = store.getState();
      store.subscribe(handleStateChange);

    // Setup auth form handlers
    setupAuthHandlers();

    // Setup app handlers
    setupAppHandlers();

    // Register routes
    registerRoutes();

    // Load necessary data before showing any UI (auth or app)
    await loadInitialData();

    // Apply theme from store (light / dark / system)
    try {
      const theme = store.getState().display?.theme || 'system';
      applyTheme(theme);
      // React to future display.theme changes
      store.subscribe((s) => {
        if (s.display && s.display.theme) applyTheme(s.display.theme);
      });
    } catch (err) {
      // ignore theme apply errors
    }

    // Check initial auth state and show appropriate view
    const state = store.getState();
    wasAuthenticated = state.auth.isAuthenticated;
    if (state.auth.isAuthenticated) {
      showApp();
      // Apply initial sidebar state from store
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

// Setup authentication handlers
function setupAuthHandlers() {
  initAuthHandlers();
}

// Setup app handlers
function setupAppHandlers() {
  // Logout button
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

  // Sidebar toggle button (now in sidebar header)
  const sidebarToggle = document.getElementById('sidebar-toggle-btn');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const state = store.getState();
      const newCollapsedState = !state.display.sidebarCollapsed;
      store.setDisplaySettings({ sidebarCollapsed: newCollapsedState });
      updateSidebarUI(newCollapsedState);
    });
  }

  // Top bar navigation icons
  const navButtons = document.querySelectorAll('[id^="nav-"][id$="-btn"]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.getAttribute('data-route');
      if (route) {
        router.navigate('/' + route);
      }
    });
  });

  // Sync button
  document.getElementById('sync-btn').addEventListener('click', async () => {
    await loadAllData();
  });

  // Navigation items
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

// Register routes
function registerRoutes() {
  router.register('/shelves', renderShelvesView);
  router.register('/shelf', renderShelfDetailView);
  router.register('/box', renderBoxDetailView);
  router.register('/products', renderProductsView);
  router.register('/settings', renderSettingsView);
  // router.register('/settings/display', renderDisplaySettingsView);
  router.register('/settings/diagnostics', renderDiagnosticsView);
}

// Handle state changes
function handleStateChange(state) {
  // Only handle auth state transitions, not repeated states
  if (state.auth.isAuthenticated && !wasAuthenticated) {
    // User just signed in or signed up (transition from false to true)
    wasAuthenticated = true;
    showApp();
    // Navigate to shelves view
    router.navigate('/shelves');
    // Load initial data
    loadInitialData();
  } else if (!state.auth.isAuthenticated && wasAuthenticated) {
    // User just logged out (transition from true to false)
    wasAuthenticated = false;
    showAuth();
  }

  // Update user email in sidebar
  if (state.auth.user) {
    const email = state.auth.user.email;
    const displayEmail = email.length > 20 ? email.substring(0, 20) + '...' : email;
    updateUserDisplay(displayEmail);
  }

  // Update sync time
  const lastSync = state.products.lastSync || state.shelves.lastSync;
  if (lastSync) {
    const syncTime = document.getElementById('sync-time');
    if (syncTime) {
      const date = new Date(lastSync);
      syncTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  // If shelves or products data changed compared to previous snapshot, re-render current route
  try {
    const prevShelvesCount = prevState?.shelves?.items?.length || 0;
    const prevProductsSync = prevState?.products?.lastSync || null;
    const newShelvesCount = state?.shelves?.items?.length || 0;
    const newProductsSync = state?.products?.lastSync || null;

    if (prevShelvesCount !== newShelvesCount || prevProductsSync !== newProductsSync) {
      // Re-run the current route handler to refresh the view (e.g., shelves view)
      if (router && typeof router.handleRoute === 'function') {
        router.handleRoute();
      }
    }
  } catch (err) {
    console.warn('Failed to auto-refresh route on state change:', err);
  }

  // Update previous state snapshot
  prevState = state;
}

// Load initial data
async function loadInitialData() {
  await loadAllData();
}

// Load all data
async function loadAllData() {
  showLoading('Syncing data...');
  
  try {
    store.setProductsLoading(true);
    store.setShelvesLoading(true);

    // Fetch products and locations in parallel
    const [products, locations] = await Promise.all([
      fetchProducts(),
      fetchLocations()
    ]);

    // Update store
    store.setProducts(products, locations);

    // Build shelves from locations
    const shelves = buildShelves(locations);
    store.setShelves(shelves);

  } catch (error) {
    console.error('Error loading data:', error);
    // Don't set error state to avoid infinite loops
    // Just log and continue - user can manually sync later
    store.setProductsLoading(false);
    store.setShelvesLoading(false);
  } finally {
    hideLoading();
  }
}

// Show/hide screens
function showAuth() {
  resetAuthForm();
  showAuthScreen(authScreen, appContainer);
}

function showApp() {
  hideAuthScreen(authScreen, appContainer);
}

// Loading overlay
function showLoading(message = 'Loading...') {
  loadingText.textContent = message;
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

// Error screen display
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

// Export utilities for views
export { showLoading, hideLoading };

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Apply theme helper used across app
function applyTheme(theme) {
  const htmlEl = document.documentElement;
  const body = document.body;
  // keep body classes for backward compatibility
  body.classList.remove('theme-light', 'theme-dark');
  htmlEl.removeAttribute('data-theme');

  if (theme === 'light') {
    body.classList.add('theme-light');
    htmlEl.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    body.classList.add('theme-dark');
    htmlEl.setAttribute('data-theme', 'dark');
  } else {
    // system preference
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const prefersDark = mq ? mq.matches : false;
    body.classList.toggle('theme-dark', prefersDark);
    body.classList.toggle('theme-light', !prefersDark);
    htmlEl.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    // Listen to changes
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

// Update sidebar UI based on collapsed state
function updateSidebarUI(isCollapsed) {
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.classList.toggle('sidebar-collapsed', isCollapsed);
  }
}