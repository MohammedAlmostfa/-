
"use strict";

const loginForm = document.getElementById("loginForm");
const passwordField = document.getElementById("passwordField");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const eyeIcon = document.getElementById("eyeIcon");
const submitBtn = document.getElementById("submitBtn");
const submitBtnText = document.getElementById("submitBtnText");
const submitBtnIcon = document.getElementById("submitBtnIcon");
const errorMsg = document.getElementById("errorMsg");
const errorText = document.getElementById("errorText");
const loginNotice = document.getElementById("loginNotice");
const loginNoticeText = document.getElementById("loginNoticeText");
const bandLogo = document.getElementById("bandLogo");

function showError(message) {
  errorText.textContent = message;
  errorMsg.hidden = false;
  loginNotice.hidden = true;
}

function showNotice(message) {
  loginNoticeText.textContent = message;
  loginNotice.hidden = false;
  errorMsg.hidden = true;
}

function clearMessages() {
  errorMsg.hidden = true;
  loginNotice.hidden = true;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  passwordField.disabled = isLoading;
  togglePasswordBtn.disabled = isLoading;

  submitBtnText.textContent = isLoading
    ? "جارٍ التحقق..."
    : "دخول";

  submitBtnIcon.textContent = isLoading
    ? "hourglass_top"
    : "arrow_forward";
}

function togglePasswordVisibility() {
  const isPassword = passwordField.type === "password";

  passwordField.type = isPassword ? "text" : "password";

  eyeIcon.textContent = isPassword
    ? "visibility_off"
    : "visibility";

  togglePasswordBtn.setAttribute(
    "aria-pressed",
    String(isPassword)
  );

  togglePasswordBtn.setAttribute(
    "aria-label",
    isPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"
  );

  passwordField.focus();
}

function getLoginErrorMessage(error) {
  const message = String(
    error && error.message ? error.message : ""
  );

  if (/unauthorized|invalid password|wrong password/i.test(message)) {
    return "كلمة السر غير صحيحة. تأكد منها وحاول مرة أخرى.";
  }

  if (/locked|too many|rate limit/i.test(message)) {
    return "تم إيقاف محاولات الدخول مؤقتاً. حاول مرة أخرى بعد قليل.";
  }

  if (/failed to fetch|network|fetch/i.test(message)) {
    return "تعذّر الاتصال بالخادم. تحقق من الإنترنت ورابط الخدمة المنشور.";
  }

  return "تعذّر تسجيل الدخول. تحقق من كلمة السر وحاول مرة أخرى.";
}

togglePasswordBtn.addEventListener(
  "click",
  togglePasswordVisibility
);

passwordField.addEventListener("input", clearMessages);

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearMessages();

  const password = passwordField.value;

  if (!password.trim()) {
    showError("يرجى إدخال كلمة السر.");
    passwordField.focus();
    return;
  }

  if (typeof API_URL === "undefined" || !API_URL) {
    showError("رابط الخدمة غير مضبوط. تحقق من ملف js/config.js.");
    return;
  }

  if (
    typeof api !== "function" ||
    typeof saveSession !== "function"
  ) {
    showError("تعذّر تحميل ملفات الاتصال. حدّث الصفحة وتحقق من js/api.js.");
    return;
  }

  setLoading(true);
  showNotice("يتم التحقق من كلمة السر والصلاحيات...");

  try {
    const result = await api("login", {
      password: password
    });

    if (!result || !result.token || !result.role) {
      throw new Error("invalid_response");
    }

    if (
      result.role !== APP_ROLES.OBSERVER &&
      result.role !== APP_ROLES.OWNER
    ) {
      throw new Error("invalid_role");
    }

    saveSession(result.token, result.role);
    passwordField.value = "";

    if (result.role === APP_ROLES.OWNER) {
      window.location.replace(APP_PAGES.home);
      return;
    }

    window.location.replace(APP_PAGES.scan);

  } catch (error) {
    console.error("Login request failed.");

    showError(getLoginErrorMessage(error));

    passwordField.value = "";
    passwordField.focus();

  } finally {
    setLoading(false);
  }
});

bandLogo.addEventListener("error", function () {
  bandLogo.alt = "الشعار غير متوفر حالياً";
  bandLogo.style.display = "none";
});
