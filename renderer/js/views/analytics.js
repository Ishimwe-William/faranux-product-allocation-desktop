/* ============================================
   views/analytics.js - Analytics View (Optimized)
   ============================================ */

import {store} from '../store.js';
import {matchProductsBySKU} from '../woocommerce.js';

// --- MODULE STATE ---
// We move cache outside the render function so it survives navigation
let analyticsCache = {
    data: null,
    sheetCount: 0,
    wooCount: 0,
    timestamp: 0
};

let viewState = {
    activeTab: 'mismatches',
    searchQuery: '',
    currentPage: 1,
    itemsPerPage: 50,
    sort: {
        mismatches: {column: 'difference', direction: 'desc'},
        'sheet-only': {column: 'sku', direction: 'asc'},
        'woo-only': {column: 'sku', direction: 'asc'}
    }
};

const STYLES = {
    cyan: '#7ad181',
    red: '#ff5c5c',
    text: 'var(--color-text)',
    muted: 'var(--color-text-tertiary)'
};

// --- HELPERS (Formatting) ---

function formatCurrency(amount, showSign = false) {
    const num = parseFloat(amount);
    if (isNaN(num)) return 'RWF 0';
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : (showSign && num > 0 ? '+' : '');
    const formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${sign}RWF ${formatted}`;
}

function formatQuantity(quantity, showSign = false) {
    const num = parseFloat(quantity);
    if (isNaN(num)) return '0';
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : (showSign && num > 0 ? '+' : '');

    let formatted;
    if (absNum > 1000000000000) {
        formatted = new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short", maximumFractionDigits: 2 }).format(absNum);
    } else {
        formatted = absNum.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return `${sign}${formatted}`;
}

function getNumberColor(value, isPositiveGood = true) {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return STYLES.muted;
    if (isPositiveGood) return num > 0 ? STYLES.cyan : STYLES.red;
    return num > 0 ? STYLES.red : STYLES.cyan;
}

function formatNumberWithIndicator(value, options = {}) {
    const { showSign = false, isPositiveGood = true, isCurrency = false, showIcon = true } = options;
    const num = parseFloat(value);
    if (isNaN(num)) return { formatted: isCurrency ? 'RWF 0' : '0', color: STYLES.muted, icon: '', value: 0 };

    const formatted = isCurrency ? formatCurrency(num, showSign) : formatQuantity(num, showSign);
    const color = getNumberColor(num, isPositiveGood);
    const icon = (showIcon && num !== 0) ? (num > 0 ? 'arrow_upward' : 'arrow_downward') : '';

    return { formatted, color, icon, value: num };
}

// --- CORE LOGIC ---

// 1. Data Processing with Caching
function getAnalyticsData(sheetProducts, wooProducts) {
    if (analyticsCache.data &&
        analyticsCache.sheetCount === sheetProducts.length &&
        analyticsCache.wooCount === wooProducts.length) {
        console.log('Using cached analytics data');
        return analyticsCache.data;
    }

    console.log('Recalculating analytics data...');
    const matched = matchProductsBySKU(sheetProducts, wooProducts);

    const data = {
        qtyMismatches: matched.filter(m => m.matched && m.sheetQuantity !== m.wooQuantity),
        perfectMatches: matched.filter(m => m.matched && m.sheetQuantity === m.wooQuantity),
        inSheetNotWoo: matched.filter(m => !m.matched),
        inWooNotSheet: wooProducts.filter(wp => {
            const sku = wp.sku?.trim();
            return sku && !sheetProducts.find(sp => sp.sku?.trim() === sku);
        })
    };

    analyticsCache = {
        data,
        sheetCount: sheetProducts.length,
        wooCount: wooProducts.length,
        timestamp: Date.now()
    };

    return data;
}

function sortData(data, tab) {
    const {column, direction} = viewState.sort[tab];
    const modifier = direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
        let valA, valB;
        if (tab === 'mismatches') {
            if (column === 'sku') { valA = a.sku; valB = b.sku; }
            else if (column === 'name') { valA = a.sheetProduct.product_name; valB = b.sheetProduct.product_name; }
            else if (column === 'difference') { valA = Math.abs(a.sheetQuantity - a.wooQuantity); valB = Math.abs(b.sheetQuantity - b.wooQuantity); }
            else { valA = a[column === 'sheetQty' ? 'sheetQuantity' : 'wooQuantity']; valB = b[column === 'sheetQty' ? 'sheetQuantity' : 'wooQuantity']; }
        } else if (tab === 'sheet-only') {
            if (column === 'sku') { valA = a.sheetProduct.sku; valB = b.sheetProduct.sku; }
            else if (column === 'name') { valA = a.sheetProduct.product_name; valB = b.sheetProduct.product_name; }
            else if (column === 'qty') { valA = a.sheetQuantity; valB = b.sheetQuantity; }
            else { valA = a.sheetProduct.category; valB = b.sheetProduct.category; }
        } else {
            if (column === 'sku') { valA = a.sku; valB = b.sku; }
            else if (column === 'name') { valA = a.name; valB = b.name; }
            else if (column === 'price') { valA = parseFloat(a.price || 0); valB = parseFloat(b.price || 0); }
            else { valA = a.stock_quantity; valB = b.stock_quantity; }
        }

        // Handle null/undefined gracefully
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * modifier;
        return (valA - valB) * modifier;
    });
}

function filterData(data, tab, query) {
    if (!query) return data;
    const lowerQ = query.toLowerCase();
    return data.filter(item => {
        let text = '';
        if (tab === 'mismatches') text = `${item.sku} ${item.sheetProduct.product_name}`;
        else if (tab === 'sheet-only') text = `${item.sheetProduct.sku} ${item.sheetProduct.product_name} ${item.sheetProduct.category}`;
        else text = `${item.sku} ${item.name}`;
        return text.toLowerCase().includes(lowerQ);
    });
}

// --- RENDER VIEW ---

export function renderAnalyticsView() {
    const container = document.getElementById('view-container');
    const state = store.getState();
    const wooState = state.woocommerce || {};

    document.getElementById('breadcrumbs').textContent = 'Analytics';

    let syncHtml = '';
    if (wooState.loading) {
        const {count, total} = wooState.progress || {count:0, total:0};
        const pct = total ? (count/total)*100 : 0;
        syncHtml = `
            <div class="card" style="margin-bottom: 20px; border-left: 4px solid var(--color-primary);">
                <div style="padding: 12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:500;">
                        <span style="display:flex; align-items:center; gap:8px;">
                            <span class="material-icons" style="font-size:18px; animation: spin 1s linear infinite;">sync</span>
                            Syncing WooCommerce Products...
                        </span>
                    </div>
                    <div style="height: 6px; background: var(--color-background); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; background: var(--color-primary); width: ${total ? pct + '%' : '30%'}; transition: width 0.3s ease; ${!total ? 'animation: indeterminate 1.5s infinite linear;' : ''}"></div>
                    </div>
                </div>
            </div>`;
    }

    if (!state.config?.woocommerce?.enabled) {
        container.innerHTML = `<div class="empty-state"><h3>WooCommerce Disabled</h3></div>`;
        return;
    }

    const { qtyMismatches, perfectMatches, inSheetNotWoo, inWooNotSheet } = getAnalyticsData(
        state.products.items || [],
        wooState.products || []
    );

    // Note: Added a specific ID to the wrapper to attach events safely
    container.innerHTML = `
    <div class="analytics-container" id="analytics-main-container">
      ${syncHtml}
      
      <div class="analytics-summary">
        <div class="card analytics-stat-card">
          <div class="stat-icon" style="background: ${STYLES.cyan}15;"><span class="material-icons" style="color: ${STYLES.cyan}">check_circle</span></div>
          <div class="stat-content"><div class="stat-value">${formatQuantity(perfectMatches.length)}</div><div class="stat-label">Perfect</div></div>
        </div>
        <div class="card analytics-stat-card">
            <div class="stat-icon" style="background: var(--color-warning)15;"><span class="material-icons" style="color: var(--color-warning)">sync_problem</span></div>
            <div class="stat-content"><div class="stat-value">${formatQuantity(qtyMismatches.length)}</div><div class="stat-label">Mismatches</div></div>
        </div>
        <div class="card analytics-stat-card">
            <div class="stat-icon" style="background: var(--color-error)15;"><span class="material-icons" style="color: var(--color-error)">remove_shopping_cart</span></div>
            <div class="stat-content"><div class="stat-value">${formatQuantity(inSheetNotWoo.length)}</div><div class="stat-label">Sheet Only</div></div>
        </div>
        <div class="card analytics-stat-card">
            <div class="stat-icon" style="background: var(--color-accent)15;"><span class="material-icons" style="color: var(--color-accent)">inventory_2</span></div>
            <div class="stat-content"><div class="stat-value">${formatQuantity(inWooNotSheet.length)}</div><div class="stat-label">Woo Only</div></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 16px;">
          <div class="analytics-tabs" style="margin-bottom: 0;">
            <button class="tab-btn ${viewState.activeTab === 'mismatches' ? 'active' : ''}" data-tab="mismatches">Mismatches</button>
            <button class="tab-btn ${viewState.activeTab === 'sheet-only' ? 'active' : ''}" data-tab="sheet-only">Sheet Only</button>
            <button class="tab-btn ${viewState.activeTab === 'woo-only' ? 'active' : ''}" data-tab="woo-only">Woo Only</button>
          </div>
          <div style="position: relative; width: 300px;">
            <span class="material-icons" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary);">search</span>
            <input type="text" id="analytics-search" placeholder="Search..." value="${viewState.searchQuery}" 
                   style="width: 100%; padding: 8px 8px 8px 36px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-background); color: var(--color-text);">
          </div>
      </div>

      <div id="analytics-table-wrapper" class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--color-border); min-height: 400px;">
      </div>
    </div>`;

    const dataMap = {'mismatches': qtyMismatches, 'sheet-only': inSheetNotWoo, 'woo-only': inWooNotSheet};
    renderActiveTable(dataMap);
    setupEventListeners(dataMap);
}

// --- RENDER TABLE & PAGINATION ---

function renderActiveTable(dataMap) {
    const wrapper = document.getElementById('analytics-table-wrapper');
    const tab = viewState.activeTab;

    let data = filterData(dataMap[tab], tab, viewState.searchQuery);
    data = sortData(data, tab);

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / viewState.itemsPerPage);
    if (viewState.currentPage > totalPages) viewState.currentPage = 1;

    const startIdx = (viewState.currentPage - 1) * viewState.itemsPerPage;
    const paginatedData = data.slice(startIdx, startIdx + viewState.itemsPerPage);

    let tableHtml = '';
    if (tab === 'mismatches') tableHtml = generateMismatchesTable(paginatedData);
    else if (tab === 'sheet-only') tableHtml = generateSheetOnlyTable(paginatedData);
    else if (tab === 'woo-only') tableHtml = generateWooOnlyTable(paginatedData);

    const paginationHtml = totalItems > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid var(--color-border); background: var(--color-background);">
            <div style="color: var(--color-text-secondary); font-size: 0.9rem;">
                Showing <strong>${startIdx + 1}-${Math.min(startIdx + viewState.itemsPerPage, totalItems)}</strong> of <strong>${totalItems}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-page" ${viewState.currentPage === 1 ? 'disabled' : ''} data-action="prev">
                    <span class="material-icons">chevron_left</span> Prev
                </button>
                <span style="display: flex; align-items: center; padding: 0 8px; font-weight: 500;">Page ${viewState.currentPage} / ${totalPages || 1}</span>
                <button class="btn-page" ${viewState.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} data-action="next">
                    Next <span class="material-icons">chevron_right</span>
                </button>
            </div>
        </div>
    ` : '';

    wrapper.innerHTML = `
        <div style="overflow-x: auto;">${tableHtml}</div>
        ${paginationHtml}
    `;

    const prevBtn = wrapper.querySelector('[data-action="prev"]');
    const nextBtn = wrapper.querySelector('[data-action="next"]');

    if (prevBtn) prevBtn.onclick = () => { viewState.currentPage--; renderActiveTable(dataMap); };
    if (nextBtn) nextBtn.onclick = () => { viewState.currentPage++; renderActiveTable(dataMap); };
}

function setupEventListeners(dataMap) {
    // 1. Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            viewState.activeTab = btn.dataset.tab;
            viewState.searchQuery = '';
            viewState.currentPage = 1;
            document.getElementById('analytics-search').value = '';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActiveTable(dataMap);
        });
    });

    // 2. Debounced Search
    let timeout = null;
    const searchInput = document.getElementById('analytics-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                viewState.searchQuery = e.target.value;
                viewState.currentPage = 1;
                renderActiveTable(dataMap);
            }, 300);
        });
    }

    // 3. Sorting (FIXED: Attached to the inner container which is reset on render)
    const mainContainer = document.getElementById('analytics-main-container');
    if (mainContainer) {
        mainContainer.addEventListener('click', (e) => {
            // Check for sort header click
            const th = e.target.closest('th[data-sort]');
            if (th) {
                const col = th.dataset.sort;
                const tab = viewState.activeTab;
                if (viewState.sort[tab].column === col) {
                    viewState.sort[tab].direction = viewState.sort[tab].direction === 'asc' ? 'desc' : 'asc';
                } else {
                    viewState.sort[tab].column = col;
                    viewState.sort[tab].direction = 'asc';
                }
                // Reset to page 1 when sorting so user doesn't miss data
                viewState.currentPage = 1;
                renderActiveTable(dataMap);
            }
        });
    }
}

// --- TABLE GENERATORS ---

function getSortIcon(tab, colName) {
    const s = viewState.sort[tab];
    return s.column === colName ? (s.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : '';
}

function generateMismatchesTable(data) {
    if (data.length === 0) return `<div class="empty-state" style="padding: 40px;"><p>No mismatches found.</p></div>`;
    const tab = 'mismatches';
    return `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
      <thead style="background: var(--color-background);">
        <tr>
            <th data-sort="sku" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">SKU <span class="material-icons sort-icon">${getSortIcon(tab, 'sku')}</span></th>
            <th data-sort="name" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">Product <span class="material-icons sort-icon">${getSortIcon(tab, 'name')}</span></th>
            <th data-sort="sheetQty" style="padding: 12px; text-align: right; cursor: pointer; user-select: none;">Sheet <span class="material-icons sort-icon">${getSortIcon(tab, 'sheetQty')}</span></th>
            <th data-sort="wooQty" style="padding: 12px; text-align: right; cursor: pointer; user-select: none;">Woo <span class="material-icons sort-icon">${getSortIcon(tab, 'wooQty')}</span></th>
            <th data-sort="difference" style="padding: 12px; text-align: right; cursor: pointer; user-select: none;">Diff <span class="material-icons sort-icon">${getSortIcon(tab, 'difference')}</span></th>
        </tr>
      </thead>
      <tbody>
        ${data.map(m => {
        const diffFormatted = formatNumberWithIndicator(m.sheetQuantity - m.wooQuantity, { showSign: true, isPositiveGood: true });
        return `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: 10px 12px;"><code class="sku-code">${m.sku}</code></td>
                <td style="padding: 10px 12px;">${m.sheetProduct.product_name || 'Unnamed'}</td>
                <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: ${STYLES.cyan}">${formatQuantity(m.sheetQuantity)}</td>
                <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: ${STYLES.cyan}">${formatQuantity(m.wooQuantity)}</td>
                <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: ${diffFormatted.color}; font-weight: bold;">
                   ${diffFormatted.formatted}
                </td>
            </tr>`;
    }).join('')}
      </tbody>
    </table>`;
}

function generateSheetOnlyTable(data) {
    if (data.length === 0) return `<div class="empty-state" style="padding: 40px;"><p>No results.</p></div>`;
    const tab = 'sheet-only';
    return `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
      <thead style="background: var(--color-background);">
        <tr>
            <th data-sort="sku" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">SKU <span class="material-icons sort-icon">${getSortIcon(tab, 'sku')}</span></th>
            <th data-sort="name" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">Product <span class="material-icons sort-icon">${getSortIcon(tab, 'name')}</span></th>
            <th data-sort="qty" style="padding: 12px; text-align: right; cursor: pointer; user-select: none;">Qty <span class="material-icons sort-icon">${getSortIcon(tab, 'qty')}</span></th>
            <th data-sort="category" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">Category <span class="material-icons sort-icon">${getSortIcon(tab, 'category')}</span></th>
        </tr>
      </thead>
      <tbody>
        ${data.map(m => `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: 10px 12px;"><code class="sku-code">${m.sheetProduct.sku}</code></td>
                <td style="padding: 10px 12px;">${m.sheetProduct.product_name}</td>
                <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: ${STYLES.cyan}">${formatQuantity(m.sheetQuantity)}</td>
                <td style="padding: 10px 12px;">${m.sheetProduct.category || '-'}</td>
            </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function generateWooOnlyTable(data) {
    if (data.length === 0) return `<div class="empty-state" style="padding: 40px;"><p>No results.</p></div>`;
    const tab = 'woo-only';
    return `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
      <thead style="background: var(--color-background);">
        <tr>
            <th data-sort="sku" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">SKU <span class="material-icons sort-icon">${getSortIcon(tab, 'sku')}</span></th>
            <th data-sort="name" style="padding: 12px; text-align: left; cursor: pointer; user-select: none;">Product <span class="material-icons sort-icon">${getSortIcon(tab, 'name')}</span></th>
            <th data-sort="qty" style="padding: 12px; text-align: right; cursor: pointer; user-select: none;">Qty <span class="material-icons sort-icon">${getSortIcon(tab, 'qty')}</span></th>
            <th data-sort="price" style="padding: 12px; text-align: right; cursor: pointer; user-select: none;">Price <span class="material-icons sort-icon">${getSortIcon(tab, 'price')}</span></th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => {
        const price = formatNumberWithIndicator(p.price || 0, { isCurrency: true });
        return `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: 10px 12px;"><code class="sku-code">${p.sku || '-'}</code></td>
                <td style="padding: 10px 12px;">${p.name}</td>
                <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: ${STYLES.cyan}">${formatQuantity(p.stock_quantity)}</td>
                <td style="padding: 10px 12px; text-align: right; font-family: monospace; color: ${price.color}">${price.formatted}</td>
            </tr>`;
    }).join('')}
      </tbody>
    </table>`;
}

// Add styles for buttons and sort icons
const style = document.createElement('style');
style.textContent = `
    .btn-page {
        background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
        color: var(--color-text); padding: 4px 10px; border-radius: 4px; cursor: pointer;
        display: flex; align-items: center; gap: 4px; font-size: 0.85rem;
    }
    .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-page:hover:not(:disabled) { background: var(--color-bg-secondary); }
    .sort-icon { font-size: 14px; vertical-align: middle; margin-left: 4px; opacity: 0.5; }
    .sku-code { font-family: 'Roboto Mono', monospace; font-size: 0.85rem; color: var(--color-text-secondary); background: var(--color-bg-tertiary); padding: 2px 6px; border-radius: 4px; }
`;
document.head.appendChild(style);