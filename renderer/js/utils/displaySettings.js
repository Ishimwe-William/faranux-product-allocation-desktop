// /* ============================================
//    views/displaySettings.js - Display Settings View
//    ============================================ */
//
// import { store } from '../store.js';
//
// export function renderDisplaySettingsView() {
//   const container = document.getElementById('view-container');
//
//   // Update breadcrumbs with clickable path
//   const breadcrumbs = document.getElementById('breadcrumbs');
//   breadcrumbs.innerHTML = '<a href="#/settings" id="breadcrumb-settings" style="cursor:pointer;color:inherit;text-decoration:none;">Settings</a> > Display';
//   document.getElementById('breadcrumb-settings').addEventListener('click', (e) => {
//     e.preventDefault();
//     window.location.hash = '#/settings';
//   });
//
//   const state = store.getState();
//   const display = state.display || {};
//
//   const html = `
//     <div class="display-settings-container">
//       <div class="display-settings-content">
//         <div class="settings-section">
//           <h3>Theme</h3>
//           <div class="settings-item">
//             <label><input type="radio" name="theme" value="system"> System</label>
//             <label><input type="radio" name="theme" value="light"> Light</label>
//             <label><input type="radio" name="theme" value="dark"> Dark</label>
//           </div>
//         </div>
//       </div>
//     </div>
//   `;
//
//   container.innerHTML = html;
//
//   // Wire up controls to store
//   // Theme radios
//   const themeRadios = document.querySelectorAll('input[name="theme"]');
//   themeRadios.forEach(r => {
//     r.checked = (display.theme === r.value);
//     r.addEventListener('change', (e) => {
//       store.setDisplaySettings({ theme: e.target.value });
//     });
//   });
//
// }
