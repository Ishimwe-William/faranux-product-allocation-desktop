/* ============================================
   router.js - Client-Side Routing
   ============================================ */

export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.params = {};

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Handle initial route
    setTimeout(() => this.handleRoute(), 0);
  }

  // Register a route
  register(path, handler) {
    this.routes[path] = handler;
  }

  // Navigate to a route
  navigate(path, params = {}) {
    this.params = params;
    window.location.hash = path;
  }

  // Handle route change
  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/shelves';

    // Handle empty or root path - default to /shelves
    if (!hash || hash === '' || hash === '/') {
      if (this.currentRoute !== '/shelves') {
        window.location.hash = '#/shelves';
      }
      return;
    }

    // 1. Remove query params
    const pathWithoutQuery = hash.split('?')[0];

    // 2. Split by slash and filter out empty strings (handles leading slash issues)
    const parts = pathWithoutQuery.split('/').filter(p => p !== '');

    // 3. Build candidate paths: fullPath first, then fallback to first-segment
    const fullPath = '/' + parts.join('/');
    const routeName = parts[0] || 'shelves';
    const cleanPath = '/' + routeName;

    // 4. If there is a second part, treat it as the ID (e.g., '123' from '/shelf/123')
    if (parts.length > 1) {
      // Merge with existing params so we don't lose data passed via navigate()
      this.params = { ...this.params, id: parts[1] };
    }

    // Prefer exact full-path handlers (supports nested routes like '/settings/display')
    const handler = this.routes[fullPath] || this.routes[cleanPath];
    const resolvedRoute = this.routes[fullPath] ? fullPath : cleanPath;

    if (handler) {
      this.currentRoute = resolvedRoute;
      await handler(this.params);
      this.updateNavigation();
    } else if (cleanPath !== '/shelves') {
      console.warn('Route not found:', fullPath, '- redirecting to /shelves');
      window.location.hash = '#/shelves';
    }
  }

  // Update active navigation item
  updateNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const route = item.getAttribute('data-route');
      // Fix: Check if the current route contains the data-route attribute value
      // This ensures '/shelf/123' highlights 'shelves' if data-route is 'shelves'
      if (this.currentRoute && this.currentRoute.includes(route)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Get current route
  getCurrentRoute() {
    return this.currentRoute;
  }

  // Get route parameters
  getParams() {
    return this.params;
  }
}

// Create singleton instance
export const router = new Router();