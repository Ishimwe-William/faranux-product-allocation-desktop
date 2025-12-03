/* ============================================
   views/boxDetail.js - Box Detail View
   ============================================ */

import { store } from '../store.js';

export function renderBoxDetailView() {
  const container = document.getElementById('view-container');
  
  // Update breadcrumbs
  document.getElementById('breadcrumbs').textContent = 'Box Detail';
  
  const html = `
    <div class="box-detail-container">
      <div class="box-detail-header">
        <h2>Box Details</h2>
        <button class="btn btn-text" onclick="history.back()">
          <span class="material-icons">arrow_back</span>
          Back
        </button>
      </div>
      <div class="box-detail-content">
        <p style="color: #a3a3a3; text-align: center; padding: 40px;">
          Select a box to view details
        </p>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}
