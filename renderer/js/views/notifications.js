/* ============================================
   js/views/notifications.js - Notifications View
   ============================================ */

import { store } from '../store.js';
import { notificationService } from '../notifications.js';
import { showCustomConfirm } from '../components/modal.js';

export function renderNotificationCenter() {
    const container = document.getElementById('view-container');
    const state = store.getState();
    const notifications = state.notifications || [];
    const unreadIds = notificationService.getUnreadIds();

    document.getElementById('breadcrumbs').textContent = 'Notifications';

    // Helper to group by date
    const groupNotificationsByDate = (notifs) => {
        const groups = {};
        const now = new Date();
        notifs.forEach(notif => {
            // Handle Firestore Timestamp or JS Date
            const timestamp = notif.timestamp && typeof notif.timestamp.toDate === 'function'
                ? notif.timestamp.toDate()
                : new Date(notif.timestamp);

            const diffDays = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
            let label = diffDays === 0 ? 'Today' : (diffDays === 1 ? 'Yesterday' : 'Older');
            if (!groups[label]) groups[label] = [];
            groups[label].push({ ...notif, jsDate: timestamp });
        });
        return groups;
    };

    const groupedNotifications = groupNotificationsByDate(notifications);

    const html = `
        <div class="notifications-container">
            <div class="notifications-header">
                <h1>Notifications</h1>
                <div style="display: flex; gap: 8px;">
                     ${notifications.length > 0 ? `
                        <button class="btn btn-secondary" id="clear-all-notifications-btn">
                            <span class="material-icons">delete_sweep</span> Clear All
                        </button>
                    ` : ''}
                    ${unreadIds.length > 0 ? `
                        <button class="btn btn-secondary" id="mark-all-read-btn">
                            <span class="material-icons">done_all</span> Mark all read
                        </button>
                    ` : ''}
                </div>
            </div>

            ${notifications.length === 0 ? `
                <div class="empty-state">
                    <span class="material-icons" style="font-size: 64px; color: var(--color-text-tertiary);">notifications_none</span>
                    <h3>No notifications</h3>
                </div>
            ` : `
                <div class="notifications-list">
                    ${Object.entries(groupedNotifications).map(([date, notifs]) => `
                        <div class="notification-group">
                            <div class="notification-group-header">${date}</div>
                            ${notifs.map(notif => renderNotificationItem(notif, unreadIds)).join('')}
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;

    container.innerHTML = html;
    setupHandlers();
}

function renderNotificationItem(notification, unreadIds) {
    const isUnread = unreadIds.includes(notification.id);
    const timeStr = notification.jsDate ? notification.jsDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notification.id}">
            <div class="notification-icon">
                <span class="material-icons" style="color: ${notificationService.getNotificationColor(notification.type)}">
                    ${notificationService.getNotificationIcon(notification)}
                </span>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notificationService.getNotificationTitle(notification)}</div>
                <div class="notification-body">${notificationService.getNotificationBody(notification)}</div>
                <div class="notification-meta">${timeStr}</div>
            </div>
             <button class="btn btn-icon notification-delete" data-id="${notification.id}">
                <span class="material-icons">delete</span>
            </button>
        </div>
    `;
}

function setupHandlers() {
    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) markAllBtn.onclick = () => { notificationService.markAllAsRead(); renderNotificationCenter(); };

    const clearAllBtn = document.getElementById('clear-all-notifications-btn');
    if (clearAllBtn) clearAllBtn.onclick = async () => {
        if(await showCustomConfirm('Clear All', 'Delete all notifications?', 'warning')) {
            const notifs = store.getState().notifications || [];
            for(const n of notifs) await notificationService.deleteNotification(n.id);
            renderNotificationCenter();
        }
    };

    document.querySelectorAll('.notification-delete').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if(await showCustomConfirm('Delete', 'Delete this notification?', 'warning')) {
                await notificationService.deleteNotification(btn.dataset.id);
                renderNotificationCenter();
            }
        };
    });

    document.querySelectorAll('.notification-item').forEach(item => {
        item.onclick = (e) => {
            if(!e.target.closest('.notification-delete')) {
                notificationService.markAsRead(item.dataset.id);
                renderNotificationCenter();
            }
        }
    });
}