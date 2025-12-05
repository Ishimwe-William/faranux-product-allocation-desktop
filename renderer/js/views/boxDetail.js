/* ============================================
   views/boxDetail.js - Box Detail View
   ============================================ */

import { store } from '../store.js';
import { router } from '../router.js';

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
          ${renderProductsList(boxProducts)}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderProductsList(products) {
  if (!products || products.length === 0) {
    return `<p>No products in this box.</p>`;
  }

  let out = '<div class="products-list">';
  products.forEach(p => {
    const fullName = p.product_name || 'Unnamed product';
    const pname = fullName.length > 25 ? fullName.substring(0, 25) + '...' : fullName;
    const psku = p.sku || '';
    const qty = p.quantity || '';
    out += `
      <div class="product-item" title="${escapeHtml(fullName)}">
        <div>
          <div>${escapeHtml(pname)}</div>
          <div>${psku}</div>
        </div>
        <div>${qty ? 'Qty: ' + qty : ''}</div>
      </div>
    `;
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
