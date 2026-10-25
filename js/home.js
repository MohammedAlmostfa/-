
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elements = {
    todayDate: $("today-date"),
    error: $("dashboard-error"),
    refreshButton: $("refresh-button"),

    present: $("stat-present"),
    absent: $("stat-absent"),

  };

  function setText(element, value) {
    if (!element) return;

    element.textContent =
      value === undefined || value === null || value === ""
        ? "—"
        : String(value);
  }

  function setNumber(element, value) {
    if (!element) return;

    const number = Number(value);

    if (
      value === undefined ||
      value === null ||
      value === "" ||
      !Number.isFinite(number) ||
      number < 0
    ) {
      element.textContent = "—";
      return;
    }

    element.textContent =
      typeof formatNumber === "function"
        ? formatNumber(number)
        : new Intl.NumberFormat("ar").format(number);
  }

  function getFirstValue(object, keys) {
    if (!object || typeof object !== "object") {
      return undefined;
    }

    for (const key of keys) {
      if (
        Object.prototype.hasOwnProperty.call(object, key) &&
        object[key] !== undefined &&
        object[key] !== null
      ) {
        return object[key];
      }
    }

    return undefined;
  }

  function showError(message) {
    if (!elements.error) return;

    elements.error.replaceChildren();

    const text = document.createElement("span");
    text.textContent =
      message || "تعذر تحميل بيانات لوحة المتابعة. حاول مرة أخرى.";

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "إعادة المحاولة";
    retryButton.addEventListener("click", loadDashboard);

    elements.error.append(text, retryButton);
    elements.error.classList.add("visible");
  }

  function hideError() {
    if (!elements.error) return;

    elements.error.classList.remove("visible");
    elements.error.replaceChildren();
  }

  function renderSummary(data) {
    const summary = data.summary || data;

    setNumber(
      elements.present,
      getFirstValue(summary, [
        "present",
        "presentCount",
        "حاضرون"
      ])
    );

    setNumber(
      elements.absent,
      getFirstValue(summary, [
        "absent",
        "absentCount",
        "غائبون"
      ])
    );

  }

  async function loadDashboard() {
    hideError();

    if (elements.refreshButton) {
      elements.refreshButton.disabled = true;
      elements.refreshButton.classList.add("is-loading");
    }

    try {
      if (typeof api !== "function") {
        throw new Error(
          "لم يتم تحميل ملف API المشترك بشكل صحيح."
        );
      }

      // نعرض آخر أرقام محفوظة فوراً ثم نحدّثها عند وصول الرد الحديث.
      await apiCached("summary", {}, function (summaryData) {
        renderSummary(summaryData || {});
      }, { maxAge: 5 * 60 * 1000 });
    } catch (error) {
      console.error(
        "Home dashboard loading failed:",
        error
      );

      showError(
        error && error.message
          ? error.message
          : "تعذر تحميل بيانات لوحة المتابعة. تحقق من الاتصال ثم أعد المحاولة."
      );
    } finally {
      if (elements.refreshButton) {
        elements.refreshButton.disabled = false;
        elements.refreshButton.classList.remove("is-loading");
      }
    }
  }

  function initializePage() {
    if (typeof guard === "function") {
      const allowed = guard(["owner"]);

      if (allowed === false) {
        return;
      }
    }

    if (elements.todayDate) {
      elements.todayDate.textContent =
        typeof formatDateArabic === "function"
          ? formatDateArabic(new Date())
          : new Intl.DateTimeFormat("ar", {
              dateStyle: "full"
            }).format(new Date());
    }

    if (elements.refreshButton) {
      elements.refreshButton.addEventListener(
        "click",
        loadDashboard
      );
    }

    loadDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePage,
      { once: true }
    );
  } else {
    initializePage();
  }
})();
