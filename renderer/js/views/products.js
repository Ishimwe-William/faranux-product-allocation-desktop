/* =========================================
   views/products.js - Products Search View
   ========================================= */
import { searchProducts, findProductLocations } from '../googleSheets.js';
import { matchProductsBySKU } from '../woocommerce.js';
import { store } from '../store.js';
import { router } from '../router.js';

export function renderProductsView() {
  const container = document.getElementById('view-container');
  const state = store.getState();
  const products = state.products.items;
  const wooProducts = state.woocommerce.products || [];

  // Match products
  const matchedProducts = matchProductsBySKU(products, wooProducts);

  document.getElementById('breadcrumbs').textContent = 'Products';

  let html = `
    <div class="products-header" style="display:flex; align-items:center; justify-content:center; margin-bottom:var(--spacing-lg);">
      <div class="search-bar shelf-search-centered">
        <span class="material-icons">search</span>
        <input type="text" id="product-search" placeholder="Search products...">
      </div>
    </div>
    
    <div class="products-list" id="products-list">
  `;

  if (matchedProducts.length === 0) {
    html += `
      <div class="empty-state">
        <span class="material-icons">inventory_2</span>
        <h3>No Products</h3>
        <p>No products have been loaded yet.</p>
      </div>
    `;
  } else {
    matchedProducts.forEach(product => {
      html += renderProductCard(product, state.products.locations);
    });
  }

  html += '</div>';
  container.innerHTML = html;

  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleProductSearch);
  }

  document.querySelectorAll('.location-row').forEach(row => {
    row.addEventListener('click', () => {
      const shelfId = row.dataset.shelfId;
      const position = row.dataset.position;
      const sku = row.dataset.sku;
      router.navigate(`/shelf/${shelfId}`, { highlightPosition: position, searchSku: sku });
    });
  });
}

function renderProductCard(matchedProduct, locations) {
  const product = matchedProduct.sheetProduct;
  const wooProduct = matchedProduct.wooProduct;
  const sheetQty = matchedProduct.sheetQuantity;
  const wooQty = matchedProduct.wooQuantity;

  let qtyIcon = 'alert_circle';
  let qtyColor = '#ef4444';

  if (sheetQty >= 10) {
    qtyIcon = 'check_circle';
    qtyColor = '#10b981';
  } else if (sheetQty > 0) {
    qtyIcon = 'warning';
    qtyColor = '#f59e0b';
  }

  const fullProductName = product.product_name || 'Unnamed Product';
  const displayProductName = fullProductName.length > 25 ? fullProductName.substring(0, 25) + '...' : fullProductName;

  const productLocations = findProductLocations(locations, product.sku);

  let html = `
    <div class="card product-card">
      <div class="product-header">
        <h3 class="product-name" title="${fullProductName}">${displayProductName}</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${wooProduct ? '<span class="material-icons" style="color: var(--color-primary); font-size: 20px;" title="WooCommerce Connected">shopping_cart</span>' : ''}
          <div class="qty-badge">
            <span class="material-icons" style="color: ${qtyColor}">${qtyIcon}</span>
            <span class="qty-text" style="color: ${qtyColor}">${sheetQty}</span>
          </div>
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

  html += '</div>';

  // Quantity comparison section
  if (wooProduct) {
    const difference = sheetQty - wooQty;
    let diffColor = 'var(--color-text-secondary)';
    let diffIcon = 'remove';

    if (difference > 0) {
      diffColor = 'var(--color-success)';
      diffIcon = 'add';
    } else if (difference < 0) {
      diffColor = 'var(--color-error)';
      diffIcon = 'remove';
    }

    html += `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; background: var(--color-surface); border-radius: 8px; margin-top: 12px;">
        <div>
          <div style="font-size: 11px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Sheet Inventory</div>
          <div style="font-size: 18px; font-weight: 600; color: ${qtyColor}">${sheetQty}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">WooCommerce</div>
          <div style="font-size: 18px; font-weight: 600; color: var(--color-text)">${wooQty}</div>
        </div>
        ${difference !== 0 ? `
          <div style="grid-column: 1 / -1; padding: 8px; background: ${diffColor}15; border-radius: 6px; display: flex; align-items: center; gap: 6px; justify-content: center;">
            <span class="material-icons" style="font-size: 16px; color: ${diffColor}">${diffIcon}</span>
            <span style="font-size: 13px; font-weight: 500; color: ${diffColor}">
              ${Math.abs(difference)} ${difference > 0 ? 'more in sheet' : 'less in sheet'}
            </span>
          </div>
        ` : `
          <div style="grid-column: 1 / -1; padding: 8px; background: var(--color-success)15; border-radius: 6px; display: flex; align-items: center; gap: 6px; justify-content: center;">
            <span class="material-icons" style="font-size: 16px; color: var(--color-success)">check_circle</span>
            <span style="font-size: 13px; font-weight: 500; color: var(--color-success)">Quantities match</span>
          </div>
        `}
      </div>
    `;
  }

  html += '<div class="locations-list">';

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
        <div class="location-row" data-shelf-id="${loc.shelfId}" data-position="${loc.position}" data-sku="${product.sku}">
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
  const wooProducts = state.woocommerce.products || [];
  const matchedProducts = matchProductsBySKU(filtered, wooProducts);

  const list = document.getElementById('products-list');
  if (matchedProducts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">search_off</span>
        <h3>No Matches</h3>
        <p>No products found for "${query}"</p>
      </div>
    `;
  } else {
    list.innerHTML = matchedProducts.map(p => renderProductCard(p, state.products.locations)).join('');

    document.querySelectorAll('.location-row').forEach(row => {
      row.addEventListener('click', () => {
        const shelfId = row.dataset.shelfId;
        const position = row.dataset.position;
        router.navigate(`/shelf/${shelfId}`, { highlightPosition: position });
      });
    });
  }
}