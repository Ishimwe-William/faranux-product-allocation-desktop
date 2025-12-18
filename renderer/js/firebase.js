/* ============================================
   firebase.js - Firebase Integration
   ============================================ */

import { store } from './store.js';

let firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let app, auth, db, googleProvider;
let isInitialized = false;
let unsubscribeConfig = null;

async function loadFirebaseConfig() {
    try {
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

        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
        googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

        isInitialized = true;

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                store.setUser({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                });

                // Try to get a fresh token if user is logged in
                const state = store.getState();
                if (!state.auth.googleAccessToken) {
                    try {
                        const result = await auth.currentUser.getIdTokenResult();
                        if (result && result.signInProvider === 'google.com') {
                            // User signed in with Google but token not in storage
                            console.log('[Auth] Google user detected, token may have expired');
                        }
                    } catch (e) {
                        console.warn('[Auth] Could not verify sign-in provider:', e);
                    }
                }

                if (unsubscribeConfig) {
                    unsubscribeConfig();
                }

                unsubscribeConfig = subscribeToConfig((config) => {
                    // Config updates handled in subscribeToConfig
                });

            } else {
                store.setUser(null);
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

export async function signIn(email, password) {
    try {
        if (!auth) throw new Error('Firebase not initialized.');
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        throw formatAuthError(error);
    }
}

export async function signInWithGoogle() {
    try {
        if (!auth) throw new Error('Firebase not initialized.');

        // 1. Get Client ID from Environment
        // You can also hardcode it here for testing if you haven't set up .env yet
        const env = await window.electronAPI.getEnv();
        const clientId = env.GOOGLE_CLIENT_ID;

        if (!clientId) {
            throw new Error('Google Client ID is missing in .env configuration');
        }

        // 2. Trigger System Browser Login via Main Process
        // This opens Chrome, user logs in, and Main process returns the tokens
        const tokens = await window.electronAPI.loginGoogle(clientId);

        if (!tokens || !tokens.id_token) {
            throw new Error('Failed to receive tokens from Google Login');
        }

        // 3. Create Firebase Credential using the manual tokens
        const credential = firebase.auth.GoogleAuthProvider.credential(
            tokens.id_token,
            tokens.access_token
        );

        // 4. Sign in to Firebase with that credential
        const result = await auth.signInWithCredential(credential);

        // 5. Store token for Sheet access (same as before)
        store.setGoogleToken(tokens.access_token);

        return result.user;

    } catch (error) {
        console.error('Google Sign In Error:', error);
        throw error; // This will be caught by auth.js and shown in the UI
    }
}

export async function signUp(email, password) {
    try {
        if (!auth) throw new Error('Firebase not initialized.');
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        throw formatAuthError(error);
    }
}

export async function signOut() {
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
    try {
        const config = store.getState().config;
        const updatedConfig = {
            ...config,
            sheetId,
            sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
            lastUpdated: new Date().toISOString(),
            updatedBy: userEmail
        };

        await db.collection('settings').doc('app_config').set(updatedConfig, { merge: true });
        store.setConfig(updatedConfig);
        return updatedConfig;
    } catch (error) {
        console.error('Error updating sheet ID:', error);
        throw error;
    }
}

// WooCommerce Configuration
export async function updateWooConfig(wooConfig, userEmail) {
    try {
        const config = store.getState().config;
        const updatedConfig = {
            ...config,
            woocommerce: {
                ...wooConfig,
                lastUpdated: new Date().toISOString(),
                updatedBy: userEmail
            }
        };

        await db.collection('settings').doc('app_config').set(updatedConfig, { merge: true });
        store.setConfig(updatedConfig);
        return updatedConfig;
    } catch (error) {
        console.error('Error updating WooCommerce config:', error);
        throw error;
    }
}

export function subscribeToConfig(callback) {
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