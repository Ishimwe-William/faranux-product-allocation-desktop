/* ============================================
   views/products.js - Products Search View
   ============================================ */
import { searchProducts, findProductLocations } from '../googleSheets.js';
import { store } from '../store.js';
import { router } from '../router.js';

export function renderProductsView() {
  const container = document.getElementById('view-container');
  const state = store.getState();
  const products = state.products.items;
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Products';
  
  let html = `
    <div class="products-header">
      <div class="search-bar">
        <span class="material-icons">search</span>
        <input type="text" id="product-search" placeholder="Search SKU, name...">
      </div>
    </div>
    
    <div class="products-list" id="products-list">
  `;
  
  if (products.length === 0) {
    html += `
      <div class="empty-state">
        <span class="material-icons">inventory_2</span>
        <h3>No Products</h3>
        <p>No products have been loaded yet.</p>
      </div>
    `;
  } else {
    products.forEach(product => {
      html += renderProductCard(product, state.products.locations);
    });
  }
  
  html += '</div>';
  container.innerHTML = html;
  
  // Setup search
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleProductSearch);
  }
  
  // Setup location clicks
  document.querySelectorAll('.location-row').forEach(row => {
    row.addEventListener('click', () => {
      const shelfId = row.dataset.shelfId;
      const position = row.dataset.position;
      router.navigate(`/shelf/${shelfId}`, { highlightPosition: position });
    });
  });
}

function renderProductCard(product, locations) {
  const qty = parseInt(product.quantity) || 0;
  let qtyIcon = 'alert_circle';
  let qtyColor = '#ef4444';
  
  if (qty >= 10) {
    qtyIcon = 'check_circle';
    qtyColor = '#10b981';
  } else if (qty > 0) {
    qtyIcon = 'warning';
    qtyColor = '#f59e0b';
  }
  
  const productLocations = findProductLocations(locations, product.sku);
  
  let html = `
    <div class="card product-card">
      <div class="product-header">
        <h3 class="product-name">${product.product_name || 'Unnamed Product'}</h3>
        <div class="qty-badge">
          <span class="material-icons" style="color: ${qtyColor}">${qtyIcon}</span>
          <span class="qty-text" style="color: ${qtyColor}">${qty}</span>
        </div>
      </div>
      
      <div class="product-meta">
        <div class="meta-item">
          <span class="material-icons">qr_code</span>
          <span class="sku-text">${product.sku}</span>
        </div>
  `;
  
  if (product.category) {
    html += `
        <span style="color: var(--color-border)">•</span>
        <div class="meta-item">
          <span class="material-icons">label</span>
          <span>${product.category}</span>
        </div>
    `;
  }
  
  html += '</div><div class="locations-list">';
  
  if (productLocations.length === 0) {
    html += `
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px; color: var(--color-warning)">
        <span class="material-icons">location_off</span>
        <span style="font-size: 13px">No location assigned</span>
      </div>
    `;
  } else {
    productLocations.forEach(loc => {
      html += `
        <div class="location-row" data-shelf-id="${loc.shelfId}" data-position="${loc.position}">
          <div class="location-details">
            <span class="material-icons location-icon">store</span>
            <span class="location-branch">${loc.branch}</span>
            <span class="material-icons" style="font-size: 16px; color: var(--color-border)">chevron_right</span>
            <span class="location-shelf">${loc.shelf}</span>
            <span class="position-badge">${loc.position}</span>
          </div>
          <span class="material-icons" style="color: var(--color-primary)">arrow_forward</span>
        </div>
      `;
    });
  }
  
  html += '</div></div>';
  return html;
}

function handleProductSearch(e) {
  const query = e.target.value;
  const state = store.getState();
  const filtered = searchProducts(state.products.items, query);
  
  const list = document.getElementById('products-list');
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">search_off</span>
        <h3>No Matches</h3>
        <p>No products found for "${query}"</p>
      </div>
    `;
  } else {
    list.innerHTML = filtered.map(p => renderProductCard(p, state.products.locations)).join('');
    
    // Re-setup location clicks
    document.querySelectorAll('.location-row').forEach(row => {
      row.addEventListener('click', () => {
        const shelfId = row.dataset.shelfId;
        const position = row.dataset.position;
        router.navigate(`/shelf/${shelfId}`, { highlightPosition: position });
      });
    });
  }
}