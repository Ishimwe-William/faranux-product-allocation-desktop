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
import { renderDisplaySettingsView } from './views/displaySettings.js';
import { renderDiagnosticsView } from './views/diagnostics.js';
import { setupAuthHandlers as initAuthHandlers, showAuthScreen, hideAuthScreen, resetAuthForm, updateUserDisplay } from './views/auth.js';

// DOM Elements
let authScreen, appContainer, authForm, authError;
let loadingOverlay, loadingText;

// Track initialization state
let isAppInitialized = false;
let wasAuthenticated = false;

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
    store.subscribe(handleStateChange);

    // Setup auth form handlers
    setupAuthHandlers();

    // Setup app handlers
    setupAppHandlers();

    // Register routes
    registerRoutes();

    // Check initial auth state
    const state = store.getState();
    wasAuthenticated = state.auth.isAuthenticated;
    
    if (state.auth.isAuthenticated) {
      showApp();
      await loadInitialData();
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
    if (confirm('Are you sure you want to logout?')) {
      await signOut();
      resetAuthForm();
      showAuthScreen(authScreen, appContainer);
    }
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
  router.register('/settings/display', renderDisplaySettingsView);
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