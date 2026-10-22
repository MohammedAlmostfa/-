"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const dateForm = document.getElementById("date-form");
  const dateInput = document.getElementById("attendance-date");
  const searchButton = document.getElementById("search-button");
  const statusMessage = document.getElementById("status-message");
  const selectedDateLabel = document.getElementById("selected-date-label");
  const reportContent = document.getElementById("report-content");
  const tableBody = document.getElementById("attendance-table-body");
  const tableWrapper = document.getElementById("table-wrapper");
  const emptyResults = document.getElementById("empty-results");
  const printButton = document.getElementById("print-button");

  const totalCount = document.getElementById("total-count");
  const presentCount = document.getElementById("present-count");
  const excusedCount = document.getElementById("excused-count");
  const lateCount = document.getElementById("late-count");
  const recordsDescription = document.getElementById("records-description");

  let requestNumber = 0;

  function getTodayString(offsetDays = 0) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: typeof APP_TIME_ZONE === "string"
        ? APP_TIME_ZONE
        : "Asia/Damascus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);

    const values = {};
    parts.forEach(function (part) {
      if (part.type !== "literal") {
        values[part.type] = Number(part.value);
      }
    });

    const date = new Date(Date.UTC(
      values.year,
      values.month - 1,
      values.day + offsetDays
    ));

    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    const parts = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2]
    ));

    return new Intl.DateTimeFormat("ar-SY", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function setMessage(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type === "error") {
      statusMessage.classList.add("is-error");
    } else if (type === "success") {
      statusMessage.classList.add("is-success");
    }
  }

  function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    searchButton.textContent = isLoading ? "جارٍ التحميل..." : "عرض السجل";
    dateInput.disabled = isLoading;

    document.querySelectorAll(".quick-date").forEach(function (button) {
      button.disabled = isLoading;
    });
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function getRecordStatus(record) {
    return normalizeText(
      record.status ??
      record.attendanceStatus ??
      record.state
    );
  }

  function getRecordTime(record) {
    return normalizeText(
      record.time ??
      record.attendanceTime ??
      record.checkInTime
    ) || "—";
  }

  function getRecordName(record) {
    return normalizeText(
      record.fullName ??
      record.name ??
      record.memberName
    ) || "غير معروف";
  }

  function getRecordId(record) {
    return normalizeText(
      record.id ??
      record.memberId
    ) || "—";
  }

  function isExcused(record) {
    const status = getRecordStatus(record);
    const time = getRecordTime(record);

    return status.includes("معذور") ||
      status.includes("عذر") ||
      time.includes("معذور");
  }

  function isLate(record) {
    const status = getRecordStatus(record);

    return status.includes("متأخر") ||
      status.toLowerCase().includes("late");
  }

  function isPresent(record) {
    const status = getRecordStatus(record);

    return status.includes("حاضر") ||
      status.includes("متأخر") ||
      status.toLowerCase().includes("present") ||
      status.toLowerCase().includes("late");
  }

  function getStatusPresentation(record) {
    const status = getRecordStatus(record);

    if (isExcused(record)) {
      return {
        label: "معذور",
        className: "excused"
      };
    }

    if (isLate(record)) {
      return {
        label: "متأخر",
        className: "late"
      };
    }

    if (isPresent(record)) {
      return {
        label: status || "حاضر",
        className: "present"
      };
    }

    return {
      label: status || "غير محدد",
      className: "unknown"
    };
  }

  function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;

    if (className) {
      cell.className = className;
    }

    return cell;
  }

  function renderRecords(records) {
    tableBody.replaceChildren();

    records.forEach(function (record, index) {
      const row = document.createElement("tr");
      const presentation = getStatusPresentation(record);

      row.appendChild(createCell(String(index + 1)));
      row.appendChild(createCell(getRecordId(record), "member-id"));
      row.appendChild(createCell(getRecordName(record), "member-name"));
      row.appendChild(createCell(getRecordTime(record), "time-value"));

      const statusCell = document.createElement("td");
      const statusPill = document.createElement("span");

      statusPill.className = "status-pill " + presentation.className;
      statusPill.textContent = presentation.label;

      statusCell.appendChild(statusPill);
      row.appendChild(statusCell);

      tableBody.appendChild(row);
    });

    const hasRecords = records.length > 0;

    emptyResults.hidden = hasRecords;
    tableWrapper.hidden = !hasRecords;

    totalCount.textContent = String(records.length);

    const present = records.filter(isPresent).length;
    const excused = records.filter(isExcused).length;
    const late = records.filter(function (record) {
      return isLate(record) && !isExcused(record);
    }).length;

    presentCount.textContent = String(present);
    excusedCount.textContent = String(excused);
    lateCount.textContent = String(late);

    recordsDescription.textContent = hasRecords
      ? "عدد التسجيلات: " + records.length
      : "لا توجد تسجيلات لهذا التاريخ.";
  }

  function validateDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return false;
    }

    const parts = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2]
    ));

    return date.getUTCFullYear() === parts[0] &&
      date.getUTCMonth() === parts[1] - 1 &&
      date.getUTCDate() === parts[2];
  }

  async function loadAttendance(dateString) {
    if (!validateDate(dateString)) {
      setMessage("يرجى اختيار تاريخ صحيح.", "error");
      return;
    }

    if (typeof api !== "function") {
      setMessage(
        "تعذّر تحميل واجهة الاتصال بالخادم. تحقق من ملفات config.js و api.js.",
        "error"
      );
      return;
    }

    if (typeof guard === "function") {
      const allowedRoles = [
        APP_ROLES.OBSERVER,
        APP_ROLES.OWNER
      ];

      if (!guard(allowedRoles)) {
        return;
      }
    }

    const currentRequest = ++requestNumber;

    setLoading(true);
    reportContent.hidden = true;
    selectedDateLabel.textContent = formatDate(dateString);
    setMessage("جارٍ تحميل تسجيلات الحضور...");

    try {
      /*
       * يجب أن يوفر Apps Script عملية باسم:
       * getAttendanceByDate
       *
       * وترجع البيانات بالشكل:
       * {
       *   records: [
       *     {
       *       id: "M001",
       *       fullName: "اسم العضو",
       *       time: "08:05",
       *       status: "حاضر"
       *     }
       *   ]
       * }
       */
      const result = await api("getAttendanceByDate", {
        date: dateString
      });

      if (currentRequest !== requestNumber) {
        return;
      }

      const records = Array.isArray(result)
        ? result
        : result && Array.isArray(result.records)
          ? result.records
          : result && Array.isArray(result.attendance)
            ? result.attendance
            : null;

      if (!records) {
        throw new Error(
          "صيغة البيانات المستلمة غير صحيحة. يجب أن يعيد الخادم قائمة records."
        );
      }

      renderRecords(records);
      reportContent.hidden = false;

      if (records.length === 0) {
        setMessage(
          "لم يتم العثور على تسجيلات حضور بتاريخ " +
          formatDate(dateString) + "."
        );
      } else {
        setMessage(
          "تم تحميل " + records.length +
          " تسجيل بنجاح.",
          "success"
        );
      }
    } catch (error) {
      if (currentRequest !== requestNumber) {
        return;
      }

      reportContent.hidden = true;

      setMessage(
        error && error.message
          ? error.message
          : "حدث خطأ أثناء تحميل سجل الحضور.",
        "error"
      );
    } finally {
      if (currentRequest === requestNumber) {
        setLoading(false);
      }
    }
  }

  dateForm.addEventListener("submit", function (event) {
    event.preventDefault();
    loadAttendance(dateInput.value);
  });

  document.querySelectorAll(".quick-date").forEach(function (button) {
    button.addEventListener("click", function () {
      const selected = button.dataset.date;

      if (selected === "today") {
        dateInput.value = getTodayString();
      } else if (selected === "yesterday") {
        dateInput.value = getTodayString(-1);
      }

      loadAttendance(dateInput.value);
    });
  });

  printButton.addEventListener("click", function () {
    window.print();
  });

  dateInput.value = getTodayString();

  /*
   * تحميل سجل اليوم تلقائياً عند فتح الصفحة.
   * يتطلب وجود عملية getAttendanceByDate في Apps Script.
   */
  loadAttendance(dateInput.value);
});
