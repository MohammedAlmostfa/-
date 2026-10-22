
"use strict";

const searchInput = document.getElementById("searchInput");
const instrumentFilter = document.getElementById("instrumentFilter");
const statusFilter = document.getElementById("statusFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

const totalCount = document.getElementById("totalCount");
const activeCount = document.getElementById("activeCount");
const disabledCount = document.getElementById("disabledCount");
const resultsCount = document.getElementById("resultsCount");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorText = document.getElementById("errorText");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyText = document.getElementById("emptyText");
const memberList = document.getElementById("memberList");

let allMembers = [];

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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function getMemberId(member) {
  return String(firstValue(member, ["id", "ID", "memberId"]));
}

function getMemberName(member) {
  return String(firstValue(member, [
    "fullName",
    "name",
    "الاسم الثلاثي"
  ], "بدون اسم"));
}

function getMemberFamily(member) {
  return String(firstValue(member, [
    "familyName",
    "family",
    "الكنية"
  ]));
}

function getMemberInstrument(member) {
  const raw = String(firstValue(member, [
    "instrument",
    "الآلة"
  ]));

  const instruments = {
    trumpet: "ترومبيت",
    tanbour: "طنبور",
    drum: "طنبور",
    ceremonial: "مراسم"
  };

  return instruments[raw] || raw || "غير محددة";
}

function getMemberStatus(member) {
  const raw = normalizeText(firstValue(member, [
    "status",
    "الحالة"
  ], "فعال"));

  if (
    raw === "معطل" ||
    raw === "disabled" ||
    raw === "inactive"
  ) {
    return "disabled";
  }

  return "active";
}

function getMemberSearchText(member) {
  return normalizeText([
    getMemberId(member),
    getMemberName(member),
    getMemberFamily(member),
    firstValue(member, ["motherName", "mother", "اسم الأم"]),
    getMemberInstrument(member)
  ].join(" "));
}

function updateStats() {
  const active = allMembers.filter(
    member => getMemberStatus(member) === "active"
  ).length;

  totalCount.textContent = String(allMembers.length);
  activeCount.textContent = String(active);
  disabledCount.textContent = String(allMembers.length - active);
}

function createMemberCard(member) {
  const id = getMemberId(member);
  const name = getMemberName(member);
  const family = getMemberFamily(member);
  const instrument = getMemberInstrument(member);
  const status = getMemberStatus(member);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "member-card";
  button.setAttribute(
    "aria-label",
    "عرض بطاقة العضو " + name + "، رقم " + id
  );

  const avatar = document.createElement("span");
  avatar.className = "member-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = name.trim().charAt(0) || "؟";

  const main = document.createElement("span");
  main.className = "member-main";

  const memberName = document.createElement("span");
  memberName.className = "member-name";
  memberName.textContent = name + (family ? " " + family : "");

  const memberId = document.createElement("span");
  memberId.className = "member-id";
  memberId.textContent = id || "—";

  const meta = document.createElement("span");
  meta.className = "member-meta";

  const instrumentText = document.createElement("span");
  instrumentText.className = "member-instrument";
  instrumentText.textContent = instrument;

  const statusPill = document.createElement("span");
  statusPill.className =
    "status-pill" + (status === "disabled" ? " disabled" : "");
  statusPill.textContent = status === "disabled" ? "معطّل" : "فعّال";

  const arrow = document.createElement("span");
  arrow.className = "member-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "‹";

  meta.append(instrumentText, statusPill);
  main.append(memberName, memberId, meta);
  button.append(avatar, main, arrow);

  button.addEventListener("click", function () {
    if (!id) {
      showError("لا يوجد رقم عضوية لهذا السجل، لذلك لا يمكن فتح البطاقة.");
      return;
    }

    window.location.href =
      APP_PAGES.memberCard + "?id=" + encodeURIComponent(id);
  });

  return button;
}

function showLoading() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");
  memberList.replaceChildren();
}

function showError(message) {
  loadingState.classList.add("hidden");
  emptyState.classList.add("hidden");
  memberList.replaceChildren();

  errorText.textContent = message;
  errorState.classList.remove("hidden");
  resultsCount.textContent = "تعذّر تحميل النتائج";
}

function getMemberArray(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && Array.isArray(result.members)) {
    return result.members;
  }

  if (result && Array.isArray(result.items)) {
    return result.items;
  }

  return null;
}

function renderMembers() {
  const searchTerm = normalizeText(searchInput.value);
  const selectedInstrument = instrumentFilter.value;
  const selectedStatus = statusFilter.value;

  const filteredMembers = allMembers.filter(function (member) {
    const matchesSearch =
      !searchTerm ||
      getMemberSearchText(member).includes(searchTerm);

    const matchesInstrument =
      !selectedInstrument ||
      getMemberInstrument(member) === selectedInstrument;

    const matchesStatus =
      !selectedStatus ||
      getMemberStatus(member) === selectedStatus;

    return matchesSearch && matchesInstrument && matchesStatus;
  });

  memberList.replaceChildren();
  loadingState.classList.add("hidden");
  errorState.classList.add("hidden");

  resultsCount.textContent =
    "عرض " + filteredMembers.length + " من أصل " + allMembers.length + " عضو";

  if (filteredMembers.length === 0) {
    emptyTitle.textContent =
      allMembers.length === 0
        ? "لا يوجد أعضاء مسجّلون"
        : "لا توجد نتائج";

    emptyText.textContent =
      allMembers.length === 0
        ? "بعد ربط Google Sheets وإضافة الأعضاء، ستظهر القائمة هنا."
        : "لم نعثر على أعضاء يطابقون البحث والفلاتر الحالية. جرّب تغيير كلمات البحث أو مسح الفلاتر.";

    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  filteredMembers.forEach(function (member) {
    fragment.appendChild(createMemberCard(member));
  });

  memberList.appendChild(fragment);
}

async function loadMembers() {
  showLoading();
  resultsCount.textContent = "جارٍ تحميل الأعضاء...";

  if (typeof API_URL === "undefined" || !API_URL) {
    allMembers = [];
    updateStats();

    showError(
      "رابط API غير مضبوط بعد. الواجهة جاهزة، لكن قائمة الأعضاء تحتاج إلى الربط مع Google Sheets."
    );

    return;
  }

  try {
    const result = await api("listMembers", {});
    const members = getMemberArray(result);

    if (!members) {
      throw new Error(
        "استجابة listMembers لا تحتوي على قائمة أعضاء بالشكل المتوقع. يجب أن تعيد مصفوفة مباشرة أو members أو items."
      );
    }

    allMembers = members;
    updateStats();
    renderMembers();

  } catch (error) {
    allMembers = [];
    updateStats();

    showError(
      error && error.message
        ? error.message
        : "تعذّر تحميل الأعضاء. تحقق من الاتصال وحاول مجدداً."
    );
  }
}

searchInput.addEventListener("input", renderMembers);
instrumentFilter.addEventListener("change", renderMembers);
statusFilter.addEventListener("change", renderMembers);

clearFiltersBtn.addEventListener("click", function () {
  searchInput.value = "";
  instrumentFilter.value = "";
  statusFilter.value = "";

  renderMembers();
  searchInput.focus();
});

document.getElementById("retryBtn").addEventListener(
  "click",
  loadMembers
);

document.getElementById("backButton").addEventListener(
  "click",
  function () {
    window.location.href = APP_PAGES.home || "home.html";
  }
);

const headerLogo = document.getElementById("headerLogo");
const logoFallback = document.getElementById("logoFallback");

headerLogo.addEventListener("error", function () {
  headerLogo.hidden = true;
  logoFallback.hidden = false;
});

loadMembers();
