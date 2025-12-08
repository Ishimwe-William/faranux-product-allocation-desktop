/* ============================================
   firebase.js - Firebase Integration (UPDATED)
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

let app, auth, db, googleProvider; // ✅ NEW: Added googleProvider
let isInitialized = false;
let unsubscribeConfig = null;

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

        if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_')) {
            throw new Error('Firebase configuration not properly set.');
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

        await loadFirebaseConfig();

        if (!window.firebase) {
            throw new Error('Firebase SDK not loaded.');
        }

        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        // ✅ NEW: Initialize Google Provider with Scopes
        googleProvider = new firebase.auth.GoogleAuthProvider();
        // CRITICAL: Request permission to read sheets for domain-restricted access
        googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
        // Optional: If accessing Excel files from Drive, add this too:
        googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

        isInitialized = true;

        auth.onAuthStateChanged(user => {
            if (user) {
                store.setUser({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                });

                if (unsubscribeConfig) {
                    unsubscribeConfig();
                }

                unsubscribeConfig = subscribeToConfig((config) => {
                    // Config updates handled in subscribeToConfig
                });

            } else {
                store.setUser(null);
                // ✅ NEW: Clear the token on sign out
                store.setGoogleToken(null);

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

// Sign in (Email/Password)
export async function signIn(email, password) {
    try {
        if (!auth) throw new Error('Firebase not initialized.');
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        throw formatAuthError(error);
    }
}

// ✅ NEW: Sign in with Google (OAuth)
export async function signInWithGoogle() {
    try {
        if (!auth) throw new Error('Firebase not initialized.');

        // Triggers the Google sign-in popup
        const result = await auth.signInWithPopup(googleProvider);

        // Get the OAuth token needed for Sheets API access
        const credential = result.credential;
        const token = credential.accessToken;

        // Save token to store for use in googleSheets.js
        store.setGoogleToken(token);

        return result.user;
    } catch (error) {
        console.error('Google Sign In Error:', error);
        throw formatAuthError(error);
    }
}

// Sign up
export async function signUp(email, password) {
// ... (rest of signUp function remains the same)
    try {
        if (!auth) throw new Error('Firebase not initialized.');
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        throw formatAuthError(error);
    }
}

// Sign out
export async function signOut() {
// ... (rest of signOut function remains the same)
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
}

export function getCurrentUser() {
    return auth.currentUser;
}

function formatAuthError(error) {
    const errorMap = {
        'auth/invalid-email': 'Invalid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'Email not found.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'Email already registered.',
        'auth/popup-closed-by-user': 'Sign in popup was closed.',
        'auth/cancelled-popup-request': 'Only one popup request allowed at a time.'
    };

    const message = errorMap[error.code] || error.message || 'Authentication failed.';
    const err = new Error(message);
    err.code = error.code;
    return err;
}

export async function loadAppConfig() {
// ... (this function remains the same)
    try {
        const configDoc = await db.collection('settings').doc('app_config').get();
        if (configDoc.exists) {
            store.setConfig(configDoc.data());
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

export async function updateSheetId(sheetId, userEmail) {
// ... (this function remains the same)
    try {
        const config = {
            sheetId,
            sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
            lastUpdated: new Date().toISOString(),
            updatedBy: userEmail
        };

        await db.collection('settings').doc('app_config').set(config, { merge: true });
        store.setConfig(config);
        return config;
    } catch (error) {
        console.error('Error updating sheet ID:', error);
        throw error;
    }
}

export function subscribeToConfig(callback) {
// ... (this function remains the same)
    return db.collection('settings').doc('app_config').onSnapshot(
        doc => {
            if (doc.exists) {
                const config = doc.data();
                store.setConfig(config);
                if (callback) callback(config);
            }
        },
        error => {
            console.error('Config subscription error:', error);
        }
    );
}