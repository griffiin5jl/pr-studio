// AOFTA STUDIO PRO - Service Worker
// เปลี่ยนเลขเวอร์ชันนี้ทุกครั้งที่อัปเดตไฟล์ เพื่อให้เครื่องผู้ใช้ดึงของใหม่
const CACHE_VERSION = 'aofta-v1';
const APP_SHELL = [
  './',
  './index.html',
  './AOFTA_STUDIO.jpg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './manifest.webmanifest'
];

// โดเมนภายนอกที่ cache ไว้ใช้ตอนออฟไลน์ได้ (สคริปต์/ฟอนต์เท่านั้น)
const CACHEABLE_CDN = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST ไป Apps Script ผ่านตรง ไม่แตะ

  const url = new URL(req.url);

  // ห้าม cache การเรียก API ของ Google Apps Script / Firebase เด็ดขาด
  if (url.hostname === 'script.google.com' ||
      url.hostname.endsWith('googleusercontent.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.')) {
    return;
  }

  // หน้าเว็บ: ลองโหลดจากเน็ตก่อน (ได้เวอร์ชันล่าสุด) ถ้าออฟไลน์ค่อยใช้ cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // ไฟล์ในโดเมนเดียวกัน: cache ก่อน แล้วอัปเดตเบื้องหลัง
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetching = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetching;
      })
    );
    return;
  }

  // Tailwind / ฟอนต์ จาก CDN: เก็บไว้ใช้ตอนออฟไลน์
  if (CACHEABLE_CDN.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetching = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || fetching;
      })
    );
  }
});
