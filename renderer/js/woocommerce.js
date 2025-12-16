/* ============================================
   woocommerce.js - WooCommerce Integration Service
   ============================================ */
import { store } from './store.js';

export async function fetchWooProducts() {
    const state = store.getState();
    const config = state.config?.woocommerce;

    if (!config || !config.siteUrl || !config.consumerKey) {
        // Silent fail if not configured yet
        return [];
    }

    try {
        store.setWooLoading(true);

        // Fetch products (limit -1 is not supported by standard Woo REST API,
        // usually requires pagination. We set 100 here for the demo.
        // In production, you might need a loop to fetch all pages).
        const response = await window.electronAPI.wooRequest({
            siteUrl: config.siteUrl,
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,
            endpoint: '/products?per_page=100'
        });

        if (!response.success) throw new Error(response.error);

        const products = response.data;
        store.setWooProducts(products);
        return products;

    } catch (error) {
        console.error('Woo fetch error:', error);
        store.setWooError(error.message);
        throw error;
    }
}

export async function testWooConnection(siteUrl, key, secret) {
    try {
        const response = await window.electronAPI.wooRequest({
            siteUrl: siteUrl,
            consumerKey: key,
            consumerSecret: secret,
            endpoint: '/system_status' // Lightweight endpoint to test auth
        });

        if (!response.success) throw new Error(response.error);
        return { success: true, message: 'Connection successful!' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}