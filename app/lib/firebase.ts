import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase config
const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.apiKey !== 'your-api-key-here' &&
    firebaseConfig.projectId !== 'your-project-id'
  );
};

// Initialize Firebase only if config is valid
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // In development, show helpful error
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.error(
      '⚠️ Firebase is not configured. Please set up your Firebase environment variables in .env.local'
    );
  }
}

/**
 * Signs out the user and clears all browser cache/storage
 * This ensures users can switch accounts on next sign-in
 */
export async function signOutAndClearCache(authInstance: Auth | null): Promise<void> {
  if (!authInstance) {
    return;
  }

  try {
    // Sign out from Firebase
    await firebaseSignOut(authInstance);
  } catch (error) {
    console.error('Error signing out:', error);
  }

  // Clear all browser storage
  if (typeof window !== 'undefined') {
    try {
      // Clear localStorage (Firebase stores auth state here)
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear IndexedDB if available (Firebase may use it)
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map(db => {
              if (db.name) {
                return new Promise<void>((resolve, reject) => {
                  const deleteReq = indexedDB.deleteDatabase(db.name!);
                  deleteReq.onsuccess = () => resolve();
                  deleteReq.onerror = () => reject(deleteReq.error);
                  deleteReq.onblocked = () => resolve(); // Resolve even if blocked
                });
              }
            })
          );
        } catch (error) {
          // IndexedDB clearing is best effort
          console.warn('Could not clear all IndexedDB databases:', error);
        }
      }
    } catch (error) {
      console.error('Error clearing browser storage:', error);
    }
    
    // Reload the page to ensure clean state
    window.location.href = '/';
  }
}

export { auth, db };
export default app;

