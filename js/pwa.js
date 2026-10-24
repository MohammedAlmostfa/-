"use strict";

/**
 * Hadir - Service Worker registration
 * تسجيل الـ Service Worker لتخزين الواجهة محلياً وتسريع الفتح المتكرر.
 */
(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
      console.warn("Hadir: تعذّر تسجيل Service Worker.", error);
    });
  });
})();
