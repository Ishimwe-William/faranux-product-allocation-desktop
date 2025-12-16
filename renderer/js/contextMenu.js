/* ============================================
   contextMenu.js - Custom Context Menu Handler
   ============================================ */

class ContextMenuManager {
    constructor() {
        this.currentMenu = null;
        this.init();
    }

    init() {
        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (this.currentMenu && !this.currentMenu.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Close menu on scroll
        document.addEventListener('scroll', () => {
            this.closeMenu();
        }, true);

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMenu();
            }
        });

        // Prevent default context menu on specific elements
        this.setupContextMenuListeners();
    }

    setupContextMenuListeners() {
        // Products search results
        document.addEventListener('contextmenu', (e) => {
            // Check if clicked on product card
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                e.preventDefault();
                this.showProductContextMenu(e, productCard);
                return;
            }

            // Check if clicked on SKU code
            const skuCode = e.target.closest('.sku-code');
            if (skuCode) {
                e.preventDefault();
                this.showSkuContextMenu(e, skuCode);
                return;
            }

            // Check if clicked on table row in analytics
            const tableRow = e.target.closest('.data-table tbody tr');
            if (tableRow) {
                e.preventDefault();
                this.showTableRowContextMenu(e, tableRow);
                return;
            }

            // Check if clicked on shelf card
            const shelfCard = e.target.closest('.shelf-card');
            if (shelfCard) {
                e.preventDefault();
                this.showShelfContextMenu(e, shelfCard);
                return;
            }

            // Check if clicked on input field
            const input = e.target.closest('input, textarea');
            if (input) {
                e.preventDefault();
                this.showInputContextMenu(e, input);
                return;
            }
        });
    }

    showProductContextMenu(event, productCard) {
        const sku = productCard.querySelector('.sku-text')?.textContent || '';
        const productName = productCard.querySelector('.product-name')?.textContent || '';

        const menuItems = [
            {
                label: 'Copy SKU',
                icon: 'content_copy',
                shortcut: 'Ctrl+C',
                action: () => this.copyToClipboard(sku),
                disabled: !sku
            },
            {
                label: 'Copy Product Name',
                icon: 'content_copy',
                action: () => this.copyToClipboard(productName),
                disabled: !productName
            },
            { type: 'separator' },
            {
                label: 'View Details',
                icon: 'info',
                action: () => {
                    // Navigate to product details if available
                    console.log('View product details:', sku);
                }
            },
            {
                label: 'Find in Shelves',
                icon: 'search',
                action: () => {
                    window.location.hash = '#/shelves';
                    setTimeout(() => {
                        const searchInput = document.getElementById('shelf-search');
                        if (searchInput) {
                            searchInput.value = sku;
                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, 100);
                }
            }
        ];

        this.showMenu(event.clientX, event.clientY, menuItems);
    }

    showSkuContextMenu(event, skuElement) {
        const sku = skuElement.textContent.trim();

        const menuItems = [
            {
                label: 'Copy SKU',
                icon: 'content_copy',
                shortcut: 'Ctrl+C',
                action: () => this.copyToClipboard(sku)
            },
            { type: 'separator' },
            {
                label: 'Search Products',
                icon: 'search',
                action: () => {
                    window.location.hash = '#/products';
                    setTimeout(() => {
                        const searchInput = document.getElementById('product-search');
                        if (searchInput) {
                            searchInput.value = sku;
                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, 100);
                }
            },
            {
                label: 'Search in Shelves',
                icon: 'shelves',
                action: () => {
                    window.location.hash = '#/shelves';
                    setTimeout(() => {
                        const searchInput = document.getElementById('shelf-search');
                        if (searchInput) {
                            searchInput.value = sku;
                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, 100);
                }
            }
        ];

        this.showMenu(event.clientX, event.clientY, menuItems);
    }

    showTableRowContextMenu(event, row) {
        const sku = row.querySelector('.sku-code')?.textContent || '';
        const productName = row.querySelector('.product-name-cell')?.textContent || '';

        const menuItems = [
            {
                label: 'Copy SKU',
                icon: 'content_copy',
                action: () => this.copyToClipboard(sku),
                disabled: !sku
            },
            {
                label: 'Copy Product Name',
                icon: 'content_copy',
                action: () => this.copyToClipboard(productName),
                disabled: !productName
            },
            { type: 'separator' },
            {
                label: 'Copy Row Data',
                icon: 'content_copy',
                action: () => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const data = cells.map(cell => cell.textContent.trim()).join('\t');
                    this.copyToClipboard(data);
                }
            },
            { type: 'separator' },
            {
                label: 'View in Products',
                icon: 'inventory_2',
                action: () => {
                    window.location.hash = '#/products';
                    setTimeout(() => {
                        const searchInput = document.getElementById('product-search');
                        if (searchInput && sku) {
                            searchInput.value = sku;
                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, 100);
                }
            }
        ];

        this.showMenu(event.clientX, event.clientY, menuItems);
    }

    showShelfContextMenu(event, shelfCard) {
        const shelfId = shelfCard.dataset.shelfId;
        const shelfName = shelfCard.querySelector('.shelf-name')?.textContent || '';

        const menuItems = [
            {
                label: 'Copy Shelf Name',
                icon: 'content_copy',
                action: () => this.copyToClipboard(shelfName)
            },
            { type: 'separator' },
            {
                label: 'Open Shelf',
                icon: 'open_in_new',
                action: () => {
                    window.location.hash = `#/shelf/${shelfId}`;
                }
            }
        ];

        this.showMenu(event.clientX, event.clientY, menuItems);
    }

    showInputContextMenu(event, input) {
        const hasSelection = input.selectionStart !== input.selectionEnd;
        const selectedText = hasSelection ? input.value.substring(input.selectionStart, input.selectionEnd) : '';

        const menuItems = [];

        if (hasSelection) {
            menuItems.push(
                {
                    label: 'Cut',
                    icon: 'content_cut',
                    shortcut: 'Ctrl+X',
                    action: () => {
                        this.copyToClipboard(selectedText);
                        document.execCommand('cut');
                    }
                },
                {
                    label: 'Copy',
                    icon: 'content_copy',
                    shortcut: 'Ctrl+C',
                    action: () => this.copyToClipboard(selectedText)
                }
            );
        }

        menuItems.push(
            {
                label: 'Paste',
                icon: 'content_paste',
                shortcut: 'Ctrl+V',
                action: async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        document.execCommand('insertText', false, text);
                    } catch (err) {
                        console.error('Failed to paste:', err);
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Select All',
                icon: 'select_all',
                shortcut: 'Ctrl+A',
                action: () => input.select()
            }
        );

        if (input.value) {
            menuItems.push(
                { type: 'separator' },
                {
                    label: 'Clear',
                    icon: 'clear',
                    action: () => {
                        input.value = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            );
        }

        this.showMenu(event.clientX, event.clientY, menuItems);
    }

    showMenu(x, y, items) {
        this.closeMenu();

        const menu = document.createElement('div');
        menu.className = 'custom-context-menu';

        items.forEach(item => {
            if (item.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                menu.appendChild(separator);
            } else if (item.type === 'label') {
                const label = document.createElement('div');
                label.className = 'context-menu-label';
                label.textContent = item.text;
                menu.appendChild(label);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `context-menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`;

                if (item.icon) {
                    const icon = document.createElement('span');
                    icon.className = 'material-icons';
                    icon.textContent = item.icon;
                    menuItem.appendChild(icon);
                }

                const label = document.createElement('span');
                label.textContent = item.label;
                menuItem.appendChild(label);

                if (item.shortcut) {
                    const shortcut = document.createElement('span');
                    shortcut.className = 'context-menu-shortcut';
                    shortcut.textContent = item.shortcut;
                    menuItem.appendChild(shortcut);
                }

                if (!item.disabled && item.action) {
                    menuItem.addEventListener('click', () => {
                        item.action();
                        this.closeMenu();
                    });
                }

                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);
        this.currentMenu = menu;

        // Position menu
        this.positionMenu(menu, x, y);

        // Show menu with animation
        requestAnimationFrame(() => {
            menu.classList.add('visible');
        });
    }

    positionMenu(menu, x, y) {
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = x;
        let top = y;

        // Adjust if menu would go off-screen horizontally
        if (left + menuRect.width > viewportWidth) {
            left = viewportWidth - menuRect.width - 10;
        }

        // Adjust if menu would go off-screen vertically
        if (top + menuRect.height > viewportHeight) {
            top = viewportHeight - menuRect.height - 10;
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    closeMenu() {
        if (this.currentMenu) {
            this.currentMenu.remove();
            this.currentMenu = null;
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast('Failed to copy', 'error');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'context-menu-toast';
        toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${type === 'error' ? 'var(--color-error)' : 'var(--color-success)'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      z-index: 10001;
      animation: toastSlideIn 0.3s ease;
      font-size: 14px;
      font-weight: 500;
    `;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Initialize context menu manager
let contextMenuManager;

export function initContextMenu() {
    if (!contextMenuManager) {
        contextMenuManager = new ContextMenuManager();
    }
    return contextMenuManager;
}

// Add toast animations to document
const style = document.createElement('style');
style.textContent = `
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes toastSlideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);