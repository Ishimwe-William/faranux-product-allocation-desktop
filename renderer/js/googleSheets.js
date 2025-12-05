/* ============================================
   googleSheets.js - Google Sheets API with Flexible Column Mapping
   ============================================ */

import { store } from './store.js';

// Initialize env vars (Fallback only)
let GSHEETS_API_KEY = null;
let GSHEET_ID = null;

const envPromise = (async () => {
    try {
        if (window.electronAPI && window.electronAPI.getEnv) {
            const env = await window.electronAPI.getEnv();
            GSHEETS_API_KEY = env?.GSHEETS_API_KEY || null;
            GSHEET_ID = env?.GSHEET_ID || null;
        } else if (typeof process !== 'undefined' && process.env) {
            GSHEETS_API_KEY = process.env.EXPO_PUBLIC_GSHEETS_API_KEY || null;
            GSHEET_ID = process.env.EXPO_PUBLIC_GSHEET_ID || null;
        }
    } catch (e) {
        console.warn('Failed to load env for googleSheets:', e);
    }
})();

const GSHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// ---------------------------------------------------------
// Column Mapping - Define all possible variations
// ---------------------------------------------------------

const COLUMN_MAPPINGS = {
    // Product name variations
    product_name: ['product_name', 'item', 'name', 'product', 'item_name', 'product name', 'item name'],

    // SKU variations (prioritized - checked first)
    sku: ['sku', 'item_code', 'product_code', 'item code', 'product code', 'part_number', 'part number'],

    // Serial number (row number, index) - lower priority
    serial_number: ['s/n', 'sn', 'serial', 'no', 'number', '#', 'index'],

    // Quantity variations
    quantity: ['quantity', 'qty', 'stock', 'amount', 'count', 'inv', 'inventory'],

    // Category variations
    category: ['category', 'type', 'group', 'class', 'classification'],

    // Description variations
    description: ['description', 'desc', 'details', 'notes', 'info'],

    // Location fields
    branch: ['branch', 'location', 'store', 'warehouse', 'site'],
    shelf: ['shelf', 'rack', 'shelves', 'shelf_number', 'shelf number'],
    row: ['row', 'level', 'tier'],
    column: ['column', 'col', 'position', 'slot'],
    box: ['box', 'bin', 'container', 'unit']
};

/**
 * Normalize a header string for matching
 */
function normalizeHeader(header) {
    if (!header) return '';
    return String(header)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Map actual column headers to standardized field names
 * Priority system: SKU field takes precedence over S/N when both exist
 */
function mapHeaders(rawHeaders) {
    const headerMap = {};
    const normalizedHeaders = rawHeaders.map(h => ({
        original: h,
        normalized: normalizeHeader(h)
    }));

    // First pass: Find SKU field (highest priority for unique identifier)
    const skuVariations = COLUMN_MAPPINGS.sku;
    for (const variation of skuVariations) {
        const normalizedVariation = normalizeHeader(variation);
        const match = normalizedHeaders.find(h => h.normalized === normalizedVariation);

        if (match) {
            headerMap.sku = match.original;
            break;
        }
    }

    // Second pass: Map all other fields (excluding sku and serial_number for now)
    Object.keys(COLUMN_MAPPINGS).forEach(standardField => {
        if (standardField === 'sku' || standardField === 'serial_number') return; // Skip, handled separately

        const variations = COLUMN_MAPPINGS[standardField];

        for (const variation of variations) {
            const normalizedVariation = normalizeHeader(variation);
            const match = normalizedHeaders.find(h => h.normalized === normalizedVariation);

            if (match) {
                headerMap[standardField] = match.original;
                break;
            }
        }
    });

    // Third pass: If no SKU found, try serial_number as fallback
    if (!headerMap.sku) {
        const serialVariations = COLUMN_MAPPINGS.serial_number;
        for (const variation of serialVariations) {
            const normalizedVariation = normalizeHeader(variation);
            const match = normalizedHeaders.find(h => h.normalized === normalizedVariation);

            if (match) {
                headerMap.sku = match.original; // Map serial_number to sku field
                console.warn('[GoogleSheets] No SKU column found. Using S/N column as identifier.');
                break;
            }
        }
    }

    console.log('[GoogleSheets] Header mapping:', headerMap);
    return headerMap;
}

/**
 * Extract value from row using header mapping
 */
function getFieldValue(row, headers, headerMap, standardField) {
    const actualHeader = headerMap[standardField];
    if (!actualHeader) return '';

    const headerIndex = headers.indexOf(actualHeader);
    if (headerIndex === -1) return '';

    return row[headerIndex] ? String(row[headerIndex]).trim() : '';
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function getCurrentSheetId() {
    if (store) {
        const state = store.getState();
        const dynamicId = state.config?.sheetId;
        if (dynamicId) return dynamicId;
    }
    return GSHEET_ID || null;
}

function extractFileId(input) {
    if (!input) return '';
    if (!input.includes('drive.google.com') && !input.includes('docs.google.com')) {
        return input;
    }
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/
    ];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    return input;
}

function detectSourceType(source) {
    if (!source) return null;
    if (source.includes('drive.google.com') || source.includes('docs.google.com')) {
        if (source.includes('spreadsheets')) return 'google_sheet';
        return 'excel_file';
    }
    if (source.endsWith('.xlsx') || source.endsWith('.xls')) return 'excel_file';
    return 'google_sheet';
}

async function getFileMimeType(fileId) {
    await envPromise;
    try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType&key=${GSHEETS_API_KEY}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            return data.mimeType;
        }
    } catch (error) {
        console.warn('Error checking file metadata:', error);
    }
    return null;
}

// ---------------------------------------------------------
// Core Fetchers
// ---------------------------------------------------------

async function fetchExcelFromDrive(fileId) {
    await envPromise;
    try {
        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GSHEETS_API_KEY}`;
        let response = await fetch(driveUrl);

        if (!response.ok) {
            const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            response = await fetch(publicUrl);
        }

        if (!response.ok) throw new Error(`Failed to download file (Status: ${response.status})`);

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error('Downloaded file is empty');
        if (typeof XLSX === 'undefined') throw new Error("XLSX library not found");

        return XLSX.read(arrayBuffer, { type: 'array' });
    } catch (error) {
        console.error('Error fetching Excel file:', error);
        return null;
    }
}

// ---------------------------------------------------------
// Parsers with Flexible Column Mapping
// ---------------------------------------------------------

function parseProductsFromExcel(workbook) {
    let sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('product')) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (rawData.length === 0) return [];

    const rawHeaders = rawData[0];
    const headerMap = mapHeaders(rawHeaders);

    return rawData.slice(1).map(row => {
        const product = {};

        // Map each standard field
        Object.keys(COLUMN_MAPPINGS).forEach(standardField => {
            const value = getFieldValue(row, rawHeaders, headerMap, standardField);
            product[standardField] = value;
        });

        return product;
    }).filter(p => p.sku); // Only include rows with SKU
}

function parseLocationsFromExcel(workbook) {
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('location'));
    if (!sheetName) {
        const products = parseProductsFromExcel(workbook);
        return parseLocationsFromProducts(products);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (rawData.length === 0) return [];

    const rawHeaders = rawData[0];
    const headerMap = mapHeaders(rawHeaders);

    return rawData.slice(1).map(row => {
        const location = {};

        // Map location fields
        ['sku', 'branch', 'shelf', 'row', 'column', 'box'].forEach(field => {
            location[field] = getFieldValue(row, rawHeaders, headerMap, field);
        });

        return location;
    }).filter(l => l.sku && l.branch && l.shelf);
}

function parseLocationsFromProducts(products) {
    const locations = [];
    products.forEach(product => {
        if (product.branch && product.shelf) {
            locations.push({
                sku: product.sku,
                branch: product.branch,
                shelf: product.shelf,
                row: product.row || '',
                column: product.column || '',
                box: product.box || ''
            });
        }
    });
    return locations;
}

// ---------------------------------------------------------
// Main Exported Functions
// ---------------------------------------------------------

export async function testSheetConnection(sheetId = null) {
    await envPromise;
    try {
        const id = sheetId || getCurrentSheetId();
        if (!id || !GSHEETS_API_KEY) throw new Error('Missing Sheet ID or API Key in configuration');

        const fileId = extractFileId(id);
        let sourceType = detectSourceType(id);
        const mimeType = await getFileMimeType(fileId);

        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') sourceType = 'excel_file';

        if (sourceType === 'excel_file') {
            const workbook = await fetchExcelFromDrive(fileId);
            if (!workbook) throw new Error("Failed to download Excel file.");
            return {
                success: true,
                sheetTitle: 'Excel File',
                sheetId: fileId,
                sourceType: 'excel_file',
                sheets: workbook.SheetNames.map(name => ({ title: name, sheetId: name }))
            };
        }

        const url = `${GSHEETS_API_BASE}/${id}?key=${GSHEETS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch sheet');

        return {
            success: true,
            sheetTitle: data.properties?.title,
            sheetId: data.spreadsheetId,
            sourceType: 'google_sheet',
            sheets: data.sheets?.map(s => ({
                title: s.properties?.title,
                sheetId: s.properties?.sheetId,
                gridProperties: s.properties?.gridProperties
            })) || []
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function fetchProducts(sheetId = null) {
    await envPromise;
    try {
        const id = sheetId || getCurrentSheetId();

        if (!id || !GSHEETS_API_KEY) throw new Error('Missing Sheet ID or API Key');

        const fileId = extractFileId(id);
        let sourceType = detectSourceType(id);
        const mimeType = await getFileMimeType(fileId);

        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') sourceType = 'excel_file';

        if (sourceType === 'excel_file') {
            const workbook = await fetchExcelFromDrive(fileId);
            if (workbook) return parseProductsFromExcel(workbook);
        }

        // Google Sheets Logic
        const metaUrl = `${GSHEETS_API_BASE}/${id}?key=${GSHEETS_API_KEY}`;
        const metaResponse = await fetch(metaUrl);
        const metaData = await metaResponse.json();
        if (!metaResponse.ok) throw new Error(metaData.error?.message || 'Failed to fetch sheet metadata');

        const sheets = metaData.sheets || [];
        const productsSheet = sheets.find(s => s.properties?.title?.toLowerCase().includes('product')) || sheets[0];
        const sheetName = productsSheet.properties?.title || 'Sheet1';

        const valuesUrl = `${GSHEETS_API_BASE}/${id}/values/${encodeURIComponent(sheetName)}?key=${GSHEETS_API_KEY}`;
        const valuesResponse = await fetch(valuesUrl);
        const valuesData = await valuesResponse.json();
        const rows = valuesData.values || [];

        if (rows.length === 0) return [];

        const rawHeaders = rows[0];
        const headerMap = mapHeaders(rawHeaders);

        return rows.slice(1).map(row => {
            const product = {};

            // Map each standard field
            Object.keys(COLUMN_MAPPINGS).forEach(standardField => {
                const value = getFieldValue(row, rawHeaders, headerMap, standardField);
                product[standardField] = value;
            });

            return product;
        }).filter(p => p.sku);
    } catch (error) {
        console.error('[GoogleSheets] Error fetching products:', error);
        throw error;
    }
}

export async function fetchLocations(sheetId = null) {
    await envPromise;
    try {
        const id = sheetId || getCurrentSheetId();
        if (!id || !GSHEETS_API_KEY) throw new Error('Missing Sheet ID or API Key');

        const fileId = extractFileId(id);
        let sourceType = detectSourceType(id);
        const mimeType = await getFileMimeType(fileId);

        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') sourceType = 'excel_file';

        // 1. Excel File Logic
        if (sourceType === 'excel_file') {
            const workbook = await fetchExcelFromDrive(fileId);
            if (workbook) return parseLocationsFromExcel(workbook);
        }

        // 2. Google Sheets Logic
        const metaUrl = `${GSHEETS_API_BASE}/${id}?key=${GSHEETS_API_KEY}`;
        const metaResponse = await fetch(metaUrl);
        const metaData = await metaResponse.json();

        if (!metaResponse.ok) throw new Error('Failed to fetch sheet metadata');

        const sheets = metaData.sheets || [];
        const locationsSheet = sheets.find(s => s.properties?.title?.toLowerCase().includes('location'));

        // 3. Fallback: If no Location tab, parse from Products
        if (!locationsSheet) {
            console.warn('[GoogleSheets] No "Location" tab found. Parsing locations from Products list...');
            const products = await fetchProducts(id);
            return parseLocationsFromProducts(products);
        }

        // 4. Fetch the Location Tab
        const sheetName = locationsSheet.properties?.title;

        const valuesUrl = `${GSHEETS_API_BASE}/${id}/values/${encodeURIComponent(sheetName)}?key=${GSHEETS_API_KEY}`;
        const valuesResponse = await fetch(valuesUrl);
        const valuesData = await valuesResponse.json();
        const rows = valuesData.values || [];

        if (rows.length === 0) return [];

        const rawHeaders = rows[0];
        const headerMap = mapHeaders(rawHeaders);

        const locations = rows.slice(1).map(row => {
            const location = {};

            // Map location fields
            ['sku', 'branch', 'shelf', 'row', 'column', 'box'].forEach(field => {
                location[field] = getFieldValue(row, rawHeaders, headerMap, field);
            });

            return location;
        }).filter(l => l.sku && l.branch && l.shelf);

        return locations;

    } catch (error) {
        console.error('Error fetching locations:', error);
        throw error;
    }
}

export function buildShelves(locations) {
    const shelvesMap = new Map();
    locations.forEach(location => {
        const branch = location.branch?.trim();
        const shelf = location.shelf?.trim();
        const row = location.row?.trim();
        const column = location.column?.trim()?.toUpperCase();
        const sku = location.sku?.trim();

        if (!branch || !shelf || !sku) return;

        const shelfKey = `${branch}-${shelf}`;
        if (!shelvesMap.has(shelfKey)) {
            shelvesMap.set(shelfKey, {
                id: shelfKey,
                name: `${branch} - Shelf ${shelf}`,
                branch,
                shelfNumber: shelf,
                boxes: new Map(),
                maxRow: 0,
                maxColumn: 0
            });
        }

        const shelfData = shelvesMap.get(shelfKey);
        if (row) {
            const rowNum = parseInt(row);
            if (!isNaN(rowNum)) shelfData.maxRow = Math.max(shelfData.maxRow, rowNum);
        }
        if (column) {
            const colNum = column.charCodeAt(0) - 64;
            if (colNum > 0) shelfData.maxColumn = Math.max(shelfData.maxColumn, colNum);
        }

        const position = row && column ? `${row}${column}` : location.box || 'unknown';
        const boxKey = `${shelfKey}-${position}`;
        if (!shelfData.boxes.has(boxKey)) {
            shelfData.boxes.set(boxKey, {
                id: boxKey,
                boxNumber: location.box || position,
                row: row ? parseInt(row) : null,
                column,
                position,
                products: []
            });
        }
        const boxData = shelfData.boxes.get(boxKey);
        if (!boxData.products.includes(sku)) boxData.products.push(sku);
    });

    return Array.from(shelvesMap.values())
        .map(shelf => ({
            ...shelf,
            boxes: Array.from(shelf.boxes.values()).sort((a, b) => {
                if (a.row !== null && b.row !== null) {
                    if (a.row !== b.row) return a.row - b.row;
                    return (a.column || '').localeCompare(b.column || '');
                }
                return a.position.localeCompare(b.position);
            })
        }))
        .sort((a, b) => {
            if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
            const aNum = parseInt(a.shelfNumber);
            const bNum = parseInt(b.shelfNumber);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.shelfNumber.localeCompare(b.shelfNumber);
        });
}

export function searchProducts(products, query) {
    if (!query.trim()) return products;
    const lowerQuery = query.toLowerCase();
    return products.filter(product =>
        (product.sku?.toLowerCase() || '').includes(lowerQuery) ||
        (product.product_name?.toLowerCase() || '').includes(lowerQuery) ||
        (product.category?.toLowerCase() || '').includes(lowerQuery) ||
        (product.description?.toLowerCase() || '').includes(lowerQuery)
    );
}

export function findProductLocations(locations, sku) {
    return locations.filter(l => l.sku === sku).map(l => ({
        branch: l.branch,
        shelf: l.shelf,
        row: l.row,
        column: l.column,
        box: l.box,
        position: l.row && l.column ? `${l.row}${l.column}` : l.box,
        shelfName: `${l.branch} - Shelf ${l.shelf}`,
        shelfId: `${l.branch}-${l.shelf}`
    }));
}