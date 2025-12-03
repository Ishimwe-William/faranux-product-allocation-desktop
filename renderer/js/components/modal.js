/* ============================================
   js/utils/modal.js - Custom Modal Utility
   ============================================ */

export function showCustomAlert(title, message, type = 'info') {
    return new Promise((resolve) => {
        const container = document.getElementById('modal-container');
        if (!container) return resolve();

        // Determine icon and color
        let icon = 'info';
        let titleClass = '';

        if (type === 'error') {
            icon = 'error_outline';
            titleClass = 'error';
        } else if (type === 'success') {
            icon = 'check_circle';
            titleClass = 'success';
        }

        // Generate HTML
        container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header ${titleClass}">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons">${icon}</span>
              <h3 class="modal-title">${title}</h3>
            </div>
          </div>
          <div class="modal-body">
            ${message}
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="modal-ok-btn">OK</button>
          </div>
        </div>
      </div>
    `;

        animateAndHandleClose(container, resolve);
    });
}

// NEW: Confirmation Modal
export function showCustomConfirm(title, message, type = 'warning') {
    return new Promise((resolve) => {
        const container = document.getElementById('modal-container');
        if (!container) return resolve(false);

        let icon = 'help_outline';
        let titleClass = '';

        if (type === 'warning') {
            icon = 'warning_amber';
            titleClass = 'warning';
        }

        container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header ${titleClass}">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons">${icon}</span>
              <h3 class="modal-title">${title}</h3>
            </div>
          </div>
          <div class="modal-body">
            ${message}
          </div>
          <div class="modal-footer">
            <button class="btn btn-text" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="modal-confirm-btn">Confirm</button>
          </div>
        </div>
      </div>
    `;

        const backdrop = container.querySelector('.modal-backdrop');
        const cancelBtn = container.querySelector('#modal-cancel-btn');
        const confirmBtn = container.querySelector('#modal-confirm-btn');

        // Animation
        requestAnimationFrame(() => backdrop.classList.add('visible'));

        // Handlers
        function close(result) {
            backdrop.classList.remove('visible');
            setTimeout(() => {
                container.innerHTML = '';
                resolve(result);
            }, 200);
        }

        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close(false);
        });

        confirmBtn.focus();
    });
}

// Helper to avoid duplicate code in Alert
function animateAndHandleClose(container, resolve) {
    const backdrop = container.querySelector('.modal-backdrop');
    const btn = container.querySelector('#modal-ok-btn');

    requestAnimationFrame(() => backdrop.classList.add('visible'));

    function closeModal() {
        backdrop.classList.remove('visible');
        setTimeout(() => {
            container.innerHTML = '';
            resolve();
        }, 200);
    }

    btn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });
    btn.focus();
}