
"use strict";

const addMemberForm = document.getElementById("addMemberForm");
const fullNameInput = document.getElementById("fullName");
const familyNameInput = document.getElementById("familyName");
const motherNameInput = document.getElementById("motherName");
const instrumentInput = document.getElementById("instrument");
const instrumentGroup = document.getElementById("instrumentGroup");
const saveMemberButton = document.getElementById("saveMemberButton");
const saveButtonText = document.getElementById("saveButtonText");
const formNotice = document.getElementById("formNotice");
const noticeText = document.getElementById("noticeText");
const noticeIcon = document.getElementById("noticeIcon");

let isSubmitting = false;

function showFormNotice(message, type = "info") {
  formNotice.className = "form-notice " + type;
  noticeText.textContent = message;

  noticeIcon.textContent =
    type === "error"
      ? "error"
      : type === "success"
        ? "check_circle"
        : "info";

  formNotice.hidden = false;
}

function clearFormNotice() {
  formNotice.hidden = true;
  noticeText.textContent = "";
}

function selectInstrument(selectedButton) {
  instrumentGroup
    .querySelectorAll("[data-instrument]")
    .forEach(function (button) {
      const selected = button === selectedButton;

      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

  instrumentInput.value = selectedButton.dataset.instrument;

  clearFormNotice();
}

const instrumentButtons = Array.from(
  instrumentGroup.querySelectorAll("[data-instrument]")
);

instrumentButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    selectInstrument(button);
  });

  button.addEventListener("keydown", function (event) {
    const currentIndex = instrumentButtons.indexOf(button);
    let nextIndex;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % instrumentButtons.length;
    } else if (
      event.key === "ArrowRight" ||
      event.key === "ArrowUp"
    ) {
      nextIndex =
        (currentIndex - 1 + instrumentButtons.length) %
        instrumentButtons.length;
    } else {
      return;
    }

    event.preventDefault();

    instrumentButtons[nextIndex].focus();
    selectInstrument(instrumentButtons[nextIndex]);
  });
});

[fullNameInput, familyNameInput, motherNameInput].forEach(function (input) {
  input.addEventListener("input", clearFormNotice);
});

addMemberForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (isSubmitting) return;

  clearFormNotice();

  const fullName = fullNameInput.value.trim();
  const familyName = familyNameInput.value.trim();
  const motherName = motherNameInput.value.trim();
  const instrument = instrumentInput.value.trim();

  if (!fullName || !familyName || !motherName) {
    showFormNotice(
      "يرجى تعبئة الاسم الثلاثي والكنية واسم الأم قبل المتابعة.",
      "error"
    );

    if (!fullName) {
      fullNameInput.focus();
    } else if (!familyName) {
      familyNameInput.focus();
    } else {
      motherNameInput.focus();
    }

    return;
  }

  if (!instrument) {
    showFormNotice("يرجى اختيار الآلة أو الرتبة.", "error");
    return;
  }

  if (typeof API_URL !== "string" || !API_URL.trim()) {
    showFormNotice(
      "رابط الخادم غير مضبوط؛ لم تتم إضافة العضو. تحقق من js/config.js.",
      "error"
    );
    return;
  }

  isSubmitting = true;
  saveMemberButton.disabled = true;
  saveButtonText.textContent = "جارٍ حفظ العضو...";

  try {
    const result = await api("addMember", {
      fullName: fullName,
      familyName: familyName,
      motherName: motherName,
      instrument: instrument
    });

    // قائمة الأعضاء والأرقام تغيّرت: نحذف النسخ المخزّنة.
    clearApiCache();

    // addMember_ returns { member: { id: "M001", ... } }.
    const memberId =
      result && result.member && result.member.id
        ? String(result.member.id).trim()
        : result && result.id
          ? String(result.id).trim()
          : "";

    if (!memberId) {
      showFormNotice(
        "وصل رد من الخادم، لكن لم يظهر رقم العضو في النتيجة. لا تعِد الإضافة مباشرةً قبل التأكد من ورقة Members.",
        "error"
      );
      return;
    }

    showFormNotice(
      "تمت إضافة العضو بنجاح. رقم العضو: " + memberId,
      "success"
    );

    window.setTimeout(function () {
      window.location.href =
        "member-card.html?id=" + encodeURIComponent(memberId);
    }, 900);
  } catch (error) {
    showFormNotice(
      error && error.message
        ? error.message
        : "تعذّر حفظ العضو. تحقق من الاتصال وحاول مجدداً.",
      "error"
    );
  } finally {
    isSubmitting = false;
    saveMemberButton.disabled = false;
    saveButtonText.textContent = "حفظ وإنشاء QR";
  }
});

document.getElementById("backButton").addEventListener("click", function () {
  window.location.href = "members.html";
});

if (typeof guard === "function") {
  guard(["owner"]);
}
