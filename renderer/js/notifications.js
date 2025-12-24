/* ============================================
   js/notifications.js - Notification Service
   ============================================ */

import { store } from './store.js';

class NotificationService {
    constructor() {
        this.db = null;
        this.unsubscribe = null;
        this.audio = null;
        this.isInitialized = false;
        this.userId = null;
    }

    async initialize(db, userId) {
        if (this.isInitialized) return;

        this.db = db;
        this.userId = userId;

        this.audio = new Audio('assets/sounds/notification.mp3');
        this.audio.volume = 0.7;

        this.requestNotificationPermission();
        this.subscribeToNotifications();

        this.isInitialized = true;
        console.log('[Notifications] Service initialized for user:', userId);
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('[Notifications] Browser does not support notifications');
            return;
        }

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('[Notifications] Permission:', permission);
        }
    }

    subscribeToNotifications() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        // REMOVED .limit(100) to fetch ALL notifications
        this.unsubscribe = this.db
            .collection('notifications')
            .where('userId', 'in', [this.userId, 'all_admins'])
            .orderBy('timestamp', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const allNotifications = [];
                    let unreadCount = 0;

                    snapshot.docs.forEach((doc) => {
                        const data = doc.data();

                        if (data.deletedBy && data.deletedBy.includes(this.userId)) {
                            return;
                        }

                        const notification = {
                            id: doc.id,
                            ...data
                        };

                        const isRead = data.readBy && data.readBy.includes(this.userId);
                        if (!isRead) {
                            unreadCount++;
                        }

                        allNotifications.push(notification);

                        if (doc.metadata.hasPendingWrites === false) {
                            const now = Date.now();
                            const notifTime = notification.timestamp?.toMillis ? notification.timestamp.toMillis() : new Date(notification.timestamp).getTime();
                            if (now - notifTime < 60000 && !isRead) {
                                this.handleNewNotification(notification);
                            }
                        }
                    });

                    store.setNotifications(allNotifications);
                    store.setNotificationCount(unreadCount);
                },
                (error) => {
                    console.error('[Notifications] Subscription error:', error);
                }
            );
    }

    handleNewNotification(notification) {
        this.playNotificationSound();
        this.showNativeNotification(notification);
        this.showInAppBanner(notification);
    }

    playNotificationSound() {
        if (this.audio) {
            this.audio.currentTime = 0;
            this.audio.play().catch(err => {
                console.warn('[Notifications] Could not play sound:', err);
            });
        }
    }

    showNativeNotification(notification) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            const title = this.getNotificationTitle(notification);
            const body = this.getNotificationBody(notification);

            const nativeNotif = new Notification(title, {
                body: body,
                icon: 'assets/icons/icon.png',
                tag: notification.id,
                requireInteraction: false,
                badge: 'assets/icons/icon.png' // App badge icon
            });

            nativeNotif.onclick = () => {
                window.focus();
                this.markAsRead(notification.id);
            };
        }
    }

    showInAppBanner(notification) {
        const banner = document.createElement('div');
        banner.className = 'notification-banner';
        banner.innerHTML = `
            <div class="notification-banner-content">
                <span class="notification-banner-icon material-icons" style="background: ${this.getNotificationColor(notification.type)};">
                    ${this.getNotificationIcon(notification)}
                </span>
                <div class="notification-banner-text">
                    <div class="notification-banner-title">${this.getNotificationTitle(notification)}</div>
                    <div class="notification-banner-body">${this.getNotificationBody(notification)}</div>
                </div>
                <button class="notification-banner-close">
                    <span class="material-icons">close</span>
                </button>
            </div>
        `;

        document.body.appendChild(banner);

        setTimeout(() => {
            banner.classList.add('notification-banner-exit');
            setTimeout(() => banner.remove(), 300);
        }, 5000);

        banner.querySelector('.notification-banner-close').onclick = () => {
            banner.classList.add('notification-banner-exit');
            setTimeout(() => banner.remove(), 300);
        };

        banner.onclick = (e) => {
            if (!e.target.closest('.notification-banner-close')) {
                this.markAsRead(notification.id);
                banner.remove();
            }
        };
    }

    async markAsRead(notificationId) {
        try {
            await this.db.collection('notifications').doc(notificationId).update({
                readBy: firebase.firestore.FieldValue.arrayUnion(this.userId)
            });
        } catch (error) {
            console.error('[Notifications] Mark read error:', error);
        }
    }

    async markAsUnread(notificationId) {
        try {
            await this.db.collection('notifications').doc(notificationId).update({
                readBy: firebase.firestore.FieldValue.arrayRemove(this.userId)
            });
        } catch (error) {
            console.error('[Notifications] Mark unread error:', error);
        }
    }

    async markAllAsRead() {
        const state = store.getState();
        const notifications = state.notifications || [];

        const batch = this.db.batch();
        let count = 0;

        notifications.forEach(notif => {
            if (!notif.readBy || !notif.readBy.includes(this.userId)) {
                const ref = this.db.collection('notifications').doc(notif.id);
                batch.update(ref, {
                    readBy: firebase.firestore.FieldValue.arrayUnion(this.userId)
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }
    }

    async deleteNotification(notificationId) {
        try {
            await this.db.collection('notifications').doc(notificationId).update({
                deletedBy: firebase.firestore.FieldValue.arrayUnion(this.userId)
            });
        } catch (error) {
            console.error('[Notifications] Delete error:', error);
        }
    }

    getUnreadIds() {
        const state = store.getState();
        const notifications = state.notifications || [];
        return notifications
            .filter(n => !n.readBy || !n.readBy.includes(this.userId))
            .map(n => n.id);
    }

    getNotificationTitle(notification) {
        switch(notification.type) {
            case 'order_created': return '🛒 New Order Received';
            case 'order_cancelled': return '❌ Order Cancelled';
            case 'order_completed': return '✅ Order Completed';
            case 'order_processing': return '⏳ Order Processing';
            case 'order_failed': return '⚠️ Order Failed';
            case 'low_stock': return '📦 Low Stock Alert';
            default: return 'Notification';
        }
    }

    getNotificationBody(notification) {
        const data = notification.data || {};
        switch(notification.type) {
            case 'order_created': return `Order #${data.orderId} - ${data.total || ''}\nCustomer: ${data.customerName || 'N/A'}`;
            case 'order_cancelled': return `Order #${data.orderId} - ${data.total || ''}`;
            case 'order_completed': return `Order #${data.orderId} is complete`;
            case 'order_processing': return `Order #${data.orderId} is being processed`;
            case 'low_stock': return `${data.productName} - Only ${data.quantity} left`;
            default: return notification.message || 'You have a new notification';
        }
    }

    getNotificationIcon(notification) {
        switch(notification.type) {
            case 'order_created': return 'shopping_cart';
            case 'order_cancelled': return 'cancel';
            case 'order_completed': return 'check_circle';
            case 'order_processing': return 'pending';
            case 'low_stock': return 'inventory_2';
            default: return 'notifications';
        }
    }

    getNotificationColor(type) {
        switch(type) {
            case 'order_created': return '#4caf50';
            case 'order_cancelled': return '#f44336';
            case 'order_completed': return '#2196f3';
            case 'order_processing': return '#ff9800';
            case 'low_stock': return '#ff9800';
            default: return '#9e9e9e';
        }
    }

    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.isInitialized = false;
        this.userId = null;
    }
}

export const notificationService = new NotificationService();
