
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elements = {
    todayDate: $("today-date"),
    error: $("dashboard-error"),
    refreshButton: $("refresh-button"),

    present: $("stat-present"),
    late: $("stat-late"),
    absent: $("stat-absent"),
    excuses: $("stat-excuses"),

    sessionType: $("session-type"),
    sessionStart: $("session-start"),

    recentLoading: $("recent-loading"),
    recentEmpty: $("recent-empty"),
    recentTableWrap: $("recent-table-wrap"),
    recentTableBody: $("recent-table-body"),

    pendingCount: $("pending-count"),
    pendingLateCount: $("pending-late-count"),
    pendingExcusesCount: $("pending-excuses-count")
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

  function showRecentLoading() {
    if (elements.recentLoading) {
      elements.recentLoading.hidden = false;
    }

    if (elements.recentEmpty) {
      elements.recentEmpty.hidden = true;
    }

    if (elements.recentTableWrap) {
      elements.recentTableWrap.hidden = true;
    }

    if (elements.recentTableBody) {
      elements.recentTableBody.replaceChildren();
    }
  }

  function getStatusInfo(status) {
    const normalized = String(status ?? "").trim().toLowerCase();

    if (
      ["معذور", "معتذر", "عذر مقبول", "excused", "excuse"].includes(normalized)
    ) {
      return {
        label: status || "معذور",
        className: "excused"
      };
    }

    if (
      ["متأخر", "متأخرون", "late", "delayed"].includes(normalized)
    ) {
      return {
        label: status || "متأخر",
        className: "late"
      };
    }

    if (
      [
        "بانتظار المراجعة",
        "معلق",
        "قيد المراجعة",
        "pending"
      ].includes(normalized)
    ) {
      return {
        label: status || "قيد المراجعة",
        className: "pending"
      };
    }

    if (
      [
        "حاضر",
        "تم الحضور",
        "present",
        "checked-in",
        "checked_in"
      ].includes(normalized)
    ) {
      return {
        label: status || "حاضر",
        className: "present"
      };
    }

    return {
      label: status || "—",
      className: "neutral"
    };
  }

  function formatTimeValue(value) {
    if (value === undefined || value === null || value === "") {
      return "—";
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) return "—";

      const match = trimmed.match(/T(\d{2}:\d{2})/);

      if (match) {
        return match[1];
      }

      return trimmed;
    }

    return String(value);
  }

  function createRecentRow(record) {
    const row = document.createElement("tr");

    const memberCell = document.createElement("td");
    const memberWrap = document.createElement("div");
    memberWrap.className = "member-cell";

    const name = getFirstValue(record, [
      "memberName",
      "name",
      "fullName",
      "اسم العضو",
      "الاسم"
    ]);

    const memberId = getFirstValue(record, [
      "memberId",
      "id",
      "code",
      "رقم العضو",
      "الرقم"
    ]);

    const avatar = document.createElement("span");
    avatar.className = "member-avatar";
    avatar.textContent = String(name || "؟").trim().charAt(0) || "؟";
    avatar.setAttribute("aria-hidden", "true");

    const memberInfo = document.createElement("span");

    const memberName = document.createElement("span");
    memberName.className = "member-name";
    memberName.textContent =
      name === undefined || name === null || name === ""
        ? "عضو غير معروف"
        : String(name);

    const memberCode = document.createElement("span");
    memberCode.className = "member-id";
    memberCode.textContent =
      memberId === undefined || memberId === null || memberId === ""
        ? ""
        : `#${memberId}`;

    memberInfo.append(memberName, memberCode);
    memberWrap.append(avatar, memberInfo);
    memberCell.appendChild(memberWrap);

    const statusCell = document.createElement("td");

    const status = getFirstValue(record, [
      "status",
      "attendanceStatus",
      "الحالة"
    ]);

    const statusInfo = getStatusInfo(status);

    const statusPill = document.createElement("span");
    statusPill.className = `status-pill ${statusInfo.className}`;
    statusPill.textContent = statusInfo.label;

    statusCell.appendChild(statusPill);

    const timeCell = document.createElement("td");

    const time = getFirstValue(record, [
      "time",
      "checkInTime",
      "createdAt",
      "timestamp",
      "وقت التسجيل",
      "الوقت"
    ]);

    timeCell.textContent = formatTimeValue(time);

    row.append(memberCell, statusCell, timeCell);

    return row;
  }

  function renderRecentRecords(records) {
    if (elements.recentLoading) {
      elements.recentLoading.hidden = true;
    }

    if (elements.recentTableBody) {
      elements.recentTableBody.replaceChildren();
    }

    const validRecords = Array.isArray(records)
      ? records
          .filter((record) => record && typeof record === "object")
          .slice(0, 5)
      : [];

    if (validRecords.length === 0) {
      if (elements.recentTableWrap) {
        elements.recentTableWrap.hidden = true;
      }

      if (elements.recentEmpty) {
        elements.recentEmpty.hidden = false;
      }

      return;
    }

    validRecords.forEach((record) => {
      elements.recentTableBody.appendChild(createRecentRow(record));
    });

    if (elements.recentEmpty) {
      elements.recentEmpty.hidden = true;
    }

    if (elements.recentTableWrap) {
      elements.recentTableWrap.hidden = false;
    }
  }

  function renderSummary(data) {
    const summary = data.summary || data;
    const session = data.session || data.sessionInfo || {};

    setNumber(
      elements.present,
      getFirstValue(summary, [
        "present",
        "presentCount",
        "حاضرون"
      ])
    );

    setNumber(
      elements.late,
      getFirstValue(summary, [
        "late",
        "lateCount",
        "متأخرون"
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

    setNumber(
      elements.excuses,
      getFirstValue(summary, [
        "excusesCount",
        "todayExcuses",
        "excuses",
        "عدد_الأعذار"
      ])
    );

    const pendingLate = getFirstValue(summary, [
      "pendingLateCount",
      "pendingLate",
      "latePending"
    ]);

    const pendingExcuses = getFirstValue(summary, [
      "pendingExcusesCount",
      "pendingExcuses",
      "excusesPending"
    ]);

    const pendingTotal = getFirstValue(summary, [
      "pendingCount",
      "pending",
      "حالات_تحتاج_متابعة"
    ]);

    setNumber(elements.pendingLateCount, pendingLate);
    setNumber(elements.pendingExcusesCount, pendingExcuses);
    setNumber(elements.pendingCount, pendingTotal);

    setText(
      elements.sessionType,
      getFirstValue(session, [
        "sessionType",
        "type",
        "نوع الجلسة"
      ])
    );

    setText(
      elements.sessionStart,
      getFirstValue(session, [
        "startTime",
        "start",
        "وقت بداية الجلسة"
      ])
    );

    const recentRecords = getFirstValue(summary, [
      "recentCheckIns",
      "recent",
      "lastCheckIns",
      "آخر_التسجيلات"
    ]);

    renderRecentRecords(recentRecords);
  }

  async function loadDashboard() {
    hideError();
    showRecentLoading();

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

      const results = await Promise.allSettled([
        api("summary"),
        api("sessionInfo")
      ]);

      if (results[0].status === "rejected") {
        throw results[0].reason ||
          new Error("تعذر جلب ملخص الحضور.");
      }

      const summaryData = results[0].value || {};

      if (results[1].status === "fulfilled") {
        const sessionData = results[1].value || {};

        summaryData.session =
          sessionData.session || sessionData;
      }

      renderSummary(summaryData);
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

      renderRecentRecords([]);
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
