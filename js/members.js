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

// نافذة التعديل
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editMother = document.getElementById("editMother");
const editInstrument = document.getElementById("editInstrument");
const editError = document.getElementById("editError");
const editSave = document.getElementById("editSave");
const editCancel = document.getElementById("editCancel");

// نافذة الحذف
const deleteModal = document.getElementById("deleteModal");
const deleteText = document.getElementById("deleteText");
const deleteError = document.getElementById("deleteError");
const deleteConfirm = document.getElementById("deleteConfirm");
const deleteCancel = document.getElementById("deleteCancel");

let allMembers = [];
let editingMember = null;
let deletingMember = null;
let isSaving = false;
let isDeleting = false;
let lastFocusedElement = null;

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

/* الاسم الثلاثي فقط — الكنية لم تعد تُعرض ولا تُستعمل في البحث. */
function getMemberName(member) {
  return String(firstValue(member, [
    "fullName",
    "name",
    "الاسم الثلاثي"
  ], "بدون اسم"));
}

function getMemberMother(member) {
  return String(firstValue(member, [
    "motherName",
    "mother",
    "اسم الأم"
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
    getMemberMother(member),
    getMemberInstrument(member)
  ].join(" "));
}

/*
 * نص البحث يُحسب مرة واحدة لكل عضو بدل إعادة حسابه مع كل حرف.
 */
const searchTextCache = new WeakMap();

function getCachedSearchText(member) {
  let text = searchTextCache.get(member);

  if (text === undefined) {
    text = getMemberSearchText(member);
    searchTextCache.set(member, text);
  }

  return text;
}

function debounce(callback, wait) {
  let timer = null;

  return function () {
    clearTimeout(timer);
    timer = setTimeout(callback, wait);
  };
}

function updateStats() {
  const active = allMembers.filter(
    member => getMemberStatus(member) === "active"
  ).length;

  totalCount.textContent = String(allMembers.length);
  activeCount.textContent = String(active);
  disabledCount.textContent = String(allMembers.length - active);
}

function createActionButton(className, iconName, label, ariaLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "member-action " + className;
  button.setAttribute("aria-label", ariaLabel);

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = iconName;

  const text = document.createElement("span");
  text.textContent = label;

  button.append(icon, text);

  return button;
}

function createMemberCard(member) {
  const id = getMemberId(member);
  const name = getMemberName(member);
  const instrument = getMemberInstrument(member);
  const status = getMemberStatus(member);

  const card = document.createElement("article");
  card.className = "member-card" + (status === "disabled" ? " disabled" : "");

  // المنطقة القابلة للضغط لفتح بطاقة العضو.
  const open = document.createElement("button");
  open.type = "button";
  open.className = "member-open";
  open.setAttribute(
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
  memberName.textContent = name;

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
  open.append(avatar, main, arrow);

  open.addEventListener("click", function () {
    if (!id) {
      showListError("لا يوجد رقم عضوية لهذا السجل، لذلك لا يمكن فتح البطاقة.");
      return;
    }

    window.location.href =
      APP_PAGES.memberCard + "?id=" + encodeURIComponent(id);
  });

  // أزرار التعديل والحذف.
  const actions = document.createElement("div");
  actions.className = "member-actions";

  const editButton = createActionButton(
    "edit",
    "edit",
    "تعديل",
    "تعديل بيانات " + name
  );

  const deleteButton = createActionButton(
    "delete",
    "delete",
    "حذف",
    "حذف العضو " + name
  );

  editButton.addEventListener("click", function () {
    openEditModal(member, editButton);
  });

  deleteButton.addEventListener("click", function () {
    openDeleteModal(member, deleteButton);
  });

  actions.append(editButton, deleteButton);
  card.append(open, actions);

  return card;
}

function showLoading() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");
  memberList.replaceChildren();
}

/* اسم خاص حتى لا نغطّي showError الموجودة في ui.js */
function showListError(message) {
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
      getCachedSearchText(member).includes(searchTerm);

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

    showListError(
      "رابط API غير مضبوط بعد. الواجهة جاهزة، لكن قائمة الأعضاء تحتاج إلى الربط مع Google Sheets."
    );

    return;
  }

  try {
    // نعرض القائمة المخزّنة فوراً (إن وجدت) ثم نحدّثها بالنسخة الحديثة.
    await apiCached("listMembers", {}, function (result) {
      const members = getMemberArray(result);

      if (!members) {
        throw new Error(
          "استجابة listMembers لا تحتوي على قائمة أعضاء بالشكل المتوقع. يجب أن تعيد مصفوفة مباشرة أو members أو items."
        );
      }

      allMembers = members;
      updateStats();
      renderMembers();
    });

  } catch (error) {
    allMembers = [];
    updateStats();

    showListError(
      error && error.message
        ? error.message
        : "تعذّر تحميل الأعضاء. تحقق من الاتصال وحاول مجدداً."
    );
  }
}

/* =========================================================
   النوافذ (تعديل / حذف)
   ========================================================= */

function lockPage() {
  document.body.style.overflow = "hidden";
}

function unlockPage() {
  if (editModal.hidden && deleteModal.hidden) {
    document.body.style.overflow = "";
  }
}

function restoreFocus() {
  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}

function setModalError(element, message) {
  element.textContent = message || "";
  element.hidden = !message;
}

/* ---------- التعديل ---------- */
function openEditModal(member, trigger) {
  editingMember = member;
  lastFocusedElement = trigger || null;

  editName.value = getMemberName(member) === "بدون اسم"
    ? ""
    : getMemberName(member);
  editMother.value = getMemberMother(member);

  const instrument = getMemberInstrument(member);
  const hasOption = Array.from(editInstrument.options).some(
    option => option.value === instrument
  );

  editInstrument.value = hasOption ? instrument : editInstrument.options[0].value;

  setModalError(editError, "");
  editModal.hidden = false;
  lockPage();
  editName.focus();
}

function closeEditModal() {
  if (isSaving) {
    return;
  }

  editModal.hidden = true;
  editingMember = null;
  unlockPage();
  restoreFocus();
}

async function saveEdit(event) {
  event.preventDefault();

  if (isSaving || !editingMember) {
    return;
  }

  const id = getMemberId(editingMember);
  const fullName = editName.value.trim();
  const motherName = editMother.value.trim();
  const instrument = editInstrument.value;

  if (!fullName || !motherName) {
    setModalError(editError, "يرجى تعبئة الاسم الثلاثي واسم الأم.");
    (fullName ? editMother : editName).focus();
    return;
  }

  isSaving = true;
  editSave.disabled = true;
  editSave.textContent = "جارٍ الحفظ...";
  setModalError(editError, "");

  try {
    await api("updateMember", {
      id: id,
      fullName: fullName,
      motherName: motherName,
      instrument: instrument
    });

    clearApiCache();

    // نحدّث العضو محلياً بدل إعادة تحميل القائمة كاملة.
    const index = allMembers.indexOf(editingMember);

    if (index !== -1) {
      allMembers[index] = Object.assign({}, editingMember, {
        fullName: fullName,
        motherName: motherName,
        instrument: instrument
      });
    }

    isSaving = false;
    closeEditModal();
    renderMembers();

    if (typeof showSuccess === "function") {
      showSuccess("تم تحديث بيانات العضو.");
    }
  } catch (error) {
    setModalError(
      editError,
      error && error.message
        ? error.message
        : "تعذّر حفظ التعديلات. تحقق من الاتصال وحاول مجدداً."
    );
  } finally {
    isSaving = false;
    editSave.disabled = false;
    editSave.textContent = "حفظ التعديلات";
  }
}

/* ---------- الحذف ---------- */
function openDeleteModal(member, trigger) {
  deletingMember = member;
  lastFocusedElement = trigger || null;

  deleteText.textContent =
    "سيتم حذف العضو «" + getMemberName(member) +
    "» (" + getMemberId(member) + ") نهائياً، ولن يعمل رمز QR الخاص به بعد الآن. لا يمكن التراجع عن هذه العملية.";

  setModalError(deleteError, "");
  deleteModal.hidden = false;
  lockPage();
  deleteCancel.focus();
}

function closeDeleteModal() {
  if (isDeleting) {
    return;
  }

  deleteModal.hidden = true;
  deletingMember = null;
  unlockPage();
  restoreFocus();
}

async function confirmDelete() {
  if (isDeleting || !deletingMember) {
    return;
  }

  const target = deletingMember;
  const id = getMemberId(target);

  isDeleting = true;
  deleteConfirm.disabled = true;
  deleteCancel.disabled = true;
  deleteConfirm.textContent = "جارٍ الحذف...";
  setModalError(deleteError, "");

  try {
    await api("deleteMember", { id: id });

    clearApiCache();

    allMembers = allMembers.filter(function (member) {
      return member !== target;
    });

    isDeleting = false;
    closeDeleteModal();
    updateStats();
    renderMembers();

    if (typeof showSuccess === "function") {
      showSuccess("تم حذف العضو.");
    }
  } catch (error) {
    setModalError(
      deleteError,
      error && error.message
        ? error.message
        : "تعذّر حذف العضو. تحقق من الاتصال وحاول مجدداً."
    );
  } finally {
    isDeleting = false;
    deleteConfirm.disabled = false;
    deleteCancel.disabled = false;
    deleteConfirm.textContent = "نعم، احذف";
  }
}

editForm.addEventListener("submit", saveEdit);
editCancel.addEventListener("click", closeEditModal);
deleteConfirm.addEventListener("click", confirmDelete);
deleteCancel.addEventListener("click", closeDeleteModal);

// الضغط على الخلفية المعتمة يغلق النافذة.
editModal.addEventListener("click", function (event) {
  if (event.target === editModal) {
    closeEditModal();
  }
});

deleteModal.addEventListener("click", function (event) {
  if (event.target === deleteModal) {
    closeDeleteModal();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") {
    return;
  }

  if (!editModal.hidden) {
    closeEditModal();
  } else if (!deleteModal.hidden) {
    closeDeleteModal();
  }
});

/* =========================================================
   البحث والفلاتر
   ========================================================= */
searchInput.addEventListener("input", debounce(renderMembers, 150));
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

const headerLogo = document.getElementById("headerLogo");
const logoFallback = document.getElementById("logoFallback");

headerLogo.addEventListener("error", function () {
  headerLogo.hidden = true;
  logoFallback.hidden = false;
});

// صفحة الأعضاء للمسؤول فقط (الخادم هو الذي يفرض الصلاحية فعلياً).
if (typeof guard !== "function" || guard(["owner"])) {
  loadMembers();
}
