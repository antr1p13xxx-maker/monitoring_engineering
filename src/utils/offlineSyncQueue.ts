import { useEffect, useState } from 'react';

export type OfflineMutationType =
  | 'checklist_update'
  | 'project_save'
  | 'project_delete'
  | 'kpi_save'
  | 'standart_part_save'
  | 'approval_save'
  | 'audit_log_save'
  | 'chat_send';

export interface OfflineMutationItem {
  id: string;
  coalesceKey: string;
  type: OfflineMutationType;
  label: string;
  payload: Record<string, any>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface OfflineSyncSnapshot {
  pendingItems: OfflineMutationItem[];
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedCount: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

type MutationExecutor = (item: OfflineMutationItem) => Promise<void>;

const DB_NAME = 'eng_offline_sync_db';
const DB_VERSION = 1;
const STORE_MUTATIONS = 'pending_mutations';
const STORE_SNAPSHOTS = 'cached_snapshots';
const BG_SYNC_TAG = 'eng-firestore-sync';

let registeredExecutor: MutationExecutor | null = null;
let runtimeStarted = false;
let isFlushing = false;
let lastSyncedCountState = 0;
let lastSyncedAtState: string | null = null;
let lastSyncErrorState: string | null = null;
let clearSyncedBannerTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<(snap: OfflineSyncSnapshot) => void>();

function openSyncDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        const store = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id' });
        store.createIndex('by_coalesce', 'coalesceKey', { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB'));
  });
}

export async function getAllPendingMutations(): Promise<OfflineMutationItem[]> {
  try {
    const db = await openSyncDb();
    return await new Promise<OfflineMutationItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, 'readonly');
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as OfflineMutationItem[];
        items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('IndexedDB getAllPendingMutations fallback:', err);
    return [];
  }
}

async function notifyListeners(): Promise<void> {
  const pendingItems = await getAllPendingMutations();
  const snapshot: OfflineSyncSnapshot = {
    pendingItems,
    pendingCount: pendingItems.length,
    isSyncing: isFlushing,
    lastSyncedCount: lastSyncedCountState,
    lastSyncedAt: lastSyncedAtState,
    lastSyncError: lastSyncErrorState,
  };
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (e) {
      console.error(e);
    }
  });
}

async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (syncManager && typeof syncManager.register === 'function') {
      await syncManager.register(BG_SYNC_TAG);
    }
  } catch (err) {
    console.debug('Service Worker Background Sync registration skipped:', err);
  }
}

export async function enqueueOfflineMutation(input: {
  type: OfflineMutationType;
  coalesceKey: string;
  label: string;
  payload: Record<string, any>;
}): Promise<OfflineMutationItem> {
  const nowIso = new Date().toISOString();
  const item: OfflineMutationItem = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    coalesceKey: input.coalesceKey,
    type: input.type,
    label: input.label,
    payload: input.payload,
    createdAt: nowIso,
    retryCount: 0,
  };

  try {
    const db = await openSyncDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const index = store.index('by_coalesce');
      const existingReq = index.getAll(input.coalesceKey);

      existingReq.onsuccess = () => {
        const matches = (existingReq.result || []) as OfflineMutationItem[];
        matches.forEach((old) => {
          store.delete(old.id);
        });
        store.put(item);
      };
      existingReq.onerror = () => {
        store.put(item);
      };

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB enqueue failed:', err);
  }

  lastSyncErrorState = null;
  await notifyListeners();
  await registerBackgroundSync();
  return item;
}

async function removeMutationById(id: string): Promise<void> {
  try {
    const db = await openSyncDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      tx.objectStore(STORE_MUTATIONS).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB removeMutationById error:', err);
  }
}

async function updateMutationFailure(item: OfflineMutationItem, errMsg: string): Promise<void> {
  try {
    const db = await openSyncDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      tx.objectStore(STORE_MUTATIONS).put({
        ...item,
        retryCount: (item.retryCount || 0) + 1,
        lastError: errMsg,
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB updateMutationFailure error:', err);
  }
}

export function isNetworkOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!error) return false;
  const code = String((error as any).code || '').toLowerCase();
  const msg = String((error as any).message || error).toLowerCase();
  return (
    code.includes('unavailable') ||
    code.includes('network') ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('unavailable') ||
    msg.includes('transport errored')
  );
}

export function registerOfflineSyncExecutor(executor: MutationExecutor): void {
  registeredExecutor = executor;
}

export async function flushOfflineMutations(): Promise<{ synced: number; remaining: number }> {
  if (isFlushing || !registeredExecutor) {
    const items = await getAllPendingMutations();
    return { synced: 0, remaining: items.length };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const items = await getAllPendingMutations();
    return { synced: 0, remaining: items.length };
  }

  const queue = await getAllPendingMutations();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  isFlushing = true;
  lastSyncErrorState = null;
  await notifyListeners();

  let synced = 0;

  try {
    for (const item of queue) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break;
      }
      try {
        await registeredExecutor(item);
        await removeMutationById(item.id);
        synced += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateMutationFailure(item, msg);
        if (isNetworkOfflineError(err)) {
          lastSyncErrorState = 'Koneksi terputus kembali saat sinkronisasi.';
          break;
        }
        // Keep item or drop permanent validation error after 5 retries
        if (item.retryCount >= 5) {
          await removeMutationById(item.id);
        }
        lastSyncErrorState = msg;
      }
    }
  } finally {
    isFlushing = false;
    const remainingItems = await getAllPendingMutations();

    if (synced > 0) {
      lastSyncedCountState = synced;
      lastSyncedAtState = new Date().toISOString();
      if (clearSyncedBannerTimer) clearTimeout(clearSyncedBannerTimer);
      clearSyncedBannerTimer = setTimeout(() => {
        lastSyncedCountState = 0;
        notifyListeners();
      }, 5000);
    }

    await notifyListeners();
    return { synced, remaining: remainingItems.length };
  }
}

export function initOfflineSyncRuntime(): () => void {
  if (runtimeStarted || typeof window === 'undefined') {
    return () => {};
  }
  runtimeStarted = true;

  const triggerFlush = () => {
    flushOfflineMutations().catch((err) =>
      console.warn('Offline queue flush notice:', err)
    );
  };

  const handleOnline = () => {
    setTimeout(triggerFlush, 400);
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      triggerFlush();
    }
  };

  const handleSwMessage = (event: MessageEvent) => {
    if (event?.data?.type === 'SYNC_OFFLINE_QUEUE') {
      triggerFlush();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
  }

  // Periodic safety retry when online with queued items
  const safetyInterval = setInterval(() => {
    if (navigator.onLine) {
      getAllPendingMutations().then((items) => {
        if (items.length > 0) triggerFlush();
      });
    }
  }, 15000);

  // Initial check on startup
  if (navigator.onLine) {
    setTimeout(triggerFlush, 1200);
  } else {
    notifyListeners();
  }

  return () => {
    runtimeStarted = false;
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
    clearInterval(safetyInterval);
  };
}

export function useOfflineSyncStatus(): OfflineSyncSnapshot & {
  syncNow: () => Promise<{ synced: number; remaining: number }>;
} {
  const [snapshot, setSnapshot] = useState<OfflineSyncSnapshot>({
    pendingItems: [],
    pendingCount: 0,
    isSyncing: isFlushing,
    lastSyncedCount: lastSyncedCountState,
    lastSyncedAt: lastSyncedAtState,
    lastSyncError: lastSyncErrorState,
  });

  useEffect(() => {
    listeners.add(setSnapshot);
    notifyListeners();
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);

  return {
    ...snapshot,
    syncNow: flushOfflineMutations,
  };
}

/**
 * Cache snapshot helper in IndexedDB (stores large structured datasets reliably offline)
 */
export async function cacheDataInIndexedDB<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openSyncDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      tx.objectStore(STORE_SNAPSHOTS).put({
        key,
        data,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB cacheData error:', err);
  }
}

export async function readCachedDataFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openSyncDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const req = tx.objectStore(STORE_SNAPSHOTS).get(key);
      req.onsuccess = () => {
        resolve(req.result ? (req.result.data as T) : null);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}
