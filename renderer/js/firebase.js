/* ============================================
   firebase.js - Firebase Integration
   ============================================ */

import { store } from './store.js';

// Firebase configuration will be loaded from environment
let firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app, auth, db;
let isInitialized = false;
let unsubscribeConfig = null; // FIX: Variable to hold the real-time listener

/**
 * Load Firebase configuration from environment variables
 */
async function loadFirebaseConfig() {
  try {
    // Try to get from Electron API
    if (window.electronAPI && window.electronAPI.getEnv) {
      const env = await window.electronAPI.getEnv();
      firebaseConfig = {
        apiKey: env.FIREBASE_API_KEY,
        authDomain: env.FIREBASE_AUTH_DOMAIN,
        projectId: env.FIREBASE_PROJECT_ID,
        storageBucket: env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
        appId: env.FIREBASE_APP_ID
      };
    }

    // Validate configuration
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_')) {
      throw new Error('Firebase configuration not properly set. Please check your .env file and environment variables.');
    }

    return firebaseConfig;
  } catch (error) {
    console.error('Firebase config loading error:', error);
    throw error;
  }
}

// Initialize Firebase
export async function initializeFirebase() {
  try {
    if (isInitialized) {
      return { app, auth, db };
    }

    // Load configuration first
    await loadFirebaseConfig();

    if (!window.firebase) {
      throw new Error('Firebase SDK not loaded. Check if Firebase scripts are included in HTML.');
    }

    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    isInitialized = true;

    auth.onAuthStateChanged(user => {
      if (user) {
        store.setUser({
          uid: user.uid,
          email: user.email
        });

        // FIX: Switch from one-time load to real-time subscription
        if (unsubscribeConfig) {
          unsubscribeConfig(); // Cleanup any existing listener
        }

        unsubscribeConfig = subscribeToConfig((config) => {

        });

      } else {
        store.setUser(null);

        // FIX: Clean up listener on logout to prevent memory leaks/errors
        if (unsubscribeConfig) {
          unsubscribeConfig();
          unsubscribeConfig = null;
        }
      }
    });

    return { app, auth, db };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

// Sign in
export async function signIn(email, password) {
  try {
    if (!auth) {
      throw new Error('Firebase not initialized. Please reload the app.');
    }
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Sign in error:', error.code, error.message);
    throw formatAuthError(error);
  }
}

// Sign up
export async function signUp(email, password) {
  try {
    if (!auth) {
      throw new Error('Firebase not initialized. Please reload the app.');
    }
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Sign up error:', error.code, error.message);
    throw formatAuthError(error);
  }
}

// Sign out
export async function signOut() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Get current user
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Format Firebase authentication errors into user-friendly messages
 */
function formatAuthError(error) {
  const errorMap = {
    'auth/invalid-email': 'Invalid email address. Please check and try again.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/user-not-found': 'Email not found. Please sign up or check your email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'This email is already registered. Please sign in or use a different email.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/operation-not-allowed': 'Email/password authentication is not enabled. Contact support.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
  };

  const message = errorMap[error.code] || error.message || 'Authentication failed. Please try again.';
  const err = new Error(message);
  err.code = error.code;
  return err;
}

// Load app configuration from Firestore (One-time fetch)
export async function loadAppConfig() {
  try {
    const configDoc = await db.collection('settings').doc('app_config').get();
    if (configDoc.exists) {
      store.setConfig(configDoc.data());
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Update Sheet ID in Firestore
export async function updateSheetId(sheetId, userEmail) {
  try {
    const config = {
      sheetId,
      sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
      lastUpdated: new Date().toISOString(),
      updatedBy: userEmail
    };

    await db.collection('settings').doc('app_config').set(config, { merge: true });
    // Note: No need to manually update store here if subscription is active,
    // but keeping it ensures UI updates instantly even if offline
    store.setConfig(config);
    return config;
  } catch (error) {
    console.error('Error updating sheet ID:', error);
    throw error;
  }
}

// Subscribe to config changes
export function subscribeToConfig(callback) {
  // Ensure we are connected to the correct document
  return db.collection('settings').doc('app_config').onSnapshot(
      doc => {
        if (doc.exists) {
          const config = doc.data();
          // This line is crucial: it pushes the new data to the global Store
          store.setConfig(config);
          if (callback) callback(config);
        }
      },
      error => {
        console.error('Config subscription error:', error);
      }
  );
}