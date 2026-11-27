// Service Worker Background Sync Extension for Engineering Monitoring PWA
// Works alongside Workbox precaching to notify open clients when connectivity resumes.

const BG_SYNC_TAG = 'eng-firestore-sync';

self.addEventListener('sync', (event) => {
  if (event && event.tag === BG_SYNC_TAG) {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: 'SYNC_OFFLINE_QUEUE',
              source: 'service-worker-bg-sync',
              timestamp: Date.now(),
            });
          });
        })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'PING_BG_SYNC') {
    if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage({ type: 'BG_SYNC_READY' });
    }
  }
});
