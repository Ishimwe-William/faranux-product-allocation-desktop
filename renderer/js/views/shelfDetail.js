/* ============================================
   views/shelfDetail.js - Shelf Detail View
   ============================================ */
import { store } from '../store.js';
import { router } from '../router.js';

export function renderShelfDetailView(params) {
  const container = document.getElementById('view-container');
  const state = store.getState();
  const shelf = state.shelves.items.find(s => s.id === params.id);
  
  if (!shelf) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">error_outline</span>
        <h3>Shelf Not Found</h3>
        <p>The requested shelf could not be found.</p>
      </div>
    `;
    return;
  }
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').innerHTML = `
    <a href="#/shelves" style="color: var(--color-text-secondary)">Shelves</a>
    <span style="margin: 0 8px; color: var(--color-text-secondary)">›</span>
    <span>${shelf.name}</span>
  `;
  
  const totalProducts = shelf.boxes.reduce((sum, box) => sum + box.products.length, 0);
  const filledBoxes = shelf.boxes.filter(box => box.products.length > 0).length;
  const totalSlots = shelf.maxRow * shelf.maxColumn;
  const utilization = totalSlots > 0 ? Math.round((filledBoxes / totalSlots) * 100) : 0;
  
  let html = `
    <div class="shelf-detail-header">
      <div class="shelf-stats-row">
        <div class="stat-box">
          <div class="stat-box-label">Items</div>
          <div class="stat-box-value">${totalProducts}</div>
        </div>
        <div class="stat-box">
          <div class="stat-box-label">Boxes</div>
          <div class="stat-box-value">${shelf.boxes.length}</div>
        </div>
        <div class="stat-box">
          <div class="stat-box-label">Utilization</div>
          <div class="stat-box-value" style="color: var(--color-primary)">${utilization}%</div>
        </div>
      </div>
    </div>
    
    <div class="grid-container">
      <div class="grid-header">
        <h3 class="grid-title">Layout</h3>
        <div class="grid-legend">
          <div class="legend-item">
            <div class="legend-dot" style="background-color: var(--color-primary)"></div>
            <span>Full</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background-color: var(--color-accent)"></div>
            <span>Partial</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background-color: var(--color-surface)"></div>
            <span>Empty</span>
          </div>
        </div>
      </div>
      
      <div class="grid-matrix">
        ${renderGrid(shelf)}
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Setup cell clicks
  document.querySelectorAll('.grid-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      const boxId = cell.dataset.boxId;
      handleBoxClick(shelf, boxId);
    });
  });
}

function renderGrid(shelf) {
  const matrix = createMatrix(shelf);
  
  let html = '<div class="grid-row">';
  html += '<div class="grid-header-cell"></div>'; // Corner cell
  
  // Column headers
  for (let col = 0; col < shelf.maxColumn; col++) {
    html += `<div class="grid-header-cell">${String.fromCharCode(65 + col)}</div>`;
  }
  html += '</div>';
  
  // Grid rows
  for (let row = 0; row < shelf.maxRow; row++) {
    html += '<div class="grid-row">';
    html += `<div class="grid-header-cell">${row + 1}</div>`;
    
    for (let col = 0; col < shelf.maxColumn; col++) {
      const box = matrix[row][col];
      html += renderGridCell(box);
    }
    
    html += '</div>';
  }
  
  return html;
}

function createMatrix(shelf) {
  const matrix = Array(shelf.maxRow).fill(null).map(() => Array(shelf.maxColumn).fill(null));
  
  shelf.boxes.forEach(box => {
    if (box.row && box.column) {
      const rowIndex = box.row - 1;
      const colIndex = box.column.charCodeAt(0) - 65;
      if (rowIndex >= 0 && rowIndex < shelf.maxRow && colIndex >= 0 && colIndex < shelf.maxColumn) {
        matrix[rowIndex][colIndex] = box;
      }
    }
  });
  
  return matrix;
}

function renderGridCell(box) {
  if (!box) {
    return '<div class="grid-cell empty"><span class="cell-label">•</span></div>';
  }
  
  const count = box.products.length;
  let className = 'grid-cell';
  if (count === 0) className += ' empty';
  else if (count <= 3) className += ' partial';
  else className += ' filled';
  
  return `
    <div class="${className}" data-box-id="${box.id}">
      <span class="cell-label">${box.position}</span>
      ${count > 0 ? `<span class="cell-count">${count}</span>` : ''}
    </div>
  `;
}

function handleBoxClick(shelf, boxId) {
  const box = shelf.boxes.find(b => b.id === boxId);
  if (!box || box.products.length === 0) return;
  
  // Navigate directly to the box view
  router.navigate(`/box/${boxId}`, { shelfId: shelf.id, shelfName: shelf.name });
}