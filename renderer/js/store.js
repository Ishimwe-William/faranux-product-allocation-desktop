/* ============================================
   store.js - State Management
   ============================================ */

export class Store {
  constructor() {
    this.state = {
      auth: {
        user: null,
        isAuthenticated: false,
        googleAccessToken: null
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
      woocommerce: {
        products: [],
        loading: false,
        error: null,
        lastSync: null
      },
      config: {
        sheetId: null,
        sheetUrl: null,
        lastUpdated: null,
        updatedBy: null,
        woocommerce: {
          siteUrl: null,
          consumerKey: null,
          consumerSecret: null,
          enabled: false
        }
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

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    this.state = this.deepMerge(this.state, updates);
    this.notify();
    this.saveToStorage();
  }

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

  saveToStorage() {
    const persistData = {
      display: this.state.display,
      config: {
        sheetId: this.state.config.sheetId,
        sheetUrl: this.state.config.sheetUrl
      },
      auth: {
        googleAccessToken: this.state.auth.googleAccessToken
      }
    };
    localStorage.setItem('inventoryAppState', JSON.stringify(persistData));
  }

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

  setUser(user) {
    this.setState({
      auth: {
        ...this.state.auth,
        user,
        isAuthenticated: !!user
      }
    });
  }

  setGoogleToken(token) {
    this.setState({
      auth: {
        ...this.state.auth,
        googleAccessToken: token
      }
    });
  }

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

  // WooCommerce actions
  setWooProducts(products) {
    this.setState({
      woocommerce: {
        products,
        loading: false,
        error: null,
        lastSync: new Date().toISOString()
      }
    });
  }

  setWooLoading(loading) {
    this.setState({
      woocommerce: { ...this.state.woocommerce, loading }
    });
  }

  setWooError(error) {
    this.setState({
      woocommerce: { ...this.state.woocommerce, error, loading: false }
    });
  }

  setConfig(config) {
    this.setState({ config });
  }

  setDisplaySettings(settings) {
    this.setState({
      display: { ...this.state.display, ...settings }
    });
  }
}

export const store = new Store();