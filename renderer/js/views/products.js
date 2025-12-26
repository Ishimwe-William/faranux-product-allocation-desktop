import { searchProducts, findProductLocations } from '../googleSheets.js';
import { matchProductsBySKU } from '../woocommerce.js';
import { store } from '../store.js';
import { router } from '../router.js';

const ITEMS_PER_PAGE = 20;
let currentIndex = 0;
let filteredProducts = [];
let viewMode = 'card'; // 'card' or 'list'

export function renderProductsView() {
  const container = document.getElementById('view-container');
  const state = store.getState();

  // 1. Initial Data Preparation
  const allMatched = matchProductsBySKU(state.products.items, state.woocommerce.products || []);
  filteredProducts = allMatched;
  currentIndex = 0;

  document.getElementById('breadcrumbs').textContent = 'Products';

  container.innerHTML = `
    <div class="products-header" style="margin-bottom: var(--spacing-lg);">
      <div class="search-bar shelf-search-centered">
        <span class="material-icons">search</span>
        <input type="text" id="product-search" placeholder="Search SKU, name, or category...">
      </div>
      <div class="view-toggle" style="display: flex; gap: 4px; background: var(--color-bg-secondary); border-radius: 8px; padding: 4px;">
        <button id="card-view-btn" class="view-toggle-btn ${viewMode === 'card' ? 'active' : ''}" data-view="card">
          <span class="material-icons">grid_view</span>
        </button>
        <button id="list-view-btn" class="view-toggle-btn ${viewMode === 'list' ? 'active' : ''}" data-view="list">
          <span class="material-icons">view_list</span>
        </button>
      </div>
    </div>
    <div class="products-list ${viewMode === 'list' ? 'list-view' : ''}" id="products-list"></div>
    <div id="sentinel" style="height: 20px;"></div>
  `;

  // 2. Initial Load
  loadMoreProducts();

  // 3. Search Logic
  document.getElementById('product-search')?.addEventListener('input', handleProductSearch);

  // 4. View Toggle
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const newView = e.currentTarget.dataset.view;
      if (newView !== viewMode) {
        viewMode = newView;
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // UPDATED: Toggle the CSS class on the container to switch grid layouts
        const listContainer = document.getElementById('products-list');
        if (viewMode === 'list') {
          listContainer.classList.add('list-view');
        } else {
          listContainer.classList.remove('list-view');
        }

        // Reload products with new view
        currentIndex = 0;
        document.getElementById('products-list').innerHTML = '';
        loadMoreProducts();
      }
    });
  });

  // 5. Navigation (Event Delegation)
  document.getElementById('products-list').addEventListener('click', (e) => {
    const row = e.target.closest('.location-row');
    if (row) {
      const { shelfId, position, sku } = row.dataset;
      router.navigate(`/shelf/${shelfId}`, { highlightPosition: position, searchSku: sku });
    }
  });

  // 6. Infinite Scroll Observer
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && currentIndex < filteredProducts.length) {
      loadMoreProducts();
    }
  }, { rootMargin: '200px' });

  const sentinel = document.getElementById('sentinel');
  if (sentinel) observer.observe(sentinel);
}

function loadMoreProducts() {
  const list = document.getElementById('products-list');
  const state = store.getState();
  const nextBatch = filteredProducts.slice(currentIndex, currentIndex + ITEMS_PER_PAGE);

  if (nextBatch.length === 0 && currentIndex === 0) {
    list.innerHTML = renderEmptyState();
    return;
  }

  const html = nextBatch.map(p =>
      viewMode === 'card'
          ? renderProductCard(p, state.products.locations)
          : renderProductListItem(p, state.products.locations)
  ).join('');

  list.insertAdjacentHTML('beforeend', html);
  currentIndex += ITEMS_PER_PAGE;
}

function renderProductCard(matchedProduct, locations) {
  const { sheetProduct: product, wooProduct, sheetQuantity: sheetQty, wooQuantity: wooQty } = matchedProduct;
  const productLocations = findProductLocations(locations, product.sku);
  const qtyColor = sheetQty >= 10 ? '#10b981' : (sheetQty > 0 ? '#f59e0b' : '#ef4444');
  const diff = sheetQty - (wooQty || 0);

  const fullProductName = product.product_name || 'Unnamed Product';
  const displayProductName = fullProductName.length > 27 ? fullProductName.substring(0, 27) + '...' : fullProductName;

  // Get branch quantities
  const branchQtys = product.branchQuantities || {};
  const branchEntries = Object.entries(branchQtys);

  return `
    <div class="card product-card-compact" style="padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div style="overflow: hidden;">
          <h3 style="font-size: 17px; margin: 0 0 4px 0; color: var(--color-text); font-weight: 600;"
            title="${fullProductName}">${displayProductName}
          </h3>
          <div style="font-size: 14px; color: var(--color-text-tertiary); display: flex; align-items: center; gap: 6px;">
            <span class="product-sku-compact"><span class="material-icons" style="font-size: 14px;">qr_code</span> ${product.sku}</span>
            ${product.category ? `<span style="color: var(--color-border)">•</span> <span>${product.category}</span>` : ''}
          </div>
        </div>
        <div class="qty-badge-compact" style="background: ${qtyColor}15; color: ${qtyColor}; border: 1px solid ${qtyColor}30;">
          ${sheetQty}
        </div>
      </div>

      ${branchEntries.length > 0 ? `
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border-light); font-size: 13px;">
          ${branchEntries.map(([branch, qty]) => {
    const branchColor = qty >= 5 ? '#10b981' : (qty > 0 ? '#f59e0b' : '#ef4444');
    return `
              <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--color-bg-secondary); border-radius: 6px;">
                <span style="color: var(--color-text-secondary); font-weight: 500;">${branch}:</span>
                <span style="color: ${branchColor}; font-weight: 600;">${qty}</span>
              </div>
            `;
  }).join('')}
        </div>
      ` : ''}

      ${wooProduct ? `
        <div style="display: flex; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border-light); font-size: 14px;">
          <span style="color: var(--color-text-secondary)">Woo: <b>${wooQty}</b></span>
          <span style="color: ${diff === 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-weight: 500;">
            ${diff === 0 ? '✓ Match' : (diff > 0 ? `+${diff} in Sheet` : `${diff} in Sheet`)}
          </span>
        </div>
      ` : ''}

      <div class="locations-container-compact" style="margin-top: 12px;">
        ${productLocations.length === 0 ?
      `<div style="font-size: 14px; color: var(--color-warning); padding: 4px;">No location assigned</div>` :
      productLocations.map(loc => `
            <div class="location-row" data-shelf-id="${loc.shelfId}" data-position="${loc.position}" data-sku="${product.sku}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-icons" style="font-size: 18px;">store</span>
                <span style="font-size: 14px;"><b>${loc.shelf}</b> — ${loc.position}</span>
              </div>
              <span class="material-icons">chevron_right</span>
            </div>
          `).join('')
  }
      </div>
    </div>
  `;
}

function renderProductListItem(matchedProduct, locations) {
  const { sheetProduct: product, wooProduct, sheetQuantity: sheetQty, wooQuantity: wooQty } = matchedProduct;
  const productLocations = findProductLocations(locations, product.sku);
  const qtyColor = sheetQty >= 10 ? '#10b981' : (sheetQty > 0 ? '#f59e0b' : '#ef4444');
  const diff = sheetQty - (wooQty || 0);

  const fullProductName = product.product_name || 'Unnamed Product';

  // Get branch quantities
  const branchQtys = product.branchQuantities || {};
  const branchEntries = Object.entries(branchQtys);

  return `
    <div class="card" style="padding: 12px 16px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
            title="${fullProductName}">
            ${fullProductName}
          </div>
          <div style="font-size: 13px; color: var(--color-text-tertiary); display: flex; align-items: center; gap: 8px;">
            <span class="product-sku-compact">
              <span class="material-icons" style="font-size: 13px;">qr_code</span> ${product.sku}
            </span>
            ${product.category ? `<span style="color: var(--color-border)">•</span> <span>${product.category}</span>` : ''}
          </div>
        </div>

        ${branchEntries.length > 0 ? `
          <div style="flex: 0 0 auto; display: flex; gap: 8px; align-items: center;">
            ${branchEntries.map(([branch, qty]) => {
    const branchColor = qty >= 5 ? '#10b981' : (qty > 0 ? '#f59e0b' : '#ef4444');
    return `
                <div style="text-align: center; font-size: 12px;">
                  <div style="color: var(--color-text-secondary); margin-bottom: 2px; font-weight: 500;">${branch}</div>
                  <div style="font-weight: 600; color: ${branchColor}; font-size: 14px;">${qty}</div>
                </div>
              `;
  }).join('')}
          </div>
        ` : ''}

        <div style="flex: 0 0 auto; display: flex; align-items: center; gap: 16px;">
          <div style="text-align: center; font-size: 13px;">
            <div style="color: var(--color-text-secondary); margin-bottom: 2px; font-weight: 500;">Total</div>
            <div style="font-weight: 600; color: ${qtyColor}; font-size: 15px;">${sheetQty}</div>
          </div>

          ${wooProduct ? `
            <div style="text-align: center; font-size: 13px;">
              <div style="color: var(--color-text-secondary); margin-bottom: 2px; font-weight: 500;">Woo</div>
              <div style="font-weight: 600; color: ${diff === 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-size: 15px;">${wooQty}</div>
            </div>
          ` : ''}

          <div style="min-width: 100px; font-size: 13px;">
            ${productLocations.length === 0
      ? `<span style="color: var(--color-warning);">No location</span>`
      : productLocations.length === 1
          ? `<div class="location-row" data-shelf-id="${productLocations[0].shelfId}" data-position="${productLocations[0].position}" data-sku="${product.sku}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-secondary); border-radius: 6px;">
                     <span class="material-icons" style="font-size: 16px;">store</span>
                     <span><b>${productLocations[0].shelf}</b> — ${productLocations[0].position}</span>
                   </div>`
          : `<span style="color: var(--color-text-secondary);">${productLocations.length} locations</span>`
  }
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleProductSearch(e) {
  const query = e.target.value.toLowerCase();
  const state = store.getState();
  const allMatched = matchProductsBySKU(state.products.items, state.woocommerce.products || []);

  // Update the global filtered list
  filteredProducts = searchProducts(allMatched.map(m => m.sheetProduct), query)
      .map(p => allMatched.find(m => m.sheetProduct.sku === p.sku));

  // Reset list and pagination
  currentIndex = 0;
  document.getElementById('products-list').innerHTML = '';
  loadMoreProducts();
}

function renderEmptyState(query = '') {
  return `
    <div class="empty-state" style="padding: 40px; text-align: center;">
      <span class="material-icons" style="font-size: 48px; color: var(--color-border); margin-bottom: 12px;">search_off</span>
      <p style="color: var(--color-text-tertiary); font-size: 16px;">
        ${query ? `No matches found for "${query}"` : 'No products available.'}
      </p>
    </div>
  `;
}