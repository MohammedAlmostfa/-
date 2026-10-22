
"use strict";

const statusMessage = document.getElementById("statusMessage");
const loadingState = document.getElementById("loadingState");
const membershipCard = document.getElementById("membershipCard");
const actions = document.getElementById("actions");
const downloadBtn = document.getElementById("downloadBtn");
const printBtn = document.getElementById("printBtn");

let loadedMemberId = "";

function showMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message visible";

  if (isError) {
    statusMessage.classList.add("error");
  }
}

function hideMessage() {
  statusMessage.textContent = "";
  statusMessage.className = "status-message";
}

function setText(id, value) {
  document.getElementById(id).textContent =
    value === undefined || value === null || value === ""
      ? "—"
      : String(value);
}

function firstValue(object, keys, fallback = "") {
  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ""
    ) {
      return object[key];
    }
  }

  return fallback;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parts = raw.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return raw;
}

function normalizeInstrument(value) {
  const instruments = {
    trumpet: "ترومبيت",
    tanbour: "طنبور",
    drum: "طنبور",
    ceremonial: "مراسم"
  };

  return instruments[value] || value || "—";
}

function normalizeStatus(value) {
  if (value === "disabled" || value === "معطّل") {
    return {
      text: "معطّل",
      disabled: true
    };
  }

  return {
    text: "فعّال",
    disabled: false
  };
}

function renderQr(memberId) {
  const qrContainer = document.getElementById("qrcode");
  const qrWarning = document.getElementById("qrWarning");

  qrContainer.replaceChildren();

  qrWarning.classList.add("hidden");
  qrWarning.textContent = "";

  if (typeof QRCode === "undefined") {
    qrWarning.textContent =
      "تعذّر تحميل مكتبة QR. تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة.";

    qrWarning.classList.remove("hidden");
    return false;
  }

  // يحتوي الرمز على رقم العضو فقط، وليس على بياناته الشخصية.
  new QRCode(qrContainer, {
    text: memberId,
    width: 156,
    height: 156,
    colorDark: "#282321",
    colorLight: "#FFFFFF",
    correctLevel: QRCode.CorrectLevel.M
  });

  document.getElementById("qrMemberId").textContent = memberId;

  return true;
}

function renderMember(member) {
  const id = firstValue(member, ["id", "ID", "memberId"]);

  const fullName = firstValue(member, [
    "fullName",
    "name",
    "الاسم الثلاثي"
  ]);

  const familyName = firstValue(member, [
    "familyName",
    "family",
    "الكنية"
  ]);

  const motherName = firstValue(member, [
    "motherName",
    "mother",
    "اسم الأم"
  ]);

  const instrument = firstValue(member, [
    "instrument",
    "الآلة"
  ]);

  const status = firstValue(
    member,
    ["status", "الحالة"],
    "فعّال"
  );

  const joinDate = firstValue(member, [
    "joinDate",
    "createdAt",
    "addedAt",
    "تاريخ الإضافة"
  ]);

  if (!id || !fullName) {
    throw new Error(
      "بيانات العضو وصلت، لكنها لا تتضمن رقم العضوية والاسم بالشكل المتوقع."
    );
  }

  loadedMemberId = String(id);

  setText("memberName", fullName);

  setText(
    "memberFamily",
    familyName ? "الكنية: " + familyName : ""
  );

  setText("memberId", id);
  setText("memberInstrument", normalizeInstrument(instrument));
  setText("memberJoinDate", formatDate(joinDate));
  setText("memberMother", motherName);

  const normalizedStatus = normalizeStatus(status);
  const statusElement = document.getElementById("memberStatus");

  setText("memberStatusText", normalizedStatus.text);

  statusElement.classList.toggle(
    "disabled",
    normalizedStatus.disabled
  );

  renderQr(String(id));

  loadingState.classList.add("hidden");
  membershipCard.classList.remove("hidden");
  actions.classList.remove("hidden");
}

async function loadMember() {
  hideMessage();

  const params = new URLSearchParams(window.location.search);
  const memberId = (params.get("id") || "").trim();

  if (!memberId) {
    loadingState.classList.add("hidden");

    showMessage(
      "لم يصل رقم العضو إلى صفحة البطاقة. ارجع إلى صفحة الأعضاء وتحقق من عملية الإضافة.",
      true
    );

    return;
  }

  if (typeof API_URL === "undefined" || !API_URL) {
    loadingState.classList.add("hidden");

    showMessage(
      "رابط الخادم غير مضبوط في js/config.js.",
      true
    );

    return;
  }

  loadingState.classList.remove("hidden");
  membershipCard.classList.add("hidden");
  actions.classList.add("hidden");

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await api("getMember", {
        id: memberId
      });

      const member =
        result &&
        result.member &&
        typeof result.member === "object"
          ? result.member
          : result;

      if (!member || typeof member !== "object") {
        throw new Error("لم تصل بيانات صالحة لهذا العضو.");
      }

      const returnedId = firstValue(
        member,
        ["id", "ID", "memberId"]
      );

      if (
        !returnedId ||
        String(returnedId).trim() !== memberId
      ) {
        throw new Error(
          "رقم العضو المطلوب لا يطابق رقم العضو الذي أعاده الخادم."
        );
      }

      renderMember(member);

      return;
    } catch (error) {
      lastError = error;

      if (attempt < 2) {
        await new Promise(function (resolve) {
          window.setTimeout(resolve, 1000);
        });
      }
    }
  }

  loadingState.classList.add("hidden");

  showMessage(
    lastError && lastError.message
      ? lastError.message
      : "تعذّر تحميل بيانات العضو. تحقق من وجوده في Google Sheets.",
    true
  );
}

async function downloadCard() {
  if (!loadedMemberId) {
    showMessage("لا توجد بطاقة محمّلة لتنزيلها.", true);
    return;
  }

  if (typeof html2canvas === "undefined") {
    showMessage(
      "تعذّر تحميل أداة تنزيل البطاقة. تحقق من اتصال الإنترنت.",
      true
    );

    return;
  }

  downloadBtn.disabled = true;
  downloadBtn.textContent = "جارٍ تجهيز الصورة...";

  try {
    const canvas = await html2canvas(membershipCard, {
      scale: 2,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false
    });

    const link = document.createElement("a");

    link.download = "hadir-member-" + loadedMemberId + ".png";
    link.href = canvas.toDataURL("image/png");

    link.click();
  } catch (error) {
    showMessage(
      "تعذّر إنشاء صورة البطاقة. جرّب الطباعة أو أعد المحاولة.",
      true
    );
  } finally {
    downloadBtn.disabled = false;

    downloadBtn.innerHTML =
      '<span aria-hidden="true">↓</span> تنزيل البطاقة';
  }
}

downloadBtn.addEventListener("click", downloadCard);

printBtn.addEventListener("click", function () {
  if (!loadedMemberId) {
    showMessage("لا توجد بطاقة محمّلة للطباعة.", true);
    return;
  }

  window.print();
});

document.getElementById("cardLogo").addEventListener("error", function () {
  this.style.display = "none";

  document.getElementById("logoFallback").style.display = "block";
});

loadMember();
