import { searchProducts, findProductLocations } from '../googleSheets.js';
import { matchProductsBySKU } from '../woocommerce.js';
import { store } from '../store.js';
import { router } from '../router.js';

const ITEMS_PER_PAGE = 20;
let currentIndex = 0;
let filteredProducts = [];

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
    </div>
    <div class="products-list" id="products-list"></div>
    <div id="sentinel" style="height: 20px;"></div>
  `;

  // 2. Initial Load
  loadMoreProducts();

  // 3. Search Logic
  document.getElementById('product-search')?.addEventListener('input', handleProductSearch);

  // 4. Navigation (Event Delegation)
  document.getElementById('products-list').addEventListener('click', (e) => {
    const row = e.target.closest('.location-row');
    if (row) {
      const { shelfId, position, sku } = row.dataset;
      router.navigate(`/shelf/${shelfId}`, { highlightPosition: position, searchSku: sku });
    }
  });

  // 5. Infinite Scroll Observer
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

  const html = nextBatch.map(p => renderProductCard(p, state.products.locations)).join('');
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
        <div class="qty-badge-compact" style="background: ${qtyColor}15; color: ${qtyColor}; border: 1px; solid-${qtyColor}-30;">
          ${sheetQty}
        </div>
      </div>

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