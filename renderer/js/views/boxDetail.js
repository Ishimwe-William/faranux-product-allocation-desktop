import { store } from '../store.js';
import { router } from '../router.js';
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
        <h3>Products in this box</h3>
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

  let out = '<div class="products-list">';
  matchedProducts.forEach(matched => {
    const p = matched.sheetProduct;
    const wooProduct = matched.wooProduct;
    const sheetQty = matched.sheetQuantity;
    const wooQty = matched.wooQuantity;

    const fullName = p.product_name || 'Unnamed product';
    const pname = fullName.length > 25 ? fullName.substring(0, 25) + '...' : fullName;
    const psku = p.sku || '';

    let qtyColor = '#10b981';
    if (sheetQty < 5) qtyColor = '#ef4444';
    else if (sheetQty < 10) qtyColor = '#f59e0b';

    out += `
      <div class="product-item" title="${escapeHtml(fullName)}" style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div style="font-weight: 500;">${escapeHtml(pname)}</div>
            <div style="font-size: 12px; color: var(--color-text-secondary);">${psku}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${wooProduct ? '<span class="material-icons" style="color: var(--color-primary); font-size: 18px;" title="WooCommerce Connected">shopping_cart</span>' : ''}
          </div>
        </div>
    `;

    if (wooProduct) {
      const difference = sheetQty - wooQty;
      let diffColor = 'var(--color-text-secondary)';
      let diffText = 'Same';

      if (difference > 0) {
        diffColor = 'var(--color-success)';
        diffText = `+${difference} in sheet`;
      } else if (difference < 0) {
        diffColor = 'var(--color-error)';
        diffText = `${difference} in sheet`;
      }

      out += `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; background: var(--color-surface); border-radius: 6px;">
          <div>
            <div style="font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Sheet</div>
            <div style="font-size: 16px; font-weight: 600; color: ${qtyColor}">${sheetQty}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">WooCommerce</div>
            <div style="font-size: 16px; font-weight: 600;">${wooQty}</div>
          </div>
          <div style="grid-column: 1 / -1; text-align: center; padding: 4px; background: ${diffColor}15; border-radius: 4px;">
            <span style="font-size: 11px; font-weight: 500; color: ${diffColor}">${diffText}</span>
          </div>
        </div>
      `;
    } else {
      out += `
        <div style="padding: 8px; background: var(--color-surface); border-radius: 6px;">
          <div style="font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Sheet Quantity</div>
          <div style="font-size: 16px; font-weight: 600; color: ${qtyColor}">${sheetQty}</div>
        </div>
      `;
    }

    out += `</div>`;
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