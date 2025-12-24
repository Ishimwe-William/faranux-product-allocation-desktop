/* ============================================
   js/views/notifications.js - Notifications View
   ============================================ */

import { store } from '../store.js';
import { notificationService } from '../notifications.js';
import { showCustomConfirm } from '../components/modal.js';

let currentTab = 'all';

export function renderNotificationCenter() {
    const container = document.getElementById('view-container');
    const state = store.getState();
    const notifications = state.notifications || [];

    const unreadIds = notificationService.getUnreadIds();

    document.getElementById('breadcrumbs').textContent = 'Notifications';

    const filteredNotifications = currentTab === 'all'
        ? notifications
        : currentTab === 'unread'
            ? notifications.filter(n => unreadIds.includes(n.id))
            : notifications.filter(n => !unreadIds.includes(n.id));

    const unreadCount = unreadIds.length;
    const readCount = notifications.length - unreadCount;

    const groupedNotifications = groupNotificationsByDate(filteredNotifications);

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

            <div class="notification-tabs">
                <button class="notification-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">
                    All 
                </button>
                <button class="notification-tab ${currentTab === 'unread' ? 'active' : ''}" data-tab="unread">
                    Unread 
                    ${unreadCount > 0 ? `<span class="tab-badge unread-badge">${unreadCount}</span>` : ''}
                </button>
                <button class="notification-tab ${currentTab === 'read' ? 'active' : ''}" data-tab="read">
                    Read 
                </button>
            </div>

            ${filteredNotifications.length === 0 ? `
                <div class="empty-state">
                    <span class="material-icons" style="font-size: 64px; color: var(--color-text-tertiary);">
                        ${currentTab === 'unread' ? 'mark_email_read' : currentTab === 'read' ? 'drafts' : 'notifications_none'}
                    </span>
                    <h3>${currentTab === 'unread' ? 'No unread notifications' : currentTab === 'read' ? 'No read notifications' : 'No notifications'}</h3>
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

function groupNotificationsByDate(notifs) {
    const groups = {};
    const now = new Date();
    notifs.forEach(notif => {
        const timestamp = notif.timestamp && typeof notif.timestamp.toDate === 'function'
            ? notif.timestamp.toDate()
            : new Date(notif.timestamp);

        const diffDays = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
        let label = diffDays === 0 ? 'Today' : (diffDays === 1 ? 'Yesterday' : 'Older');
        if (!groups[label]) groups[label] = [];
        groups[label].push({ ...notif, jsDate: timestamp });
    });
    return groups;
}

function renderNotificationItem(notification, unreadIds) {
    const isUnread = unreadIds.includes(notification.id);
    const timeStr = notification.jsDate ? notification.jsDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notification.id}">
            ${isUnread ? '<div class="notification-unread-badge"></div>' : ''}
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
            <div class="notification-actions">
                ${isUnread ? `
                    <button class="btn btn-icon notification-mark-read" data-id="${notification.id}" title="Mark as read">
                        <span class="material-icons">check</span>
                    </button>
                ` : `
                    <button class="btn btn-icon notification-mark-unread" data-id="${notification.id}" title="Mark as unread">
                        <span class="material-icons">mark_email_unread</span>
                    </button>
                `}
                <button class="btn btn-icon notification-delete" data-id="${notification.id}" title="Remove">
                    <span class="material-icons">close</span>
                </button>
            </div>
        </div>
    `;
}

function setupHandlers() {
    // Tab switching
    document.querySelectorAll('.notification-tab').forEach(tab => {
        tab.onclick = () => {
            currentTab = tab.dataset.tab;
            renderNotificationCenter();
        };
    });

    // Mark all read
    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
        markAllBtn.onclick = async () => {
            // Optimistic UI update
            markAllBtn.disabled = true;
            markAllBtn.innerHTML = '<span class="material-icons spin">sync</span> Marking...';

            await notificationService.markAllAsRead();

            // UI will update via store subscription
        };
    }

    // Clear all
    const clearAllBtn = document.getElementById('clear-all-notifications-btn');
    if (clearAllBtn) {
        clearAllBtn.onclick = async () => {
            if (await showCustomConfirm('Clear All', 'Remove all notifications from your view?', 'warning')) {
                clearAllBtn.disabled = true;
                clearAllBtn.innerHTML = '<span class="material-icons spin">sync</span> Clearing...';

                const notifs = store.getState().notifications || [];
                const promises = notifs.map(n => notificationService.deleteNotification(n.id));
                await Promise.all(promises);
            }
        };
    }

    // Individual mark as read with optimistic UI
    document.querySelectorAll('.notification-mark-read').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            const notifItem = btn.closest('.notification-item');

            // Optimistic UI update
            notifItem.classList.add('marking-read');
            btn.disabled = true;

            await notificationService.markAsRead(notifId);
        };
    });

    // Individual mark as unread with optimistic UI
    document.querySelectorAll('.notification-mark-unread').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            const notifItem = btn.closest('.notification-item');

            // Optimistic UI update
            notifItem.classList.add('marking-unread');
            btn.disabled = true;

            await notificationService.markAsUnread(notifId);
        };
    });

    // Delete individual with optimistic UI
    document.querySelectorAll('.notification-delete').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            const notifItem = btn.closest('.notification-item');

            // Optimistic UI update - fade out
            notifItem.style.opacity = '0.5';
            notifItem.style.pointerEvents = 'none';
            btn.disabled = true;

            await notificationService.deleteNotification(notifId);
        };
    });

    // Click item to mark as read
    document.querySelectorAll('.notification-item').forEach(item => {
        item.onclick = (e) => {
            if (!e.target.closest('.btn')) {
                const isUnread = item.classList.contains('unread');
                if (isUnread) {
                    item.classList.add('marking-read');
                    notificationService.markAsRead(item.dataset.id);
                }
            }
        };
    });
}