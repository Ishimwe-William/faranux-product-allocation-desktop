/* ============================================
   woocommerce.js - WooCommerce Integration Service
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
            allProducts = allProducts.concat(products);

            // Check if there are more pages
            hasMore = products.length === perPage;
            page++;

            console.log(`[Woo] Fetched page ${page - 1}, total products: ${allProducts.length}`);
        }

        store.setWooProducts(allProducts);
        console.log(`[Woo] Sync complete: ${allProducts.length} products`);
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

        const wooProduct = wooProducts.find(wp => wp.sku?.trim() === sku);

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