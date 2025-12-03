/* ============================================
   views/shelves.js - Shelves List View
   ============================================ */

import { store } from '../store.js';
import { router } from '../router.js';

// Helper to trim text to max length with ellipsis
function trimText(text, maxLength = 25) {
  if (!text) return '';
  const str = String(text);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

export function renderShelvesView() {
  const container = document.getElementById('view-container');
  const state = store.getState();
  const shelves = state.shelves.items;
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Shelves';
  
  let html = `
    <div class="shelves-header">
      <div class="search-bar shelf-search-centered">
        <span class="material-icons">search</span>
        <input type="text" id="shelf-search" placeholder="Search shelves...">
      </div>
    </div>
  `;
  
  if (shelves.length === 0) {
    html += `
      <div class="empty-state">
        <span class="material-icons">shelves</span>
        <h3>No Shelves Found</h3>
        <p>Pull down to refresh and load data</p>
      </div>
    `;
  } else {
    html += '<div class="shelves-grid" id="shelves-grid">';
    shelves.forEach(shelf => {
      html += renderShelfCard(shelf);
    });
    html += '</div>';
  }
  
  container.innerHTML = html;
  
  // Setup search
  const searchInput = document.getElementById('shelf-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  // Setup shelf card clicks
  document.querySelectorAll('.shelf-card').forEach(card => {
    card.addEventListener('click', () => {
      const shelfId = card.dataset.shelfId;
      router.navigate(`/shelf/${shelfId}`);
    });
  });
}

function renderShelfCard(shelf) {
  const totalProducts = shelf.boxes.reduce((sum, box) => sum + box.products.length, 0);
  const filledBoxes = shelf.boxes.filter(box => box.products.length > 0).length;
  const totalSlots = shelf.maxRow * shelf.maxColumn;
  const utilization = totalSlots > 0 ? (filledBoxes / totalSlots) * 100 : 0;
  
  let statusColor = '#10b981'; // success
  if (utilization >= 90) statusColor = '#ef4444'; // error
  else if (utilization >= 50) statusColor = '#f59e0b'; // warning
  
  return `
    <div class="card card-clickable shelf-card" data-shelf-id="${shelf.id}" data-all-products="${shelf.boxes.map(b => b.products.join(',')).join(',')}">
      <div class="shelf-card-header">
        <h3 class="shelf-name" title="${shelf.name}">${trimText(shelf.name)}</h3>
        <div class="branch-badge">
          <span class="material-icons">store</span>
          <span>${shelf.branch}</span>
        </div>
        <div class="product-found-indicator" style="display:none; background-color:var(--color-primary); color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700; white-space:nowrap;"></div>
      </div>
      
      <div class="utilization-bar">
        <div class="utilization-header">
          <span class="utilization-label">Matrix Utilization</span>
          <span class="utilization-percent" style="color: ${statusColor}">
            ${Math.round(utilization)}%
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${utilization}%; background-color: ${statusColor}"></div>
        </div>
      </div>
      
      <div class="shelf-stats">
        <div class="stat-item">
          <span class="material-icons">grid_on</span>
          <span>${shelf.maxRow}×${shelf.maxColumn}</span>
        </div>
        <div class="stat-item">
          <span class="material-icons">inbox</span>
          <span><span class="stat-value">${filledBoxes}</span>/${totalSlots} Slots</span>
        </div>
        <div class="stat-item">
          <span class="material-icons">inventory_2</span>
          <span class="stat-value">${totalProducts}</span> Items
        </div>
      </div>
    </div>
  `;
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  const cards = document.querySelectorAll('.shelf-card');
  const state = store.getState();
  const products = state.products.items || [];
  
  cards.forEach(card => {
    const shelfName = card.querySelector('.shelf-name').textContent.toLowerCase();
    const branch = card.querySelector('.branch-badge span:last-child').textContent.toLowerCase();
    const indicator = card.querySelector('.product-found-indicator');
    
    if (!query) {
      // No search query - show all cards and hide indicators
      card.style.display = '';
      indicator.style.display = 'none';
      return;
    }
    
    // Search shelf name and branch
    const shelfMatch = shelfName.includes(query) || branch.includes(query);
    
    // Search products in this shelf
    const allProductSkus = card.getAttribute('data-all-products').split(',').filter(s => s);
    let productMatch = null;
    for (const sku of allProductSkus) {
      const product = products.find(p => p.sku === sku);
      if (product) {
        const pname = (product.product_name || '').toLowerCase();
        const psku = (product.sku || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        if (pname.includes(query) || psku.includes(query) || category.includes(query)) {
          productMatch = product;
          break;
        }
      }
    }
    
    // Show/hide card and display indicator if product found
    if (shelfMatch || productMatch) {
      card.style.display = '';
      if (productMatch) {
        const displayName = trimText(productMatch.product_name || productMatch.sku, 18);
        indicator.textContent = `📦 ${displayName}`;
        indicator.title = productMatch.product_name || productMatch.sku;
        indicator.style.display = 'block';
      } else {
        indicator.style.display = 'none';
      }
    } else {
      card.style.display = 'none';
      indicator.style.display = 'none';
    }
  });
}
