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

        // Load notification sound
        this.audio = new Audio('assets/sounds/notification.mp3');
        this.audio.volume = 0.7;

        // Request notification permission
        this.requestNotificationPermission();

        // Load unread count from localStorage
        const unreadCount = this.getUnreadCount();
        store.setNotificationCount(unreadCount);

        // Subscribe to real-time notifications
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

        // Listen to notifications collection for this user
        this.unsubscribe = this.db
            .collection('notifications')
            .where('userId', 'in', [this.userId, 'all_admins'])
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot(
                (snapshot) => {
                    let hasNewItems = false;

                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const notification = {
                                id: change.doc.id,
                                ...change.doc.data()
                            };

                            // FIX 1: Increased window from 10s (10000) to 60s (60000)
                            // This accounts for network latency and clock skew
                            const now = Date.now();
                            // Handle both Firestore Timestamp objects and standard dates
                            const notifTime = notification.timestamp?.toMillis ? notification.timestamp.toMillis() : new Date(notification.timestamp).getTime();

                            if (now - notifTime < 60000) {
                                this.handleNewNotification(notification);
                            }
                            hasNewItems = true;
                        }
                    });

                    // Always update store if we have data
                    const allNotifications = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    store.setNotifications(allNotifications);
                },
                (error) => {
                    console.error('[Notifications] Subscription error:', error);
                    // CRITICAL: If you see "The query requires an index" in console,
                    // you MUST click the link provided in the error message!
                }
            );
    }

    handleNewNotification(notification) {
        console.log('[Notifications] New notification:', notification);

        // Play sound
        this.playNotificationSound();

        // Show native OS notification
        this.showNativeNotification(notification);

        // Mark as unread and increment counter
        this.markAsUnread(notification.id);

        // Show in-app notification banner
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
                badge: 'assets/icons/badge.png',
                tag: notification.id,
                requireInteraction: false
            });

            nativeNotif.onclick = () => {
                window.focus();
                this.markAsRead(notification.id);
                this.navigateToNotification(notification);
            };

            // Auto close after 5 seconds
            setTimeout(() => nativeNotif.close(), 5000);
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

        // Auto remove after 5 seconds
        setTimeout(() => {
            banner.classList.add('notification-banner-exit');
            setTimeout(() => banner.remove(), 300);
        }, 5000);

        // Close button
        banner.querySelector('.notification-banner-close').onclick = () => {
            banner.classList.add('notification-banner-exit');
            setTimeout(() => banner.remove(), 300);
        };

        // Click to navigate
        banner.onclick = (e) => {
            if (!e.target.closest('.notification-banner-close')) {
                this.markAsRead(notification.id);
                this.navigateToNotification(notification);
                banner.remove();
            }
        };
    }

    getNotificationTitle(notification) {
        switch(notification.type) {
            case 'order_created':
                return '🛒 New Order Received';
            case 'order_cancelled':
                return '❌ Order Cancelled';
            case 'order_completed':
                return '✅ Order Completed';
            case 'order_processing':
                return '⏳ Order Processing';
            case 'order_failed':
                return '⚠️ Order Failed';
            case 'low_stock':
                return '📦 Low Stock Alert';
            default:
                return 'Notification';
        }
    }

    getNotificationBody(notification) {
        const data = notification.data || {};

        switch(notification.type) {
            case 'order_created':
                return `Order #${data.orderId} - ${data.total || 'Amount unknown'}\nCustomer: ${data.customerName || 'N/A'}`;
            case 'order_cancelled':
                return `Order #${data.orderId} - ${data.total || ''}`;
            case 'order_completed':
                return `Order #${data.orderId} is complete`;
            case 'order_processing':
                return `Order #${data.orderId} is being processed`;
            case 'order_failed':
                return `Order #${data.orderId} has failed`;
            case 'low_stock':
                return `${data.productName} - Only ${data.quantity} left`;
            default:
                return notification.message || 'You have a new notification';
        }
    }

    getNotificationIcon(notification) {
        switch(notification.type) {
            case 'order_created':
                return 'shopping_cart';
            case 'order_cancelled':
                return 'cancel';
            case 'order_completed':
                return 'check_circle';
            case 'order_processing':
                return 'pending';
            case 'order_failed':
                return 'error';
            case 'low_stock':
                return 'inventory_2';
            default:
                return 'notifications';
        }
    }

    getNotificationColor(type) {
        switch(type) {
            case 'order_created':
                return '#4caf50';
            case 'order_cancelled':
                return '#f44336';
            case 'order_completed':
                return '#2196f3';
            case 'order_processing':
                return '#ff9800';
            case 'order_failed':
                return '#f44336';
            case 'low_stock':
                return '#ff9800';
            default:
                return '#9e9e9e';
        }
    }

    navigateToNotification(notification) {
        // Navigate based on notification type
        if (notification.type.includes('order')) {
            console.log('[Notifications] Navigate to order:', notification.data?.orderId);
            // You can add navigation logic here if you have an orders view
        }
    }

    markAsRead(notificationId) {
        const unreadIds = this.getUnreadIds();
        const newUnreadIds = unreadIds.filter(id => id !== notificationId);
        localStorage.setItem(`unread_notifications_${this.userId}`, JSON.stringify(newUnreadIds));
        store.setNotificationCount(newUnreadIds.length);
    }

    markAsUnread(notificationId) {
        const unreadIds = this.getUnreadIds();
        if (!unreadIds.includes(notificationId)) {
            unreadIds.push(notificationId);
            localStorage.setItem(`unread_notifications_${this.userId}`, JSON.stringify(unreadIds));
            store.setNotificationCount(unreadIds.length);
        }
    }

    markAllAsRead() {
        localStorage.setItem(`unread_notifications_${this.userId}`, JSON.stringify([]));
        store.setNotificationCount(0);
    }

    getUnreadIds() {
        const stored = localStorage.getItem(`unread_notifications_${this.userId}`);
        return stored ? JSON.parse(stored) : [];
    }

    getUnreadCount() {
        return this.getUnreadIds().length;
    }

    isUnread(notificationId) {
        return this.getUnreadIds().includes(notificationId);
    }

    async deleteNotification(notificationId) {
        try {
            await this.db.collection('notifications').doc(notificationId).delete();
            this.markAsRead(notificationId);
        } catch (error) {
            console.error('[Notifications] Delete error:', error);
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
