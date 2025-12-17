import { store } from '../store.js';
import { matchProductsBySKU } from '../woocommerce.js';

export function renderBoxDetailView(params = {}) {
  const container = document.getElementById('view-container');

  const boxId = params.id || params.boxId || (window && window.location && window.location.hash.split('/')[2]);

  // Find the box across all shelves
  const state = store.getState();
  let found = null;
  for (const shelf of state.shelves.items) {
    const box = shelf.boxes.find(b => b.id === boxId);
    if (box) { found = { shelf, box }; break; }
  }

  if (!found) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">error_outline</span>
        <h3>Box Not Found</h3>
        <p>The requested box could not be found.</p>
      </div>
    `;
    return;
  }

  const box = found.box;
  const shelf = found.shelf;
  const products = state.products.items || [];
  const wooProducts = state.woocommerce.products || [];

  // Update breadcrumbs with clickable shelf link
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  breadcrumbsEl.innerHTML = `
    <a href="#/shelf/${shelf.id}" style="color: var(--color-text-secondary); text-decoration: none; cursor: pointer;">
      <span style="color: var(--color-text-secondary);">${shelf.name}</span>
    </a>
    <span style="margin: 0 8px; color: var(--color-text-secondary)">›</span>
    <span>${box.position}</span>
  `;

  // Resolve SKUs to full product objects
  const boxProducts = (box.products || []).map(sku => {
    return products.find(p => p.sku === sku) || { sku, product_name: 'Product not found' };
  });

  // Match with WooCommerce
  const matchedProducts = matchProductsBySKU(boxProducts, wooProducts);

  const html = `
    <div class="box-detail-container">
      <div class="box-detail-header">
        <button class="btn btn-text" onclick="history.back()">
          <span class="material-icons">arrow_back</span>
          Back
        </button>
        <div>
          <h2>Box ${box.position}</h2>
          <div style="font-size:13px; color:var(--color-text-secondary)">Shelf: ${shelf.name} • Branch: ${shelf.branch}</div>
        </div>
      </div>

      <div class="box-detail-content">
        <h3>Products in this box (${matchedProducts.length})</h3>
        <div id="box-products-list">
          ${renderProductsList(matchedProducts)}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderProductsList(matchedProducts) {
  if (!matchedProducts || matchedProducts.length === 0) {
    return `<p>No products in this box.</p>`;
  }

  let out = '<div class="box-products-grid">';
  matchedProducts.forEach(matched => {
    const p = matched.sheetProduct;
    const wooProduct = matched.wooProduct;
    const sheetQty = matched.sheetQuantity;
    const wooQty = matched.wooQuantity;

    const fullName = p.product_name || 'Unnamed product';
    const pname = fullName.length > 40 ? fullName.substring(0, 40) + '...' : fullName;
    const psku = p.sku || '';

    // Get product image from WooCommerce
    const productImage = wooProduct?.images?.[0]?.src || null;

    let qtyColor = '#10b981';
    if (sheetQty < 5) qtyColor = '#ef4444';
    else if (sheetQty < 10) qtyColor = '#f59e0b';

    out += `
      <div class="box-product-card" title="${escapeHtml(fullName)}">
        ${productImage ? `
          <div class="box-product-image">
            <img src="${productImage}" alt="${escapeHtml(fullName)}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>
        ` : ''}
        
        <div class="box-product-content">
          <div class="box-product-header">
            <div>
              <div class="box-product-name">${escapeHtml(pname)}</div>
              <div class="box-product-sku">${psku}</div>
            </div>
            ${wooProduct ? '<span class="material-icons woo-badge" title="WooCommerce Connected">shopping_cart</span>' : ''}
          </div>
    `;

    if (wooProduct) {
      const difference = sheetQty - wooQty;
      let diffColor = 'var(--color-text-secondary)';
      let diffIcon = 'remove';
      let diffText = 'Same';

      if (difference > 0) {
        diffColor = 'var(--color-success)';
        diffIcon = 'arrow_upward';
        diffText = `+${difference}`;
      } else if (difference < 0) {
        diffColor = 'var(--color-error)';
        diffIcon = 'arrow_downward';
        diffText = `${difference}`;
      }

      out += `
        <div class="box-qty-grid">
          <div class="box-qty-item">
            <div class="box-qty-label">Sheet</div>
            <div class="box-qty-value" style="color: ${qtyColor}">${sheetQty}</div>
          </div>
          <div class="box-qty-divider">
            ${difference !== 0 ? `
              <span class="material-icons" style="font-size: 14px; color: ${diffColor}">${diffIcon}</span>
              <span style="font-size: 11px; font-weight: 600; color: ${diffColor}">${diffText}</span>
            ` : `
              <span class="material-icons" style="font-size: 14px; color: var(--color-success)">check</span>
            `}
          </div>
          <div class="box-qty-item">
            <div class="box-qty-label">Woo</div>
            <div class="box-qty-value">${wooQty}</div>
          </div>
        </div>
      `;
    } else {
      out += `
        <div class="box-qty-single">
          <div class="box-qty-label">Sheet Quantity</div>
          <div class="box-qty-value" style="color: ${qtyColor}">${sheetQty}</div>
        </div>
      `;
    }

    out += `</div></div>`;
  });
  out += '</div>';
  return out;
}

function escapeHtml(str) {
  return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}