/* ============================================
   store.js - State Management (UPDATED)
   ============================================ */

export class Store {
  constructor() {
    this.state = {
      auth: {
        user: null,
        isAuthenticated: false,
        googleAccessToken: null // ✅ NEW: To store the Google OAuth token
      },
      shelves: {
        items: [],
        loading: false,
        error: null,
        lastSync: null
      },
      products: {
        items: [],
        locations: [],
        loading: false,
        error: null,
        lastSync: null
      },
      config: {
        sheetId: null,
        sheetUrl: null,
        lastUpdated: null,
        updatedBy: null
      },
      display: {
        scalePreset: 'normal',
        customScale: 1.0,
        useCustomScale: false,
        gridCellSize: 60,
        gridDensity: 'normal',
        compactMode: false,
        showGridLabels: true,
        animationsEnabled: true,
        theme: 'system',
        sidebarCollapsed: false
      }
    };

    this.listeners = [];
    this.loadFromStorage();
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Get current state
  getState() {
    return this.state;
  }

  // Update state
  setState(updates) {
    this.state = this.deepMerge(this.state, updates);
    this.notify();
    this.saveToStorage();
  }

  // Deep merge helper
  deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  // Save to localStorage
  saveToStorage() {
    const persistData = {
      display: this.state.display,
      config: this.state.config
    };
    localStorage.setItem('inventoryAppState', JSON.stringify(persistData));
  }

  // Load from localStorage
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('inventoryAppState');
      if (saved) {
        const data = JSON.parse(saved);
        this.state = this.deepMerge(this.state, data);
      }
    } catch (error) {
      console.error('Failed to load state from storage:', error);
    }
  }

  // Auth actions
  setUser(user) {
    // We merge to avoid overwriting the token if it exists and we're just updating the user object
    this.setState({
      auth: {
        ...this.state.auth,
        user,
        isAuthenticated: !!user
      }
    });
  }

  // ✅ NEW: Action to store the Google Access Token
  setGoogleToken(token) {
    this.setState({
      auth: {
        ...this.state.auth,
        googleAccessToken: token
      }
    });
  }

  // Shelves actions
  setShelves(items) {
    this.setState({
      shelves: {
        items,
        loading: false,
        error: null,
        lastSync: new Date().toISOString()
      }
    });
  }

  setShelvesLoading(loading) {
    this.setState({
      shelves: { ...this.state.shelves, loading }
    });
  }

  setShelvesError(error) {
    this.setState({
      shelves: { ...this.state.shelves, error, loading: false }
    });
  }

  // Products actions
  setProducts(items, locations) {
    this.setState({
      products: {
        items,
        locations,
        loading: false,
        error: null,
        lastSync: new Date().toISOString()
      }
    });
  }

  setProductsLoading(loading) {
    this.setState({
      products: { ...this.state.products, loading }
    });
  }

  setProductsError(error) {
    this.setState({
      products: { ...this.state.products, error, loading: false }
    });
  }

  // Config actions
  setConfig(config) {
    this.setState({ config });
  }

  // Display actions
  setDisplaySettings(settings) {
    this.setState({
      display: { ...this.state.display, ...settings }
    });
  }
}

// Create singleton instance
export const store = new Store();