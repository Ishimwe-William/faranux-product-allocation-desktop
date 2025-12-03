/* ============================================
   views/shelves.js - Shelves List View
   ============================================ */

import { store } from '../store.js';
import { router } from '../router.js';

export function renderShelvesView() {
  const container = document.getElementById('view-container');
  const state = store.getState();
  const shelves = state.shelves.items;
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Shelves';
  
  let html = `
    <div class="shelves-header">
      <div class="search-bar">
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
    <div class="card card-clickable shelf-card" data-shelf-id="${shelf.id}">
      <div class="shelf-card-header">
        <h3 class="shelf-name">${shelf.name}</h3>
        <div class="branch-badge">
          <span class="material-icons">store</span>
          <span>${shelf.branch}</span>
        </div>
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
  const query = e.target.value.toLowerCase();
  const cards = document.querySelectorAll('.shelf-card');
  
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (text.includes(query)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}
