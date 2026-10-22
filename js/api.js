
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
    }

    throw apiError;
  }

  return result.data;
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
