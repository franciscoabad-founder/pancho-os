/* Growth OS — service worker
   Scope: /os. Strategy kept deliberately conservative because OS pages are
   SSR + behind auth: never cache HTML navigations or /api responses, only
   static assets. Navigations fall back to an offline shell when fully offline. */

const VERSION = 'os-v1';
const STATIC_CACHE = `os-static-${VERSION}`;
const OFFLINE_URL = '/os-offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/os-icon-192.png',
  '/os-icon-512.png',
  '/os-icon-maskable-512.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;     // let cross-origin (fonts) pass through
  if (url.pathname.startsWith('/api/')) return;        // never cache API / auth

  // HTML navigations: network-first, offline shell as last resort
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static same-origin assets: cache-first, then network (and cache it)
  if (/\.(png|svg|webp|jpg|jpeg|ico|css|js|woff2?|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
      )
    );
  }
});
