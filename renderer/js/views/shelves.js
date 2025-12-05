/* ============================================
   views/shelves.js - Modern Shelves View
   ============================================ */

import { store } from '../store.js';
import { router } from '../router.js';

function trimText(text, maxLength = 25) {
  if (!text) return '';
  const str = String(text);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

export function renderShelvesView() {
  const container = document.getElementById('view-container');
  const state = store.getState();
  const shelves = state.shelves.items;

  document.getElementById('breadcrumbs').textContent = 'Shelves';

  let html = `
    <div class="shelves-header">
      <div class="search-bar">
        <span class="material-icons">search</span>
        <input type="text" id="shelf-search" placeholder="Search shelves, branches, or products...">
      </div>
    </div>
  `;

  if (shelves.length === 0) {
    html += `
      <div class="empty-state">
        <span class="material-icons">shelves</span>
        <h3>No Shelves Found</h3>
        <p>Sync your data to load shelves</p>
      </div>
    `;
  } else {
    html += '<div class="shelves-grid" id="shelves-grid">';
    shelves.forEach((shelf, index) => {
      html += renderShelfCard(shelf, index);
    });
    html += '</div>';
  }

  container.innerHTML = html;

  // Stagger animation for cards
  requestAnimationFrame(() => {
    document.querySelectorAll('.shelf-card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, i * 50);
    });
  });

  const searchInput = document.getElementById('shelf-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleSearch(e), 200);
    });
  }

  document.querySelectorAll('.shelf-card').forEach(card => {
    card.addEventListener('click', () => {
      const shelfId = card.dataset.shelfId;
      router.navigate(`/shelf/${shelfId}`);
    });
  });
}

function renderShelfCard(shelf, index) {
  const totalProducts = shelf.boxes.reduce((sum, box) => sum + box.products.length, 0);
  const filledBoxes = shelf.boxes.filter(box => box.products.length > 0).length;
  const totalSlots = shelf.maxRow * shelf.maxColumn;
  const utilization = totalSlots > 0 ? (filledBoxes / totalSlots) * 100 : 0;

  let statusColor = '#10b981';
  if (utilization >= 90) statusColor = '#ef4444';
  else if (utilization >= 70) statusColor = '#f59e0b';

  return `
    <div class="card card-clickable shelf-card" data-shelf-id="${shelf.id}" data-all-products="${shelf.boxes.map(b => b.products.join(',')).join(',')}" style="animation-delay: ${index * 50}ms">
      <div class="shelf-card-header">
        <h3 class="shelf-name" title="${shelf.name}">${trimText(shelf.name)}</h3>
        <div class="branch-badge">
          <span class="material-icons">store</span>
          <span>${shelf.branch}</span>
        </div>
        <div class="product-found-indicator"></div>
      </div>
      
      <div class="utilization-bar">
        <div class="utilization-header">
          <span class="utilization-label">Capacity</span>
          <span class="utilization-percent" style="color: ${statusColor}">
            ${Math.round(utilization)}%
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${utilization}%; background: ${statusColor}"></div>
        </div>
      </div>
      
      <div class="shelf-stats">
        <div class="stat-item">
          <span class="material-icons">grid_on</span>
          <span>${shelf.maxRow}×${shelf.maxColumn}</span>
        </div>
        <div class="stat-item">
          <span class="material-icons">inbox</span>
          <span><span class="stat-value">${filledBoxes}</span>/${totalSlots}</span>
        </div>
        <div class="stat-item">
          <span class="material-icons">inventory_2</span>
          <span class="stat-value">${totalProducts}</span>
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

  let visibleCount = 0;

  cards.forEach(card => {
    const shelfName = card.querySelector('.shelf-name').textContent.toLowerCase();
    const branch = card.querySelector('.branch-badge span:last-child').textContent.toLowerCase();
    const indicator = card.querySelector('.product-found-indicator');

    if (!query) {
      card.style.display = '';
      indicator.style.display = 'none';
      visibleCount++;
      return;
    }

    const shelfMatch = shelfName.includes(query) || branch.includes(query);

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

    if (shelfMatch || productMatch) {
      card.style.display = '';
      visibleCount++;
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

  if (visibleCount === 0 && query) {
    const grid = document.getElementById('shelves-grid');
    if (grid && grid.children.length > 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <span class="material-icons">search_off</span>
          <h3>No Results</h3>
          <p>No shelves found for "${query}"</p>
        </div>
      `;
    }
  }
}