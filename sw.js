// کش ساده برای باز شدن سریع برنامه؛ داده‌های مالی هرگز کش نمی‌شوند.
const CACHE = 'hesab-v1';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'supabase.js', 'config.js', 'icon.svg', 'manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase و فونت‌ها از شبکه
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
