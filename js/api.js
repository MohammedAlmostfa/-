
"use strict";

/**
 * Hadir - API and Session Manager
 * الاتصال بـ Google Apps Script وإدارة جلسة المستخدم.
 */

async function api(action, data = {}, options = {}) {
  if (typeof API_URL !== "string" || !API_URL.trim()) {
    throw new Error("رابط الخادم غير مضبوط في js/config.js.");
  }

  if (typeof action !== "string" || !action.trim()) {
    throw new Error("اسم العملية غير صالح.");
  }

  const token = options.token ?? getSessionToken();

  const payload = {
    action: action.trim(),
    token: token || "",
    data: data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {}
  };

  let response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(
      "تعذّر الاتصال بالخادم. تحقق من الإنترنت ورابط الخدمة المنشور."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error(
      "استجابة الخادم غير صالحة. تحقق من نشر تطبيق Google Apps Script."
    );
  }

  if (!result || typeof result !== "object") {
    throw new Error("استجابة الخادم غير صالحة.");
  }

  if (result.ok !== true) {
    const code =
      typeof result.error === "string"
        ? result.error
        : "server";

    const message =
      typeof result.message === "string" && result.message.trim()
        ? result.message
        : "تعذّر تنفيذ العملية.";

    const apiError = new Error(message);
    apiError.code = code;

    if (code === "unauthorized" || code === "forbidden") {
      clearSession();

      const currentPage = window.location.pathname
        .split("/")
        .pop();

      if (action.trim() !== "login" && currentPage !== APP_PAGES.login) {
        window.location.replace(
          APP_PAGES.login + "?session=expired"
        );
      }
    }

    throw apiError;
  }

  return result.data;
}

/**
 * ---------------------------------------------------------------
 * كاش الطلبات (Stale-While-Revalidate)
 * ---------------------------------------------------------------
 * يعرض آخر نتيجة محفوظة فوراً، ثم يجلب النسخة الحديثة بالخلفية
 * ويحدّث الواجهة. التخزين في sessionStorage فيُمسح مع الجلسة.
 *
 * مثال:
 * await apiCached("listMembers", {}, function (result, meta) {
 *   render(result);   // meta.cached === true عند عرض النسخة المخزّنة
 * });
 *
 * إذا فشل الجلب الحديث وكانت هناك نسخة مخزّنة معروضة، لا يُرمى خطأ.
 */
const API_CACHE_PREFIX = "hadir_cache_";

function apiCacheKey(action, data) {
  let serialized = "";

  try {
    serialized = JSON.stringify(data || {});
  } catch (error) {
    serialized = "";
  }

  return API_CACHE_PREFIX + action + ":" + serialized;
}

function readApiCache(key, maxAgeMs) {
  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      return undefined;
    }

    const entry = JSON.parse(raw);

    if (
      !entry ||
      typeof entry.t !== "number" ||
      Date.now() - entry.t > maxAgeMs
    ) {
      return undefined;
    }

    return entry.v;
  } catch (error) {
    return undefined;
  }
}

function writeApiCache(key, value) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ t: Date.now(), v: value })
    );
  } catch (error) {
    // الامتلاء أو الوضع الخاص: نتجاهل التخزين دون التأثير على التطبيق.
  }
}

/**
 * حذف كل نتائج الكاش، أو نتائج عملية معيّنة فقط.
 * نستدعيها بعد أي عملية تغيّر البيانات (مثل addMember).
 */
function clearApiCache(action) {
  try {
    const prefix = API_CACHE_PREFIX + (action ? action + ":" : "");
    const keys = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);

      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    keys.forEach(function (key) {
      sessionStorage.removeItem(key);
    });
  } catch (error) {
    // لا شيء.
  }
}

async function apiCached(action, data = {}, onData, options = {}) {
  const key = apiCacheKey(action, data);
  const maxAge =
    typeof options.maxAge === "number" ? options.maxAge : 10 * 60 * 1000;

  let shownFromCache = false;
  const cached = readApiCache(key, maxAge);

  if (cached !== undefined && typeof onData === "function") {
    try {
      onData(cached, { cached: true });
      shownFromCache = true;
    } catch (error) {
      // نسخة مخزّنة غير صالحة: نتجاهلها وننتظر الشبكة.
      shownFromCache = false;
    }
  }

  try {
    const fresh = await api(action, data, options);

    writeApiCache(key, fresh);

    if (typeof onData === "function") {
      onData(fresh, { cached: false });
    }

    return fresh;
  } catch (error) {
    if (shownFromCache && error && error.code !== "unauthorized" && error.code !== "forbidden") {
      return cached;
    }

    throw error;
  }
}

/**
 * تحميل سكربت خارجي مرة واحدة فقط (للمكتبات غير الضرورية عند فتح الصفحة).
 */
const loadedScripts = {};

function loadScriptOnce(src) {
  if (loadedScripts[src]) {
    return loadedScripts[src];
  }

  loadedScripts[src] = new Promise(function (resolve, reject) {
    const script = document.createElement("script");

    script.src = src;
    script.async = true;
    script.onload = function () {
      resolve();
    };
    script.onerror = function () {
      delete loadedScripts[src];
      script.remove();
      reject(new Error("تعذّر تحميل: " + src));
    };

    document.head.appendChild(script);
  });

  return loadedScripts[src];
}

/**
 * تشغيل مهمة عندما يكون المتصفح فارغاً (لتحميل مسبق دون إبطاء الصفحة).
 */
function runWhenIdle(task) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(task, { timeout: 4000 });
  } else {
    window.setTimeout(task, 1500);
  }
}

/**
 * قراءة بيانات الجلسة من sessionStorage.
 * تنتهي البيانات المحلية عند انتهاء جلسة المتصفح.
 */
function getSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_KEYS.TOKEN) || "";
  } catch (error) {
    return "";
  }
}

function getSessionRole() {
  try {
    return sessionStorage.getItem(SESSION_KEYS.ROLE) || "";
  } catch (error) {
    return "";
  }
}

/**
 * حفظ رمز الجلسة والصلاحية بعد نجاح تسجيل الدخول.
 */
function saveSession(token, role) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("رمز الجلسة المستلم غير صالح.");
  }

  if (!Object.values(APP_ROLES).includes(role)) {
    throw new Error("صلاحية المستخدم المستلمة غير صالحة.");
  }

  try {
    sessionStorage.setItem(SESSION_KEYS.TOKEN, token);
    sessionStorage.setItem(SESSION_KEYS.ROLE, role);
  } catch (error) {
    throw new Error("تعذّر حفظ الجلسة في المتصفح.");
  }
}

/**
 * حذف بيانات الجلسة المحلية.
 */
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEYS.TOKEN);
    sessionStorage.removeItem(SESSION_KEYS.ROLE);
  } catch (error) {
    // قد لا يكون التخزين متاحاً في بعض أوضاع المتصفح.
  }

  clearApiCache();
}

/**
 * حماية صفحات النظام حسب الدور المسموح.
 *
 * مثال:
 * guard([APP_ROLES.OWNER]);
 * guard([APP_ROLES.OBSERVER, APP_ROLES.OWNER]);
 *
 * هذه الحماية للواجهة فقط؛ الخادم هو المسؤول
 * عن التحقق الفعلي من صلاحية كل عملية.
 */
function guard(allowedRoles = []) {
  const token = getSessionToken();
  const role = getSessionRole();

  const hasValidSession =
    Boolean(token) &&
    Object.values(APP_ROLES).includes(role);

  const hasAllowedRole =
    Array.isArray(allowedRoles) &&
    allowedRoles.includes(role);

  if (!hasValidSession || !hasAllowedRole) {
    clearSession();

    const currentPage = window.location.pathname
      .split("/")
      .pop();

    if (currentPage !== APP_PAGES.login) {
      window.location.replace(APP_PAGES.login);
    }

    return false;
  }

  return true;
}

/**
 * تسجيل الخروج من الخادم ثم حذف الجلسة المحلية.
 */
async function logout() {
  const token = getSessionToken();

  try {
    if (API_URL && token) {
      await api("logout", {}, { token });
    }
  } catch (error) {
    // نحذف الجلسة المحلية حتى عند تعذّر الاتصال بالخادم.
  } finally {
    clearSession();
    window.location.replace(APP_PAGES.login);
  }
}
