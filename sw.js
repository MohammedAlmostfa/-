"use strict";

/**
 * Hadir - Service Worker
 *
 * - الواجهة (HTML/CSS/JS/الصور): نعرض النسخة المخزّنة فوراً ونحدّثها بالخلفية.
 * - الخطوط والمكتبات الخارجية: نفس الأسلوب في كاش منفصل.
 * - طلبات Google Apps Script (API): لا نلمسها إطلاقاً ولا نخزّنها.
 *
 * عند إضافة/حذف ملفات من قائمة PRECACHE غيّر رقم CACHE_VERSION.
 */

const CACHE_VERSION = "v5";
const APP_CACHE = "hadir-app-" + CACHE_VERSION;
const EXT_CACHE = "hadir-ext-" + CACHE_VERSION;

const PRECACHE = [
  "./",
  "index.html",
  "home.html",
  "scan.html",
  "members.html",
  "member-card.html",
  "add-member.html",
  "log.html",
  "manifest.webmanifest",
  "css/app.css",
  "css/login.css",
  "css/home.css",
  "css/scan.css",
  "css/members.css",
  "css/member-card.css",
  "css/add-member.css",
  "css/log.css",
  "js/config.js",
  "js/api.js",
  "js/ui.js",
  "js/nav.js",
  "js/pwa.js",
  "js/login.js",
  "js/home.js",
  "js/scan.js",
  "js/members.js",
  "js/member-card.js",
  "js/add-member.js",
  "js/log.js",
  "assets/logo-256.webp",
  "assets/logo-192.png",
  "assets/logo-512.png"
];

const EXTERNAL_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdnjs.cloudflare.com",
  "cdn.jsdelivr.net"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function (cache) {
      // نضيف كل ملف على حدة حتى لا يفشل التثبيت بسبب ملف واحد.
      return Promise.all(
        PRECACHE.map(function (path) {
          return cache.add(path).catch(function () {});
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return (
              (key.startsWith("hadir-app-") && key !== APP_CACHE) ||
              (key.startsWith("hadir-ext-") && key !== EXT_CACHE)
            );
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isCacheable(response) {
  return response && (response.ok || response.type === "opaque");
}

/**
 * عرض النسخة المخزّنة فوراً، وتحديثها من الشبكة بالخلفية.
 * إذا لم توجد نسخة مخزّنة ننتظر الشبكة.
 */
function staleWhileRevalidate(event, cacheName, ignoreSearch) {
  const request = event.request;

  return caches.open(cacheName).then(function (cache) {
    return cache
      .match(request, { ignoreSearch: Boolean(ignoreSearch) })
      .then(function (cached) {
        const network = fetch(request, { cache: "no-cache" })
          .then(function (response) {
            if (isCacheable(response)) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(function () {
            return null;
          });

        if (cached) {
          event.waitUntil(network);
          return cached;
        }

        return network.then(function (response) {
          return response || Response.error();
        });
      });
  });
}

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // لا نتدخل بطلبات الـ API (Google Apps Script) إطلاقاً.
  if (
    url.hostname === "script.google.com" ||
    url.hostname.endsWith(".googleusercontent.com")
  ) {
    return;
  }

  if (EXTERNAL_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, EXT_CACHE, false));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  // التنقل بين الصفحات: نتجاهل الـ query (مثل member-card.html?id=M001)
  // حتى تُخدم الصفحة من الكاش، وتتولى الصفحة قراءة المعرّف بنفسها.
  if (request.mode === "navigate") {
    event.respondWith(
      staleWhileRevalidate(event, APP_CACHE, true).then(function (response) {
        if (response && response.type !== "error") {
          return response;
        }

        return caches.match("index.html");
      })
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(event, APP_CACHE, false));
});
