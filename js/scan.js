
(function () {
  "use strict";

  const elements = {
    backButton: document.getElementById("backButton"),
    sessionLabel: document.getElementById("scanSessionLabel"),
    cameraStatus: document.getElementById("cameraStatus"),
    qrReader: document.getElementById("qrReader"),
    placeholder: document.getElementById("cameraPlaceholder"),
    result: document.getElementById("scanResult"),
    resultIcon: document.getElementById("scanResultIcon"),
    resultTitle: document.getElementById("scanResultTitle"),
    resultMessage: document.getElementById("scanResultMessage"),
    resultMember: document.getElementById("scanResultMember"),
    startButton: document.getElementById("startScanButton"),
    flashToggle: document.getElementById("flashToggle"),
    flashIcon: document.getElementById("flashIcon"),
    manualButton: document.getElementById("manualEntryButton"),
    manualPanel: document.getElementById("manualPanel"),
    manualForm: document.getElementById("manualEntryForm"),
    memberIdInput: document.getElementById("memberIdInput"),
    manualSubmit: document.getElementById("manualSubmitButton"),
    manualCancel: document.getElementById("manualCancelButton")
  };

  let qrScanner = null;
  let isScanning = false;
  let isProcessing = false;
  let flashEnabled = false;
  let cameraTrack = null;
  let lastScannedText = "";
  let lastScannedAt = 0;

  function setCameraStatus(message, type = "info") {
    const dot = document.createElement("span");
    dot.className = "status-dot";

    if (type === "success") {
      dot.classList.add("active");
    } else if (type === "error") {
      dot.classList.add("error");
    }

    const text = document.createElement("span");
    text.textContent = message;

    elements.cameraStatus.replaceChildren(dot, text);
  }

  function showResult(type, title, message, memberName = "") {
    const config = {
      success: { className: "result-success", icon: "check_circle" },
      warning: { className: "result-warning", icon: "warning" },
      error: { className: "result-error", icon: "error" },
      neutral: { className: "result-neutral", icon: "info" }
    };

    const chosen = config[type] || config.neutral;

    elements.result.className = "scan-result " + chosen.className;
    elements.resultIcon.textContent = chosen.icon;
    elements.resultTitle.textContent = title;
    elements.resultMessage.textContent = message;
    elements.resultMember.textContent = memberName;
    elements.result.hidden = false;
  }

  function hideResult() {
    elements.result.hidden = true;
    elements.resultTitle.textContent = "";
    elements.resultMessage.textContent = "";
    elements.resultMember.textContent = "";
  }

  function normalizeScanResponse(result) {
    const statuses = {
      ok: {
        type: "success",
        title: "تم تسجيل الحضور",
        message: "تم تسجيل حضور العضو بنجاح."
      },
      autoExcused: {
        type: "success",
        title: "تم التسجيل بعذر",
        message: "العضو متأخر، ويوجد عذر مسجل مسبقاً."
      },
      rejectedLate: {
        type: "warning",
        title: "متأخر بدون عذر",
        message: "لم يتم تسجيل الحضور. يرجى مراجعة صاحب النظام للتسجيل اليدوي."
      },
      duplicate: {
        type: "neutral",
        title: "الحضور مسجل مسبقاً",
        message: "يوجد تسجيل حضور لهذا العضو اليوم."
      },
      notFound: {
        type: "error",
        title: "العضو غير موجود",
        message: "لم يتم العثور على عضو مطابق لرمز QR."
      },
      disabled: {
        type: "error",
        title: "العضوية معطّلة",
        message: "لا يمكن تسجيل حضور هذا العضو لأن عضويته معطّلة."
      }
    };

    const info = statuses[result.status] || {
      type: "neutral",
      title: "نتيجة المسح",
      message: "استلم النظام نتيجة غير معروفة."
    };

    return {
      ...info,
      name: result.name || "",
      time: result.time || ""
    };
  }

  async function registerScannedMember(decodedText) {
    if (isProcessing) {
      return;
    }

    const now = Date.now();

    if (
      decodedText === lastScannedText &&
      now - lastScannedAt < 2500
    ) {
      return;
    }

    lastScannedText = decodedText;
    lastScannedAt = now;
    isProcessing = true;

    setCameraStatus("جارٍ التحقق من العضو...", "info");

    try {
      const memberId = String(decodedText).trim();

      if (!/^[A-Za-z0-9_-]{1,20}$/.test(memberId)) {
        showResult(
          "error",
          "رمز QR غير صالح",
          "الرمز لا يحتوي على رقم عضو صالح."
        );

        setCameraStatus("جاهز لمسح الرمز التالي", "error");
        playFeedbackSound("error");
        return;
      }

      const result = await api("scan", { id: memberId });
      const display = normalizeScanResponse(result || {});

      showResult(
        display.type,
        display.title,
        display.message + (display.time ? " الوقت: " + display.time : ""),
        display.name ? "العضو: " + display.name : ""
      );

      setCameraStatus("جاهز لمسح الرمز التالي", "success");

      if (display.type === "success") {
        playFeedbackSound("success");
        vibrateDevice(100);
      } else if (
        display.type === "error" ||
        display.type === "warning"
      ) {
        playFeedbackSound("error");
        vibrateDevice([100, 60, 100]);
      }
    } catch (error) {
      showResult(
        "error",
        "تعذّر تسجيل الحضور",
        error && error.message
          ? error.message
          : "حدث خطأ أثناء الاتصال بالنظام."
      );

      setCameraStatus("المسح متوقف مؤقتاً عن التحقق", "error");
      playFeedbackSound("error");
    } finally {
      isProcessing = false;
    }
  }

  async function startScanner() {
    if (isScanning) {
      return;
    }

    if (typeof Html5Qrcode === "undefined") {
      setCameraStatus(
        "تعذّر تحميل قارئ QR. تحقق من اتصال الإنترنت.",
        "error"
      );

      showResult(
        "error",
        "قارئ QR غير متاح",
        "تعذّر تحميل مكتبة قراءة الرموز. حدّث الصفحة وحاول مجدداً."
      );

      return;
    }

    elements.startButton.disabled = true;
    elements.startButton.textContent = "جارٍ تشغيل الكاميرا...";
    setCameraStatus("يرجى السماح للمتصفح باستخدام الكاميرا", "info");
    hideResult();

    try {
      qrScanner = new Html5Qrcode("qrReader");

      await qrScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: function (viewWidth, viewHeight) {
            const size = Math.floor(
              Math.min(viewWidth, viewHeight, 280) * 0.75
            );

            return {
              width: Math.max(140, size),
              height: Math.max(140, size)
            };
          },
          aspectRatio: 1
        },
        registerScannedMember,
        function () {
          // تجاهل أخطاء عدم العثور على رمز في الإطار الحالي.
        }
      );

      isScanning = true;
      elements.placeholder.hidden = true;

      elements.startButton.replaceChildren();

      const stopIcon = document.createElement("span");
      stopIcon.className = "material-symbols-outlined";
      stopIcon.textContent = "videocam_off";

      elements.startButton.append(stopIcon, "إيقاف الكاميرا");
      elements.startButton.disabled = false;

      setCameraStatus("الكاميرا تعمل. وجّهها نحو رمز QR.", "success");

      elements.flashToggle.disabled = true;
      flashEnabled = false;
      elements.flashIcon.textContent = "flashlight_on";

      try {
        cameraTrack = qrScanner.getRunningTrackCameraCapabilities();

        elements.flashToggle.disabled = !(
          cameraTrack &&
          typeof cameraTrack.torchFeature === "function"
        );
      } catch (error) {
        cameraTrack = null;
      }
    } catch (error) {
      isScanning = false;
      qrScanner = null;
      elements.placeholder.hidden = false;
      elements.startButton.disabled = false;

      elements.startButton.replaceChildren();

      const retryIcon = document.createElement("span");
      retryIcon.className = "material-symbols-outlined";
      retryIcon.textContent = "refresh";

      elements.startButton.append(
        retryIcon,
        "إعادة محاولة تشغيل الكاميرا"
      );

      setCameraStatus(
        "لم نتمكن من تشغيل الكاميرا. تحقق من الإذن ورابط HTTPS.",
        "error"
      );

      showResult(
        "error",
        "تعذّر تشغيل الكاميرا",
        "تأكد من السماح باستخدام الكاميرا، وأن الموقع مفتوح عبر HTTPS."
      );
    }
  }

  async function stopScanner() {
    if (!qrScanner || !isScanning) {
      isScanning = false;
      return;
    }

    try {
      await qrScanner.stop();
      await qrScanner.clear();
    } catch (error) {
      // نكمل تنظيف الحالة حتى لو تعذّر إيقاف القارئ.
    }

    qrScanner = null;
    isScanning = false;
    cameraTrack = null;
    flashEnabled = false;

    elements.placeholder.hidden = false;
    elements.flashToggle.disabled = true;
    elements.flashIcon.textContent = "flashlight_on";
    elements.flashToggle.setAttribute("aria-label", "تشغيل الفلاش");
    elements.startButton.disabled = false;

    elements.startButton.replaceChildren();

    const startIcon = document.createElement("span");
    startIcon.className = "material-symbols-outlined";
    startIcon.textContent = "photo_camera";

    elements.startButton.append(startIcon, "تشغيل الكاميرا");

    setCameraStatus("الكاميرا متوقفة.", "info");
  }

  async function toggleScanner() {
    if (isScanning) {
      await stopScanner();
    } else {
      await startScanner();
    }
  }

  async function toggleFlash() {
    if (!qrScanner || !isScanning || !cameraTrack) {
      return;
    }

    try {
      const capabilities = qrScanner.getRunningTrackCameraCapabilities();

      if (
        !capabilities ||
        typeof capabilities.torchFeature !== "function"
      ) {
        showResult(
          "neutral",
          "الفلاش غير مدعوم",
          "هذا الجهاز أو المتصفح لا يتيح التحكم بالفلاش."
        );

        return;
      }

      await capabilities.torchFeature().apply(!flashEnabled);
      flashEnabled = !flashEnabled;

      elements.flashIcon.textContent = flashEnabled
        ? "flashlight_off"
        : "flashlight_on";

      elements.flashToggle.setAttribute(
        "aria-label",
        flashEnabled ? "إيقاف الفلاش" : "تشغيل الفلاش"
      );
    } catch (error) {
      showResult(
        "warning",
        "تعذّر تغيير الفلاش",
        "قد لا يدعم الجهاز هذه الميزة أو تكون الكاميرا مشغولة."
      );
    }
  }

  function toggleManualPanel(forceOpen) {
    const shouldOpen =
      typeof forceOpen === "boolean"
        ? forceOpen
        : elements.manualPanel.hidden;

    elements.manualPanel.hidden = !shouldOpen;

    if (shouldOpen) {
      elements.memberIdInput.focus();
    } else {
      elements.manualForm.reset();
    }
  }

  async function submitManualEntry(event) {
    event.preventDefault();

    const memberId = elements.memberIdInput.value.trim();

    if (!/^[A-Za-z0-9_-]{1,20}$/.test(memberId)) {
      showResult(
        "error",
        "رقم العضو غير صالح",
        "أدخل رقم عضو صحيحاً مثل M001."
      );

      return;
    }

    showResult(
      "neutral",
      "التسجيل اليدوي يحتاج صلاحية صاحب النظام",
      "افتح صفحة العضو من حساب صاحب النظام لإتمام التسجيل اليدوي. لم يتم تسجيل الحضور من هذه الشاشة."
    );

    setCameraStatus(
      "لم يتم تسجيل حضور يدوي من هذه الشاشة.",
      "info"
    );
  }

  async function loadSessionInfo() {
    try {
      const result = await api("sessionInfo");
      const session = result.session || result;

      const type = session.sessionType || session.type || "";
      const start = session.startTime || session.start || "";

      if (type && start) {
        elements.sessionLabel.textContent =
          type + " · البداية " + start;
      } else if (type) {
        elements.sessionLabel.textContent = type;
      } else {
        elements.sessionLabel.textContent = "معلومات الجلسة غير متاحة";
      }
    } catch (error) {
      elements.sessionLabel.textContent = "بانتظار ربط النظام";
    }
  }

  function initialize() {
    if (
      typeof guard === "function" &&
      !guard(["observer", "owner"])
    ) {
      return;
    }

    elements.backButton.addEventListener("click", function () {
      if (getSessionRole() === "owner") {
        window.location.href = APP_PAGES.home;
      } else {
        showInfo("أنت في صفحة مسح الحضور.");
      }
    });

    elements.startButton.addEventListener("click", toggleScanner);
    elements.flashToggle.addEventListener("click", toggleFlash);

    elements.manualButton.addEventListener("click", function () {
      toggleManualPanel();
    });

    elements.manualCancel.addEventListener("click", function () {
      toggleManualPanel(false);
    });

    elements.manualForm.addEventListener("submit", submitManualEntry);

    loadSessionInfo();
  }

  window.addEventListener("pagehide", function () {
    if (qrScanner && isScanning) {
      qrScanner.stop().catch(function () {});
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
