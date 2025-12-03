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

  // Update breadcrumbs with clickable shelf link
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  breadcrumbsEl.innerHTML = `
    <a href="#/shelf/${found.shelf.id}" style="color: var(--color-text-secondary); text-decoration: none; cursor: pointer;">
      <span style="color: var(--color-text-secondary);">${found.shelf.name}</span>
    </a>
    <span style="margin: 0 8px; color: var(--color-text-secondary)">›</span>
    <span>${found.box.position}</span>
  `;

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

  // Resolve SKUs to full product objects
  const boxProducts = (box.products || []).map(sku => {
    return products.find(p => p.sku === sku) || { sku, product_name: 'Product not found' };
  });

  const html = `
    <div class="box-detail-container">
      <div class="box-detail-header" style="display:flex; justify-content:flex-start; align-items:center; gap:12px; margin-bottom:var(--spacing-lg);">
        <button class="btn btn-text" onclick="history.back()" style="margin-right:auto;">
          <span class="material-icons">arrow_back</span>
          Back
        </button>
        <div>
          <h2 style="margin-bottom:4px;">Box ${box.position}</h2>
          <div style="font-size:13px; color:var(--color-text-secondary)">Shelf: ${shelf.name} • Branch: ${shelf.branch}</div>
        </div>
      </div>

      <div class="box-detail-content" style="margin-top:var(--spacing-md)">
        <h3 style="margin-bottom:8px;">Products in this box</h3>
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
    return `<p style="color:var(--color-text-secondary); padding:20px; text-align:center;">No products in this box.</p>`;
  }

  let out = '<div class="products-list" style="display:flex; flex-direction:column; gap:10px;">';
  products.forEach(p => {
    const fullName = p.product_name || 'Unnamed product';
    const pname = fullName.length > 25 ? fullName.substring(0, 25) + '...' : fullName;
    const psku = p.sku || '';
    const qty = p.quantity || '';
    out += `
      <div class="product-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--color-surface); border-radius:6px; border:1px solid var(--color-border);" title="${escapeHtml(fullName)}">
        <div>
          <div style="font-weight:700">${escapeHtml(pname)}</div>
          <div style="font-size:12px; color:var(--color-text-secondary)">${psku}</div>
        </div>
        <div style="font-size:12px; color:var(--color-text-secondary)">${qty ? 'Qty: ' + qty : ''}</div>
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
