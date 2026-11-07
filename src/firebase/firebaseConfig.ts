import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import configData from '../../firebase-applet-config.json';

// Read active config (with optional localStorage override for flexible in-app configuration)
const getActiveConfig = () => {
  try {
    const saved = localStorage.getItem('custom_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.projectId === configData.projectId && parsed.apiKey) {
        return { ...configData, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Error reading custom firebase config from localStorage:', e);
  }
  return configData;
};

export const firebaseConfig = getActiveConfig();

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID if specified and not '(default)'
export const db = 
  firebaseConfig.firestoreDatabaseId && 
  firebaseConfig.firestoreDatabaseId.trim() !== '' && 
  firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Auto-authenticate anonymously to support authenticated rules (handles disabled state gracefully)
signInAnonymously(auth).catch((err) => {
  console.info('Firebase anonymous auth status (optional):', err.message);
});

export function saveCustomFirebaseConfig(newConfig: Partial<typeof configData>): void {
  try {
    const merged = { ...firebaseConfig, ...newConfig };
    localStorage.setItem('custom_firebase_config', JSON.stringify(merged));
    window.location.reload();
  } catch (e) {
    console.error('Failed to save custom firebase config:', e);
  }
}

export function resetToDefaultFirebaseConfig(): void {
  try {
    localStorage.removeItem('custom_firebase_config');
    window.location.reload();
  } catch (e) {
    console.error('Failed to reset firebase config:', e);
  }
}

// Test Connection to Firestore (Skill Mandatory Requirement)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.info('Firebase Firestore connected successfully to project:', firebaseConfig.projectId);
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network issue:', error.message);
    } else {
      console.info('Firestore handshake:', error.message);
    }
    return false;
  }
}

// Run test connection
testFirestoreConnection();
