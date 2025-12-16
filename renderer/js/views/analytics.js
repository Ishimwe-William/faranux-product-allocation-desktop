/* ============================================
   views/analytics.js - Analytics View
   ============================================ */

import { store } from '../store.js';
import { matchProductsBySKU } from '../woocommerce.js';
import { router } from '../router.js';

export function renderAnalyticsView() {
    const container = document.getElementById('view-container');
    const state = store.getState();

    document.getElementById('breadcrumbs').textContent = 'Analytics';

    const sheetProducts = state.products.items || [];
    const wooProducts = state.woocommerce.products || [];
    const wooEnabled = state.config?.woocommerce?.enabled;

    if (!wooEnabled) {
        container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">analytics</span>
        <h3>WooCommerce Not Enabled</h3>
        <p>Enable WooCommerce integration in Settings to view analytics</p>
        <button class="btn btn-primary" onclick="window.location.hash='#/settings/woocommerce'">
          Go to Settings
        </button>
      </div>
    `;
        return;
    }

    // Match products
    const matched = matchProductsBySKU(sheetProducts, wooProducts);

    // Analyze data
    const inSheetNotWoo = matched.filter(m => !m.matched);
    const inWooNotSheet = wooProducts.filter(wp => {
        const sku = wp.sku?.trim();
        return sku && !sheetProducts.find(sp => sp.sku?.trim() === sku);
    });
    const qtyMismatches = matched.filter(m => m.matched && m.sheetQuantity !== m.wooQuantity);
    const perfectMatches = matched.filter(m => m.matched && m.sheetQuantity === m.wooQuantity);

    const html = `
    <div class="analytics-container">
      
      <!-- Summary Cards -->
      <div class="analytics-summary">
        <div class="card analytics-stat-card">
          <div class="stat-icon" style="background: var(--color-success)15;">
            <span class="material-icons" style="color: var(--color-success)">check_circle</span>
          </div>
          <div class="stat-content">
            <div class="stat-value">${perfectMatches.length}</div>
            <div class="stat-label">Perfect Matches</div>
          </div>
        </div>

        <div class="card analytics-stat-card">
          <div class="stat-icon" style="background: var(--color-warning)15;">
            <span class="material-icons" style="color: var(--color-warning)">sync_problem</span>
          </div>
          <div class="stat-content">
            <div class="stat-value">${qtyMismatches.length}</div>
            <div class="stat-label">Quantity Mismatches</div>
          </div>
        </div>

        <div class="card analytics-stat-card">
          <div class="stat-icon" style="background: var(--color-error)15;">
            <span class="material-icons" style="color: var(--color-error)">remove_shopping_cart</span>
          </div>
          <div class="stat-content">
            <div class="stat-value">${inSheetNotWoo.length}</div>
            <div class="stat-label">In Sheet Only</div>
          </div>
        </div>

        <div class="card analytics-stat-card">
          <div class="stat-icon" style="background: var(--color-accent)15;">
            <span class="material-icons" style="color: var(--color-accent)">inventory_2</span>
          </div>
          <div class="stat-content">
            <div class="stat-value">${inWooNotSheet.length}</div>
            <div class="stat-label">In WooCommerce Only</div>
          </div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="analytics-tabs">
        <button class="tab-btn active" data-tab="mismatches">
          <span class="material-icons">sync_problem</span>
          Quantity Mismatches (${qtyMismatches.length})
        </button>
        <button class="tab-btn" data-tab="sheet-only">
          <span class="material-icons">remove_shopping_cart</span>
          Sheet Only (${inSheetNotWoo.length})
        </button>
        <button class="tab-btn" data-tab="woo-only">
          <span class="material-icons">shopping_cart</span>
          WooCommerce Only (${inWooNotSheet.length})
        </button>
      </div>

      <!-- Data Tables -->
      <div class="analytics-content">
        <div class="tab-content active" id="tab-mismatches">
          ${renderMismatchesTable(qtyMismatches)}
        </div>
        <div class="tab-content" id="tab-sheet-only">
          ${renderSheetOnlyTable(inSheetNotWoo)}
        </div>
        <div class="tab-content" id="tab-woo-only">
          ${renderWooOnlyTable(inWooNotSheet)}
        </div>
      </div>

    </div>
  `;

    container.innerHTML = html;

    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
        });
    });
}

function renderMismatchesTable(mismatches) {
    if (mismatches.length === 0) {
        return `
      <div class="empty-state">
        <span class="material-icons">check_circle</span>
        <h3>No Mismatches</h3>
        <p>All matching products have synchronized quantities</p>
      </div>
    `;
    }

    let html = `
    <div class="card">
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Sheet Qty</th>
              <th>WooCommerce Qty</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
  `;

    mismatches.forEach(m => {
        const diff = m.sheetQuantity - m.wooQuantity;
        const diffColor = diff > 0 ? 'var(--color-success)' : 'var(--color-error)';
        const diffIcon = diff > 0 ? 'arrow_upward' : 'arrow_downward';

        html += `
      <tr>
        <td><code class="sku-code">${m.sku}</code></td>
        <td class="product-name-cell">${m.sheetProduct.product_name || 'Unnamed'}</td>
        <td><strong>${m.sheetQuantity}</strong></td>
        <td>${m.wooQuantity}</td>
        <td>
          <span style="display: flex; align-items: center; gap: 4px; color: ${diffColor}; font-weight: 600;">
            <span class="material-icons" style="font-size: 16px;">${diffIcon}</span>
            ${Math.abs(diff)}
          </span>
        </td>
      </tr>
    `;
    });

    html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

    return html;
}

function renderSheetOnlyTable(products) {
    if (products.length === 0) {
        return `
      <div class="empty-state">
        <span class="material-icons">check_circle</span>
        <h3>All Synced</h3>
        <p>All sheet products exist in WooCommerce</p>
      </div>
    `;
    }

    let html = `
    <div class="card">
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Sheet Qty</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
  `;

    products.forEach(m => {
        const p = m.sheetProduct;
        html += `
      <tr>
        <td><code class="sku-code">${p.sku}</code></td>
        <td class="product-name-cell">${p.product_name || 'Unnamed'}</td>
        <td><strong>${m.sheetQuantity}</strong></td>
        <td>${p.category || '-'}</td>
      </tr>
    `;
    });

    html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

    return html;
}

function renderWooOnlyTable(products) {
    if (products.length === 0) {
        return `
      <div class="empty-state">
        <span class="material-icons">check_circle</span>
        <h3>All Synced</h3>
        <p>All WooCommerce products exist in sheet</p>
      </div>
    `;
    }

    let html = `
    <div class="card">
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>WooCommerce Qty</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
  `;

    products.forEach(p => {
        html += `
      <tr>
        <td><code class="sku-code">${p.sku || '-'}</code></td>
        <td class="product-name-cell">${p.name || 'Unnamed'}</td>
        <td><strong>${p.stock_quantity || 0}</strong></td>
        <td>${p.price ? `$${p.price}` : '-'}</td>
      </tr>
    `;
    });

    html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

    return html;
}