
"use strict";

/**
 * Hadir - Shared UI Utilities
 * أدوات الواجهة المشتركة بين صفحات النظام.
 */

/**
 * تحويل النص إلى صيغة آمنة للعرض داخل HTML.
 * الأفضل عند بناء الواجهات استخدام textContent،
 * وهذه الدالة متاحة عند الحاجة لبناء HTML نصي آمن.
 */
function escapeHTML(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(/[&<>"']/g, function (character) {
    return replacements[character];
  });
}

/**
 * إظهار رسالة مؤقتة للمستخدم.
 *
 * الأنواع المدعومة:
 * success, error, warning, info
 */
function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
  }

  const allowedTypes = ["success", "error", "warning", "info"];
  const safeType = allowedTypes.includes(type) ? type : "info";

  const toast = document.createElement("div");
  toast.className = `toast-message toast-${safeType}`;
  toast.setAttribute("role", safeType === "error" ? "alert" : "status");
  toast.textContent = String(message ?? "");

  container.appendChild(toast);

  const timeout = Number.isFinite(duration)
    ? Math.max(1000, duration)
    : 3500;

  window.setTimeout(function () {
    toast.classList.add("toast-hiding");

    window.setTimeout(function () {
      toast.remove();

      if (container.childElementCount === 0) {
        container.remove();
      }
    }, 250);
  }, timeout);
}

/**
 * اختصارات لعرض رسائل واضحة.
 */
function showSuccess(message, duration) {
  showToast(message, "success", duration);
}

function showError(message, duration) {
  showToast(message, "error", duration);
}

function showWarning(message, duration) {
  showToast(message, "warning", duration);
}

function showInfo(message, duration) {
  showToast(message, "info", duration);
}

/**
 * تنسيق التاريخ باستخدام التوقيت المحلي للجهاز.
 * نستخدم التاريخ بصيغة YYYY-MM-DD عند التعامل مع API.
 */
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * عرض التاريخ بصيغة عربية مفهومة.
 * يقبل YYYY-MM-DD أو كائن Date.
 */
function formatDateArabic(value, options = {}) {
  let date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
    } else {
      date = new Date(value);
    }
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "تاريخ غير صالح";
  }

  return new Intl.DateTimeFormat("ar-SY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options
  }).format(date);
}

/**
 * تنسيق الوقت بصيغة HH:mm.
 */
function formatTime(value) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{1,2}):(\d{2})/);

    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

/**
 * قراءة قيمة معامل من رابط الصفحة.
 * مثال: member.html?id=M001
 */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * التأكد من وجود قيمة نصية بعد إزالة الفراغات.
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * تنسيق رقم مع فواصل الآلاف.
 */
function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("ar-SY").format(number);
}

/**
 * تشغيل اهتزاز خفيف على الأجهزة التي تدعمه.
 */
function vibrateDevice(pattern = 100) {
  if (typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

/**
 * تشغيل صوت قصير عند نجاح المسح أو حدوث خطأ.
 * يعتمد على تفاعل المستخدم السابق مع الصفحة،
 * وقد يمنع المتصفح الصوت حتى يتم التفاعل.
 */
function playFeedbackSound(type = "success") {
  const frequencies = {
    success: 880,
    error: 220,
    warning: 440
  };

  const frequency = frequencies[type] || frequencies.success;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.16
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);

    oscillator.onended = function () {
      context.close().catch(function () {});
    };
  } catch (error) {
    // الصوت ميزة إضافية، ولا يجب أن يعطّل الصفحة.
  }
}

/**
 * تغيير حالة التحميل على زر.
 * يحافظ على النص الأصلي لإعادته بعد انتهاء العملية.
 */
function setButtonLoading(button, isLoading, loadingText = "يرجى الانتظار...") {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = loadingText;
    return;
  }

  button.disabled = false;
  button.removeAttribute("aria-busy");

  if (button.dataset.originalText !== undefined) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}
