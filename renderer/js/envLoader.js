/* ============================================
   envLoader.js - Environment Variable Loader
   ============================================ */

/**
 * Load environment variables from the main process
 * Works with both Electron and Electron Fiddle
 */
export async function loadEnv() {
  try {
    // Try to get env from preload/IPC
    if (window.__ENV__) {
      return window.__ENV__;
    }

    // Fallback for development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using fallback environment variables');
      return {
        FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
        FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
        FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
        DEBUG: process.env.DEBUG === 'true',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
      };
    }

    throw new Error('Environment variables not available');
  } catch (error) {
    console.error('Failed to load environment:', error);
    throw error;
  }
}

/**
 * Get a specific environment variable
 */
export function getEnv(key, defaultValue = null) {
  try {
    const env = window.__ENV__ || process.env;
    return env[key] || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Check if a variable exists
 */
export function hasEnv(key) {
  try {
    const env = window.__ENV__ || process.env;
    return key in env && env[key] !== '';
  } catch {
    return false;
  }
}

/**
 * Validate Firebase configuration
 */
export function validateFirebaseConfig(config) {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missing = requiredFields.filter(field => !config[field]);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase config fields: ${missing.join(', ')}`);
  }

  return true;
}
