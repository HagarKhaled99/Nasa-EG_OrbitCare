// ORBIT TWIN service worker (plan §6 "Offline demo": the app shell, essential data and instructions keep
// working with the network disconnected). Registered only in production builds (`npm run start`).
//  - App shell, scripts, styles, images, demo dataset: cached, served from cache when offline.
//  - /api/...: NEVER cached. Health data stays in the crew database, not in the browser cache.
//  - Google Fonts: cached after the first visit; without them the system font is used.
const CACHE = 'orbit-twin-v1'
const PRECACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/images/body-twin-female.png',
  '/images/body-twin-male.png',
  '/data/orbit_twin_demo.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Private health data: always from the crew server, never cached.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return

  // Page navigations: network first, cached app shell when offline (React Router handles the route).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  const sameOrigin = url.origin === self.location.origin
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!sameOrigin && !font) return

  // Static files: cache first, then network (and keep a copy for next time).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
