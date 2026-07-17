const CACHE = 'academy-v79';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './js/state.js',
  './js/supabase.js',
  './js/auth.js',
  './js/navigation.js',
  './js/generator.js',
  './js/layout.js',
  './js/export.js',
  './js/editor.js',
  './js/screens-flow.js',
  './js/screens-secondary.js',
  './js/pwa.js',
  './js/chat.js',
  './js/admin.js',
  './icons/icon-maskable-192.svg',
  './icons/icon-maskable-512.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  /* Network-first para API e Supabase */
  if (url.includes('/api/') || url.includes('supabase.co') || url.includes('openrouter')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  /* Cache-first para assets */
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
    return res;
  })));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
