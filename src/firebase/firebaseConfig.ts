import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
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

// Initialize Firestore with IndexedDB persistent local cache (multi-tab safe)
const hasNamedDatabase =
  Boolean(firebaseConfig.firestoreDatabaseId) &&
  firebaseConfig.firestoreDatabaseId.trim() !== '' &&
  firebaseConfig.firestoreDatabaseId !== '(default)';

function createFirestoreInstance(): Firestore {
  const localCache = persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  });
  const settings = {
    localCache,
    experimentalAutoDetectLongPolling: true
  };
  try {
    return hasNamedDatabase
      ? initializeFirestore(app, settings, firebaseConfig.firestoreDatabaseId)
      : initializeFirestore(app, settings);
  } catch {
    return hasNamedDatabase
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
}

export const db = createFirestoreInstance();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Auto-authenticate anonymously to support authenticated rules (handles disabled state gracefully)
signInAnonymously(auth).catch((err) => {
  console.info('Firebase anonymous auth status (optional):', err.message);
});

export type FirestoreConnectionStatus = 'connecting' | 'connected' | 'offline' | 'quota_exceeded';

let currentFirestoreStatus: FirestoreConnectionStatus =
  typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting';
const firestoreStatusListeners = new Set<(status: FirestoreConnectionStatus) => void>();

function setFirestoreStatus(next: FirestoreConnectionStatus): void {
  if (currentFirestoreStatus === next) return;
  currentFirestoreStatus = next;
  firestoreStatusListeners.forEach((cb) => {
    try {
      cb(next);
    } catch {
      // Ignore listener error
    }
  });
}

export function getFirestoreStatus(): FirestoreConnectionStatus {
  return currentFirestoreStatus;
}

export function isFirestoreQuotaExceeded(): boolean {
  return currentFirestoreStatus === 'quota_exceeded';
}

export function subscribeFirestoreStatus(
  listener: (status: FirestoreConnectionStatus) => void
): () => void {
  firestoreStatusListeners.add(listener);
  listener(currentFirestoreStatus);
  return () => {
    firestoreStatusListeners.delete(listener);
  };
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: string }).code || '').toLowerCase();
  const msg = String((err as { message?: string }).message || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted')
  );
}

export function reportFirestoreError(err: unknown): void {
  if (isQuotaExceededError(err)) {
    setFirestoreStatus('quota_exceeded');
    return;
  }
  const code = String((err as { code?: string }).code || '').toLowerCase();
  const msg = String((err as { message?: string }).message || '').toLowerCase();
  if (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore')
  ) {
    if (currentFirestoreStatus !== 'quota_exceeded') {
      setFirestoreStatus('offline');
    }
  }
}

export function reportFirestoreConnected(): void {
  setFirestoreStatus('connected');
}

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setFirestoreStatus('offline');
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    setFirestoreStatus('connected');
    console.info('Firebase Firestore connected successfully to project:', firebaseConfig.projectId);
    return true;
  } catch (error: unknown) {
    reportFirestoreError(error);
    const msg = error instanceof Error ? error.message : String(error);
    if (isQuotaExceededError(error)) {
      console.warn('Firestore daily Spark quota exceeded. Operating with local cache until quota resets.');
    } else if (msg.includes('the client is offline')) {
      console.warn('Firebase client is offline or network issue:', msg);
    } else {
      console.info('Firestore handshake:', msg);
    }
    return false;
  }
}

// Run test connection
testFirestoreConnection();
