/* ============================================
   js/woocommerce.js
   ============================================ */
import { store } from './store.js';

export async function fetchWooProducts() {
    const state = store.getState();
    const config = state.config?.woocommerce;

    if (!config || !config.siteUrl || !config.consumerKey || !config.enabled) {
        console.log('[Woo] Not configured or not enabled');
        return [];
    }

    try {
        store.setWooLoading(true);

        let allProducts = [];
        let page = 1;
        let hasMore = true;
        const perPage = 100;

        while (hasMore) {
            const response = await window.electronAPI.wooRequest({
                siteUrl: config.siteUrl,
                consumerKey: config.consumerKey,
                consumerSecret: config.consumerSecret,
                endpoint: `/products?per_page=${perPage}&page=${page}`
            });

            if (!response.success) throw new Error(response.error);

            const products = response.data;

            // Filter out private products
            const publicProducts = products.filter(product =>
                product.status !== 'private' &&
                product.catalog_visibility !== 'hidden'
            );

            allProducts = allProducts.concat(publicProducts);

            // If response includes headers for total, use them. Otherwise just show count.
            const total = response.headers ? parseInt(response.headers['x-wp-total']) : 0;

            // Update progress in store
            store.setWooProgress(allProducts.length, total);

            hasMore = products.length === perPage;
            page++;
        }

        store.setWooProducts(allProducts);
        return allProducts;

    } catch (error) {
        console.error('Woo fetch error:', error);
        store.setWooError(error.message);
        throw error;
    } finally {
        store.setWooLoading(false);
    }
}

export async function testWooConnection(siteUrl, key, secret) {
    try {
        const response = await window.electronAPI.wooRequest({
            siteUrl: siteUrl,
            consumerKey: key,
            consumerSecret: secret,
            endpoint: '/products?per_page=1'
        });

        if (!response.success) throw new Error(response.error);
        return { success: true, message: 'Connection successful!', data: response.data };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export function matchProductsBySKU(sheetProducts, wooProducts) {
    const matched = [];

    sheetProducts.forEach(sheetProduct => {
        const sku = sheetProduct.sku?.trim();
        if (!sku) return;

        // Find matching WooCommerce product (excluding private products)
        const wooProduct = wooProducts.find(wp =>
            wp.sku?.trim() === sku &&
            wp.status !== 'private' &&
            wp.catalog_visibility !== 'hidden'
        );

        matched.push({
            sku: sku,
            sheetProduct: sheetProduct,
            wooProduct: wooProduct || null,
            matched: !!wooProduct,
            sheetQuantity: parseInt(sheetProduct.quantity) || 0,
            wooQuantity: wooProduct ? parseInt(wooProduct.stock_quantity) || 0 : null
        });
    });

    return matched;
}