/**
 * حاضر — نظام تسجيل الحضور
 * Google Apps Script + Google Sheets
 *
 * المنطقة الزمنية: Asia/Damascus
 *
 * ابدأ بتشغيل setupHadir() مرة واحدة من محرر Apps Script.
 * (اختياري) شغّل installTriggers() مرة واحدة لإبقاء الكاش دافئًا.
 *
 * ملاحظة مهمة بعد أي تعديل: Deploy ← Manage deployments ← Edit ← Version: New version
 * وإلا يبقى رابط الـ Web App يخدم النسخة القديمة.
 */

"use strict";

const APP_CONFIG = Object.freeze({
  NAME: "hadir",
  TIME_ZONE: "Asia/Damascus",
  TOKEN_TTL: 21600,
  SHEETS: {
    MEMBERS: "Members",
    ATTENDANCE: "Attendance",
    SETTINGS: "Settings",
    LOG: "Log"
  },
  HEADERS: {
    Members: [
      "ID",
      "الاسم الثلاثي",
  
      "اسم الأم",
      "الآلة",
      "الحالة",
      "تاريخ الإضافة"
    ],
    Attendance: ["ID", "الاسم"],
    Settings: ["المفتاح", "القيمة"],
    Log: ["الوقت", "ID", "الاسم", "الحالة", "المصدر"]
  },
  DEFAULT_SETTINGS: [
    ["وقت بداية الجلسة", "08:00"],
    ["كلمة سر المراقب", "غيّر-كلمة-سر-المراقب"],
    ["كلمة سر صاحب النظام", "غيّر-كلمة-سر-صاحب-النظام"],
    ["نوع الجلسة", "بروفة"]
  ]
});

/* =====================================================
   ثوابت الأداء
   =====================================================
   كل مفتاح كاش هنا يُبطَل تلقائيًا عند أي عملية تغيّر بياناته.
   أي تعديل يدوي مباشرة في Google Sheets يظهر بعد انتهاء مدة (TTL) الكاش المعني.
   ===================================================== */
const PERF_ = Object.freeze({
  SESSION_CACHE_KEY: "session_settings_v1",
  SESSION_CACHE_TTL: 120,   // وقت البداية ونوع الجلسة

  MEMBERS_KEY: "members_rows_v1",
  MEMBERS_TTL: 600,         // قائمة الأعضاء (تُبطَل عند add/update/setMemberStatus)

  ATT_ROWS_KEY: "att_rows_v1",
  ATT_ROWS_TTL: 21600,      // خريطة ID ← رقم صف الحضور (تُتحقَّق عند كل استخدام)

  ATT_COL_KEY: "att_col_v1_",
  ATT_COL_TTL: 21600,       // رقم عمود تاريخ اليوم (يُتحقَّق من ترويسته عند كل استخدام)

  SUMMARY_KEY: "summary_v1_",
  SUMMARY_TTL: 15,          // ملخص لوحة المتابعة (يُبطَل عند أي تسجيل في Log)

  DAY_KEY: "att_day_v1_",
  DAY_TTL: 300,             // حضور تاريخ سابق (الأيام الماضية فقط)

  // حد CacheService: 100KB للقيمة. نتجاوز التخزين بدل أن يفشل الطلب.
  MAX_CACHE_CHARS: 45000,

  // true: حساب "المراقب" لا يستطيع تنفيذ إلا عمليات المسح. غيّرها إلى false إن احتجت.
  ENFORCE_ROLES: true
});

// العمليات المسموحة للمراقب (مطابقة لما تستعمله صفحة المسح)
const OBSERVER_ACTIONS_ = Object.freeze([
  "sessionInfo",
  "scan",
  "manualCheckIn",
  "logout"
]);

// ذاكرة مؤقتة لتنفيذ واحد فقط (تُصفَّر مع كل طلب جديد)
const RUNTIME_ = {
  ss: null,
  sheets: {},
  settings: null,
  cache: {},
  memberRows: null,
  attMap: null,
  now: null
};

/* =====================================================
   1. إعداد قاعدة البيانات
   ===================================================== */

/**
 * شغّل هذه الدالة يدويًا مرة واحدة من Apps Script.
 * تنشئ الأوراق والعناوين والإعدادات الناقصة دون حذف بيانات موجودة.
 */
function setupHadir() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      "افتح Apps Script من داخل ملف Google Sheets الخاص بنظام حاضر."
    );
  }

  ss.setSpreadsheetTimeZone(APP_CONFIG.TIME_ZONE);

  Object.keys(APP_CONFIG.HEADERS).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = APP_CONFIG.HEADERS[sheetName];

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    } else {
      const existing = sheet
        .getRange(1, 1, 1, headers.length)
        .getDisplayValues()[0];

      const matches = headers.every(function (header, index) {
        return existing[index] === header;
      });

      if (!matches) {
        throw new Error(
          'عناوين الأعمدة غير مطابقة في ورقة "' +
            sheetName +
            '". لم يتم تعديل الورقة لتجنب إتلاف البيانات.'
        );
      }
    }
  });

  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.SETTINGS);
  const existingSettings = getSettings_();

  APP_CONFIG.DEFAULT_SETTINGS.forEach(function (item) {
    if (!(item[0] in existingSettings)) {
      settingsSheet.appendRow(item);
    }
  });

  const membersSheet = ss.getSheetByName(APP_CONFIG.SHEETS.MEMBERS);
  const attendanceSheet = ss.getSheetByName(APP_CONFIG.SHEETS.ATTENDANCE);
  membersSheet.getRange("A:A").setNumberFormat("@");
  attendanceSheet.getRange("A:B").setNumberFormat("@");
  attendanceSheet.getRange("C:ZZ").setNumberFormat("@");
  settingsSheet.getRange("A:B").setNumberFormat("@");

  SpreadsheetApp.flush();
  clearAppCaches_();

  return {
    ok: true,
    message: "تم تجهيز قاعدة بيانات حاضر."
  };
}

/**
 * فحص الاتصال عبر فتح رابط Web App لاحقًا.
 */
function doGet() {
  return jsonOutput_({
    ok: true,
    app: APP_CONFIG.NAME,
    message: "خدمة حاضر تعمل."
  });
}

/* =====================================================
   1.5 الكاش والمشغّلات (Triggers)
   ===================================================== */

/**
 * شغّلها مرة واحدة من المحرر: تنشئ مشغّلاً كل 5 دقائق يُدفّئ الكاش،
 * فلا يدفع أول مستخدم بعد فترة خمول ثمن القراءة البطيئة.
 */
function installTriggers() {
  removeTriggers();

  ScriptApp.newTrigger("warmCaches")
    .timeBased()
    .everyMinutes(5)
    .create();

  return { ok: true, message: "تم تفعيل تدفئة الكاش كل 5 دقائق." };
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "warmCaches") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  return { ok: true };
}

/**
 * يعيد بناء الكاش الأساسي من الأوراق (تُستدعى من المشغّل).
 * اسمها بدون "_" لأن المشغّلات لا تستدعي الدوال الخاصة.
 */
function warmCaches() {
  getMemberRows_(true);
  getAttendanceRowMap_(true);
  getTodayColumn_();
}

function cacheGet_(key) {
  if (Object.prototype.hasOwnProperty.call(RUNTIME_.cache, key)) {
    return RUNTIME_.cache[key];
  }

  const value = CacheService.getScriptCache().get(key);
  RUNTIME_.cache[key] = value === undefined ? null : value;

  return RUNTIME_.cache[key];
}

/**
 * جلب عدة مفاتيح بنداء واحد بدل نداء لكل مفتاح.
 */
function prefetchCache_(keys) {
  const found = CacheService.getScriptCache().getAll(keys);

  keys.forEach(function (key) {
    RUNTIME_.cache[key] = Object.prototype.hasOwnProperty.call(found, key)
      ? found[key]
      : null;
  });
}

function cachePut_(key, value, ttlSeconds) {
  if (String(value).length > PERF_.MAX_CACHE_CHARS) {
    // كبيرة على الكاش: نتجاوزه (يبقى الأداء كما كان بدونه)
    RUNTIME_.cache[key] = null;
    return false;
  }

  try {
    CacheService.getScriptCache().put(key, value, ttlSeconds);
    RUNTIME_.cache[key] = value;
    return true;
  } catch (error) {
    RUNTIME_.cache[key] = null;
    return false;
  }
}

function cacheRemove_(key) {
  RUNTIME_.cache[key] = null;
  CacheService.getScriptCache().remove(key);
}

function clearAppCaches_() {
  [
    PERF_.MEMBERS_KEY,
    PERF_.ATT_ROWS_KEY,
    PERF_.SESSION_CACHE_KEY,
    PERF_.SUMMARY_KEY + today_(),
    PERF_.ATT_COL_KEY + today_()
  ].forEach(function (key) {
    cacheRemove_(key);
  });

  RUNTIME_.memberRows = null;
  RUNTIME_.attMap = null;
  RUNTIME_.settings = null;
}

function invalidateMembers_() {
  RUNTIME_.memberRows = null;
  cacheRemove_(PERF_.MEMBERS_KEY);
  invalidateSummary_();
}

function invalidateSummary_() {
  cacheRemove_(PERF_.SUMMARY_KEY + today_());
}

/**
 * نجلب مسبقًا (بنداء واحد) كل مفاتيح الكاش التي ستحتاجها العملية.
 */
function prefetchForAction_(action, token) {
  if (!token) return;

  const keys = ["session_" + token];

  if (action === "scan" || action === "manualCheckIn") {
    keys.push(
      PERF_.MEMBERS_KEY,
      PERF_.ATT_ROWS_KEY,
      PERF_.ATT_COL_KEY + today_()
    );

    if (action === "scan") keys.push(PERF_.SESSION_CACHE_KEY);
  } else if (action === "listMembers") {
    keys.push(PERF_.MEMBERS_KEY);
  } else if (action === "getMember") {
    keys.push(PERF_.MEMBERS_KEY, PERF_.ATT_ROWS_KEY);
  } else if (action === "summary") {
    keys.push(PERF_.SUMMARY_KEY + today_(), PERF_.MEMBERS_KEY);
  } else if (action === "sessionInfo") {
    keys.push(PERF_.SESSION_CACHE_KEY);
  }

  prefetchCache_(keys);
}

/* =====================================================
   2. استقبال طلبات الموقع
   ===================================================== */

function doPost(e) {
  try {
    const body =
      e && e.postData && e.postData.contents
        ? JSON.parse(e.postData.contents)
        : {};

    const action = String(body.action || "").trim();
    const token = String(body.token || "").trim();
    const data =
      body.data && typeof body.data === "object" ? body.data : {};

    if (!action) {
      return jsonOutput_(errorResponse_("invalid", "الطلب غير مكتمل."));
    }

    const result = routeAction_(action, token, data);

    return jsonOutput_({
      ok: true,
      data: result === undefined ? {} : result
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);

    if (error && error.isPublicError) {
      return jsonOutput_({
        ok: false,
        error: error.code,
        message: error.message
      });
    }

    return jsonOutput_(
      errorResponse_("server", "حدث خطأ أثناء تنفيذ الطلب. حاول مرة أخرى.")
    );
  }
}

function routeAction_(action, token, data) {
  // تسجيل الدخول هو العملية الوحيدة التي لا تحتاج جلسة مسبقة.
  if (action === "login") {
    return login_(data);
  }

  // جميع العمليات الأخرى تتطلب جلسة تسجيل دخول صالحة.
  prefetchForAction_(action, token);
  const role = requireRole_(token, ["observer", "owner"]);

  // صلاحيات الخادم: المراقب لا ينفّذ إلا عمليات المسح.
  if (
    PERF_.ENFORCE_ROLES &&
    role !== "owner" &&
    OBSERVER_ACTIONS_.indexOf(action) === -1
  ) {
    throw publicError_(
      "forbidden",
      "هذه العملية غير مسموحة لهذا الحساب."
    );
  }

  if (action === "sessionInfo") {
    return sessionInfo_();
  }

  if (action === "setSession") {
    return setSession_(data);
  }

  if (action === "scan") {
    return scanMember_(data);
  }

  if (action === "logout") {
    return logout_(token);
  }

  if (action === "summary") {
    return getSummary_();
  }

  if (action === "listMembers") {
    return listMembers_();
  }

  if (action === "addMember") {
    return addMember_(data);
  }

  if (action === "updateMember") {
    return updateMember_(data);
  }

  if (action === "deleteMember") {
    return deleteMember_(data);
  }

  if (action === "setMemberStatus") {
    return setMemberStatus_(data);
  }

  if (action === "getMember") {
    return getMember_(data);
  }

  if (action === "manualCheckIn") {
    return manualCheckIn_(data);
  }

  if (action === "logList") {
    return logList_(data);
  }

  if (action === "getAttendanceByDate") {
    return getAttendanceByDate_(data);
  }

  throw publicError_(
    "invalid",
    "العملية المطلوبة غير معروفة."
  );
}

/* =====================================================
   3. المصادقة والجلسات والصلاحيات
   ===================================================== */

function login_(data) {
  const password = String(data.password || "");
  const cache = CacheService.getScriptCache();
  const rateKey = "login_failures";
  const failures = Number(cache.get(rateKey) || 0);

  if (failures >= 10) {
    throw publicError_(
      "locked",
      "محاولات الدخول كثيرة. انتظر دقيقتين ثم حاول مجددًا."
    );
  }

  const settings = getSettings_();
  const observerPassword = String(settings["كلمة سر المراقب"] || "");
  const ownerPassword = String(settings["كلمة سر صاحب النظام"] || "");

  let role = "";

  if (
    observerPassword &&
    !observerPassword.startsWith("غيّر-") &&
    password === observerPassword
  ) {
    role = "observer";
  } else if (
    ownerPassword &&
    !ownerPassword.startsWith("غيّر-") &&
    password === ownerPassword
  ) {
    role = "owner";
  }

  if (!role) {
    cache.put(rateKey, String(failures + 1), 120);
    throw publicError_("unauthorized", "كلمة السر غير صحيحة.");
  }

  cache.remove(rateKey);

  const token = Utilities.getUuid();
  cache.put("session_" + token, role, APP_CONFIG.TOKEN_TTL);

  return {
    token: token,
    role: role
  };
}

function requireRole_(token, allowedRoles) {
  if (!token) {
    throw publicError_(
      "unauthorized",
      "انتهت الجلسة. سجّل الدخول مجددًا."
    );
  }

  const role = cacheGet_("session_" + token);

  if (!role) {
    throw publicError_(
      "unauthorized",
      "انتهت الجلسة. سجّل الدخول مجددًا."
    );
  }

  return role;
}

function logout_(token) {
  if (token) {
    cacheRemove_("session_" + token);
  }

  return { loggedOut: true };
}

function sessionInfo_() {
  const session = getSessionSettings_();

  return {
    startTime: session.startTime,
    sessionType: session.sessionType,
    date: today_()
  };
}

function setSession_(data) {
  const startTime = String(data.startTime || "").trim();
  const sessionType = String(data.sessionType || "").trim();

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    throw publicError_("invalid", "صيغة وقت البداية غير صحيحة.");
  }

  if (!sessionType || sessionType.length > 50) {
    throw publicError_("invalid", "نوع الجلسة غير صحيح.");
  }

  setSetting_("وقت بداية الجلسة", startTime);
  setSetting_("نوع الجلسة", sessionType);

  return {
    startTime: startTime,
    sessionType: sessionType
  };
}

/* =====================================================
   4. إدارة الأعضاء
   ===================================================== */

/**
 * صفوف ورقة Members (A:F) من الكاش، أو من الورقة عند غيابه أو عند fresh=true.
 * كل صف مصفوفة من 6 نصوص. الصفوف الفارغة تبقى في مواضعها حتى يبقى
 * رقم الصف = الفهرس + 2.
 */
function getMemberRows_(fresh) {
  if (!fresh) {
    if (RUNTIME_.memberRows) return RUNTIME_.memberRows;

    const cached = cacheGet_(PERF_.MEMBERS_KEY);

    if (cached) {
      try {
        RUNTIME_.memberRows = JSON.parse(cached);
        return RUNTIME_.memberRows;
      } catch (error) {
        // كاش تالف: نقرأ من الورقة
      }
    }
  }

  const sheet = getSheet_(APP_CONFIG.SHEETS.MEMBERS);
  const lastRow = sheet.getLastRow();
  const rows = lastRow < 2
    ? []
    : sheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();

  RUNTIME_.memberRows = rows;
  cachePut_(PERF_.MEMBERS_KEY, JSON.stringify(rows), PERF_.MEMBERS_TTL);

  return rows;
}

function listMembers_() {
  const members = getMemberRows_()
    .filter(function (row) {
      return String(row[0]).trim() !== "";
    })
    .map(function (row) {
      return memberFromRow_(row);
    });

  return { members: members };
}

/**
 * يجلب العضو ورقم صفه. يرجع null إذا لم يوجد.
 * القراءة من الكاش افتراضيًا؛ مرّر fresh=true قبل أي كتابة على صف العضو.
 */
function getMemberRecord_(id, fresh) {
  if (!id) return null;

  const rows = getMemberRows_(fresh === true);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === id) {
      return {
        rowNumber: i + 2,
        member: memberFromRow_(rows[i])
      };
    }
  }

  return null;
}

function addMember_(data) {
  data =
    data && typeof data === "object" && data.data && typeof data.data === "object"
      ? data.data
      : data || {};
  const fullName = cleanText_(data.fullName || data.name, 100);

  const motherName = cleanText_(data.motherName || data.mother, 100);
  const instrument = cleanText_(data.instrument, 40);

  if (!fullName ||  !motherName || !instrument) {
    throw publicError_("invalid", "يرجى تعبئة جميع حقول العضو.");
  }

  const allowedInstruments = ["ترومبيت", "طنبور", "مراسم"];

  if (allowedInstruments.indexOf(instrument) === -1) {
    throw publicError_("invalid", "الآلة المحددة غير صحيحة.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(APP_CONFIG.SHEETS.MEMBERS);
    const id = nextMemberId_();
    const date = today_();

    sheet.appendRow([
      id,
      fullName,

      motherName,
      instrument,
      "فعّال",
      date
    ]);

    const attendanceSheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
    attendanceSheet.appendRow([id, fullName]);
    addAttendanceRowToMap_(id, attendanceSheet.getLastRow());

    invalidateMembers_();

    return {
      member: {
        id: id,
        fullName: fullName,
  
        motherName: motherName,
        instrument: instrument,
        status: "فعّال",
        joinDate: date
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function updateMember_(data) {
  data =
    data && typeof data === "object" && data.data && typeof data.data === "object"
      ? data.data
      : data || {};
  const id = cleanText_(data.id, 20);

  if (!id) {
    throw publicError_("invalid", "رقم العضو مطلوب.");
  }

  // الكتابة تحتاج رقم الصف الحقيقي، فنقرأ من الورقة مباشرة.
  const record = getMemberRecord_(id, true);

  if (!record) {
    throw publicError_("notFound", "العضو غير موجود.");
  }

  const rowNumber = record.rowNumber;
  const current = record.member;

  const fullName = cleanText_(data.fullName || data.name, 100);

  const motherName = cleanText_(data.motherName || data.mother, 100);
  const instrument = cleanText_(data.instrument, 40);

  if (!fullName ||  !motherName || !instrument) {
    throw publicError_("invalid", "يرجى تعبئة جميع حقول العضو.");
  }

  if (["ترومبيت", "طنبور", "مراسم"].indexOf(instrument) === -1) {
    throw publicError_("invalid", "الآلة المحددة غير صحيحة.");
  }

  const sheet = getSheet_(APP_CONFIG.SHEETS.MEMBERS);

  sheet.getRange(rowNumber, 2, 1, 3).setValues([[
    fullName,

    motherName,
    instrument
  ]]);

  const attendanceSheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const attendanceRow = findAttendanceRow_(id);

  if (attendanceRow) {
    attendanceSheet.getRange(attendanceRow, 2).setValue(fullName);
  }

  invalidateMembers_();

  return {
    member: memberFromRow_([
      id,
      fullName,
  
      motherName,
      instrument,
      current.status,
      current.joinDate
    ])
  };
}

/**
 * حذف العضو من قائمة Members فقط.
 * نحتفظ بسجلات Attendance وLog للمحافظة على السجل التاريخي.
 * صلاحية owner مفروضة من routeAction_ قبل الوصول إلى هذه الدالة.
 */
function deleteMember_(data) {
  const id = cleanText_(data && data.id, 20);

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw publicError_("invalid", "رقم العضو غير صالح.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // البحث من الورقة مباشرة لتجنب الاعتماد على بيانات الكاش.
    const rowNumber = findMemberRow_(id);

    if (!rowNumber) {
      throw publicError_("notFound", "العضو غير موجود.");
    }

    getSheet_(APP_CONFIG.SHEETS.MEMBERS).deleteRow(rowNumber);

    // إزالة قائمة الأعضاء وملخص لوحة المتابعة من الكاش.
    invalidateMembers_();

    return {
      id: id,
      deleted: true,
      historyPreserved: true
    };
  } finally {
    lock.releaseLock();
  }
}

function setMemberStatus_(data) {
  const id = cleanText_(data.id, 20);
  const status = cleanText_(data.status, 20);

  if (!id || ["فعّال", "معطّل"].indexOf(status) === -1) {
    throw publicError_("invalid", "بيانات الحالة غير صحيحة.");
  }

  const rowNumber = findMemberRow_(id);

  if (!rowNumber) {
    throw publicError_("notFound", "العضو غير موجود.");
  }

  getSheet_(APP_CONFIG.SHEETS.MEMBERS)
    .getRange(rowNumber, 5)
    .setValue(status);

  invalidateMembers_();

  return { id: id, status: status };
}

function getMember_(data) {
  const id = cleanText_(data.id, 20);
  const record = getMemberRecord_(id);

  if (!record) {
    throw publicError_("notFound", "العضو غير موجود.");
  }

  const member = record.member;
  const attendance = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const lastColumn = Math.max(attendance.getLastColumn(), 2);
  const found = readAttendanceRow_(id, lastColumn);

  let attendanceRow = [];
  if (found) {
    attendanceRow = found.values;
  }

  const headers = attendance
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  const history = [];
  let present = 0;
  let absent = 0;

  for (let column = 2; column < headers.length; column++) {
    const date = String(headers[column] || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }

    if (member.joinDate && date < member.joinDate) {
      continue;
    }

    const value = String(attendanceRow[column] || "").trim();
    const status = value ? "حاضر" : "غائب";
    const time = value;

    if (value) {
      present++;
    } else {
      absent++;
    }

    history.push({
      date: date,
      status: status,
      time: time
    });
  }

  history.sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  const total = present + absent;

  return {
    member: member,
    history: history,
    statistics: {
      present: present,
      absent: absent,
      total: total,
      attendancePercentage: total
        ? Math.round((present / total) * 100)
        : 0
    }
  };
}

/* =====================================================
   5. تسجيل الحضور بالمسح أو يدويًا
   ===================================================== */

function scanMember_(data) {
  const id = cleanText_(data.id, 20);
  const record = getMemberRecord_(id);

  if (!record) {
    return { status: "notFound" };
  }

  const member = record.member;

  // قراءتان فقط من الورقة في المسار المعتاد:
  // 1) ترويسة عمود اليوم (للتحقق من الكاش)  2) صف العضو حتى عمود اليوم
  //    (يتحقق من رقم العضو ويكشف التكرار في نفس القراءة).
  // column = 0 يعني أن عمود اليوم لم يُنشأ بعد، فلا يمكن أن يكون هناك تكرار.
  const column = getTodayColumn_();
  const found = readAttendanceRow_(member.id, column || 2);
  const existing = found && column
    ? String(found.values[column - 1] || "").trim()
    : "";

  if (existing) {
    return {
      status: "duplicate",
      name: member.fullName,
      instrument: member.instrument,
      time: existing
    };
  }

  // مزامنة الاسم عند اختلافه فقط
  if (found && String(found.values[1] || "") !== member.fullName) {
    getSheet_(APP_CONFIG.SHEETS.ATTENDANCE)
      .getRange(found.row, 2)
      .setValue(member.fullName);
  }

  // ما لم يوجد (صف أو عمود) يُنشأ داخل القفل في registerAttendance_
  const ctx = {
    member: member,
    attendanceRow: found ? found.row : 0,
    column: column
  };

  registerAttendance_(member.id, "مسح", ctx);

  return {
    status: "ok",
    name: member.fullName,
    instrument: member.instrument,
    time: currentTime_()
  };
}

function manualCheckIn_(data) {
  const id = cleanText_(data.id, 20);

  if (!id) {
    throw publicError_("invalid", "رقم العضو مطلوب.");
  }

  const record = getMemberRecord_(id);

  if (!record) {
    throw publicError_("notFound", "العضو غير موجود.");
  }

  const member = record.member;

  registerAttendance_(member.id, "يدوي", { member: member });

  return {
    id: member.id,
    name: member.fullName,
    status: "ok",
    time: currentTime_()
  };
}

/**
 * نقطة تسجيل الحضور المشتركة.
 * ctx (اختياري، داخلي): { member, attendanceRow, column }
 * عند غيابه تعمل الدالة كما كانت تمامًا.
 */
function registerAttendance_(id, source, ctx) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  let member;
  let value;
  let logStatus;

  try {
    const context = ctx || {};
    member = context.member;

    if (!member) {
      const record = getMemberRecord_(id);

      if (!record) {
        throw publicError_("notFound", "العضو غير موجود.");
      }

      member = record.member;
    }

    const attendanceRow =
      context.attendanceRow || ensureAttendanceRow_(id, member.fullName);
    const column = context.column || ensureTodayColumn_();
    const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
    const cell = sheet.getRange(attendanceRow, column);

    // يبقى هذا الفحص داخل القفل لمنع التسجيل المزدوج عند المسح المتزامن
    if (String(cell.getDisplayValue() || "").trim()) {
      throw publicError_("invalid", "تم تسجيل حضور هذا العضو مسبقًا.");
    }

    value = currentTime_();

    cell.setNumberFormat("@");
    cell.setValue(value);
    cell.setBackground(null);
    cell.setFontColor(null);
    logStatus = "حاضر";
  } finally {
    lock.releaseLock();
  }

  // الكتابة في Log خارج القفل لتقصير مدة الحجز (appendRow آمنة بذاتها)
  appendLog_(id, member.fullName, logStatus, source);

  return {
    id: id,
    name: member.fullName,
    status: logStatus,
    time: value
  };
}

/* =====================================================
   8. دوال مساعدة للأعضاء والحضور
   ===================================================== */

function memberFromRow_(row) {
  return {
    id: String(row[0] || ""),
    fullName: String(row[1] || ""),
    motherName: String(row[2] || ""),
    instrument: String(row[3] || ""),
    status: String(row[4] || ""),
    joinDate: String(row[5] || "")
  };
}

/**
 * رقم صف العضو من الورقة مباشرة (للكتابة). لا يستعمل الكاش عمدًا.
 */
function findMemberRow_(id) {
  if (!id) return 0;

  const sheet = getSheet_(APP_CONFIG.SHEETS.MEMBERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return 0;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return i + 2;
  }

  return 0;
}

/**
 * خريطة { ID: رقم الصف } لورقة Attendance.
 * الكاش هنا "تلميح" فقط: readAttendanceRow_ يتحقق من الرقم عند كل قراءة،
 * فإذا تغيّر ترتيب الصفوف يدويًا تُعاد بناء الخريطة تلقائيًا.
 */
function getAttendanceRowMap_(fresh) {
  if (!fresh) {
    if (RUNTIME_.attMap) return RUNTIME_.attMap;

    const cached = cacheGet_(PERF_.ATT_ROWS_KEY);

    if (cached) {
      try {
        RUNTIME_.attMap = JSON.parse(cached);
        return RUNTIME_.attMap;
      } catch (error) {
        // كاش تالف: نعيد البناء
      }
    }
  }

  const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const lastRow = sheet.getLastRow();
  const map = {};

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i][0]).trim();

      if (id && !Object.prototype.hasOwnProperty.call(map, id)) {
        map[id] = i + 2;
      }
    }
  }

  RUNTIME_.attMap = map;
  cachePut_(PERF_.ATT_ROWS_KEY, JSON.stringify(map), PERF_.ATT_ROWS_TTL);

  return map;
}

function addAttendanceRowToMap_(id, row) {
  const raw = cacheGet_(PERF_.ATT_ROWS_KEY);

  if (!raw) return;

  try {
    const map = JSON.parse(raw);
    map[id] = row;
    RUNTIME_.attMap = map;
    cachePut_(PERF_.ATT_ROWS_KEY, JSON.stringify(map), PERF_.ATT_ROWS_TTL);
  } catch (error) {
    cacheRemove_(PERF_.ATT_ROWS_KEY);
    RUNTIME_.attMap = null;
  }
}

/**
 * يقرأ صف حضور العضو من العمود A حتى lastCol بقراءة واحدة،
 * ويتحقق أن الصف يخص العضو فعلًا. يرجع { row, values } أو null.
 */
function readAttendanceRow_(id, lastCol) {
  if (!id) return null;

  const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const width = Math.max(Number(lastCol) || 2, 2);

  for (let attempt = 0; attempt < 2; attempt++) {
    const row = getAttendanceRowMap_(attempt === 1)[id];

    if (!row) continue;

    try {
      const values = sheet.getRange(row, 1, 1, width).getDisplayValues()[0];

      if (String(values[0]).trim() === id) {
        return { row: row, values: values };
      }
    } catch (error) {
      // رقم صف خارج حدود الورقة (حُذفت صفوف): نعيد بناء الخريطة
    }
  }

  return null;
}

function findAttendanceRow_(id) {
  const found = readAttendanceRow_(id, 2);
  return found ? found.row : 0;
}

function ensureAttendanceRow_(id, name) {
  const found = readAttendanceRow_(id, 2);

  if (found) {
    // نكتب الاسم فقط عند اختلافه
    if (String(found.values[1] || "") !== name) {
      getSheet_(APP_CONFIG.SHEETS.ATTENDANCE)
        .getRange(found.row, 2)
        .setValue(name);
    }

    return found.row;
  }

  const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);

  sheet.appendRow([id, name]);

  const row = sheet.getLastRow();
  addAttendanceRowToMap_(id, row);

  return row;
}

/**
 * رقم عمود تاريخ اليوم إن وُجد (وإلا 0). يتحقق من الكاش بقراءة ترويسة واحدة.
 */
function getTodayColumn_() {
  const date = today_();
  const key = PERF_.ATT_COL_KEY + date;
  const cached = Number(cacheGet_(key) || 0);

  if (cached >= 3) {
    try {
      const header = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE)
        .getRange(1, cached)
        .getDisplayValue();

      if (String(header).trim() === date) {
        return cached;
      }
    } catch (error) {
      // عمود خارج الحدود: نبحث من جديد
    }
  }

  const column = findDateColumn_(date);

  if (column) {
    cachePut_(key, String(column), PERF_.ATT_COL_TTL);
  } else {
    cacheRemove_(key);
  }

  return column;
}

function ensureTodayColumn_() {
  const existing = getTodayColumn_();

  if (existing) {
    return existing;
  }

  const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const date = today_();
  const lastColumn = Math.max(sheet.getLastColumn(), 2);
  const newColumn = lastColumn + 1;
  const maxColumns = sheet.getMaxColumns();

  // حماية: إذا انتهت أعمدة الورقة نضيف أعمدة بدل أن يفشل التسجيل
  if (newColumn > maxColumns) {
    sheet.insertColumnsAfter(maxColumns, newColumn - maxColumns);
  }

  sheet.getRange(1, newColumn).setNumberFormat("@");
  sheet.getRange(1, newColumn).setValue(date);
  sheet.getRange(1, newColumn, sheet.getMaxRows(), 1).setNumberFormat("@");

  cachePut_(PERF_.ATT_COL_KEY + date, String(newColumn), PERF_.ATT_COL_TTL);

  return newColumn;
}

function findDateColumn_(date) {
  const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 3) return 0;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];

  for (let i = 2; i < headers.length; i++) {
    if (String(headers[i]).trim() === date) return i + 1;
  }

  return 0;
}

function nextMemberId_() {
  // دائمًا من الورقة مباشرة (يُستدعى داخل قفل addMember_)
  const sheet = getSheet_(APP_CONFIG.SHEETS.MEMBERS);
  const lastRow = sheet.getLastRow();
  let largest = 0;

  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues()
      .forEach(function (row) {
        const match = String(row[0]).match(/^M(\d+)$/);

        if (match) largest = Math.max(largest, Number(match[1]));
      });
  }

  return "M" + String(largest + 1).padStart(3, "0");
}

function appendLog_(id, name, status, source) {
  getSheet_(APP_CONFIG.SHEETS.LOG).appendRow([
    currentDateTime_(),
    id,
    name,
    status,
    source
  ]);

  // أي سطر جديد في Log قد يغيّر أرقام لوحة المتابعة
  invalidateSummary_();
}

/* =====================================================
   9. الإعدادات والتاريخ والنصوص
   ===================================================== */

function getSpreadsheet_() {
  if (!RUNTIME_.ss) {
    RUNTIME_.ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  return RUNTIME_.ss;
}

function getSheet_(name) {
  if (RUNTIME_.sheets[name]) return RUNTIME_.sheets[name];

  const ss = getSpreadsheet_();
  const sheet = ss && ss.getSheetByName(name);

  if (!sheet) {
    throw new Error(
      'الورقة "' + name + '" غير موجودة. شغّل setupHadir() أولًا.'
    );
  }

  RUNTIME_.sheets[name] = sheet;
  return sheet;
}

function getSettings_() {
  if (RUNTIME_.settings) return RUNTIME_.settings;

  const sheet = getSheet_(APP_CONFIG.SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();
  const settings = {};

  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues()
      .forEach(function (row) {
        const key = String(row[0] || "").trim();

        if (key) settings[key] = String(row[1] || "").trim();
      });
  }

  RUNTIME_.settings = settings;
  return settings;
}

/**
 * وقت البداية ونوع الجلسة فقط (بدون كلمات السر) مع كاش قصير.
 * يُمسح الكاش تلقائيًا عند setSetting_.
 */
function getSessionSettings_() {
  const cached = cacheGet_(PERF_.SESSION_CACHE_KEY);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);

      if (parsed && parsed.startTime && parsed.sessionType) {
        return parsed;
      }
    } catch (error) {
      // نتجاهل الكاش التالف ونقرأ من الورقة
    }
  }

  const settings = getSettings_();
  const result = {
    startTime: String(settings["وقت بداية الجلسة"] || "08:00"),
    sessionType: String(settings["نوع الجلسة"] || "بروفة")
  };

  cachePut_(
    PERF_.SESSION_CACHE_KEY,
    JSON.stringify(result),
    PERF_.SESSION_CACHE_TTL
  );

  return result;
}

function setSetting_(key, value) {
  const sheet = getSheet_(APP_CONFIG.SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();
  let written = false;

  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === key) {
        const cell = sheet.getRange(i + 2, 2);
        cell.setNumberFormat("@");
        cell.setValue(value);
        written = true;
        break;
      }
    }
  }

  if (!written) {
    sheet.appendRow([key, value]);
  }

  RUNTIME_.settings = null;
  cacheRemove_(PERF_.SESSION_CACHE_KEY);
}

/**
 * الوقت الحالي مرة واحدة لكل طلب، فتتطابق كل القيم
 * (حساب التأخير، الوقت المسجَّل، السجل) على لحظة واحدة.
 */
function nowStamp_() {
  if (!RUNTIME_.now) {
    RUNTIME_.now = Utilities.formatDate(
      new Date(),
      APP_CONFIG.TIME_ZONE,
      "yyyy-MM-dd HH:mm:ss"
    );
  }

  return RUNTIME_.now;
}

function today_() {
  return nowStamp_().slice(0, 10);
}

function currentTime_() {
  return nowStamp_().slice(11, 16);
}

function currentDateTime_() {
  return nowStamp_();
}

function addDays_(dateString, days) {
  const parts = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function isValidDate_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parts = date.split("-").map(Number);
  const value = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

  return value.getUTCFullYear() === parts[0] &&
    value.getUTCMonth() === parts[1] - 1 &&
    value.getUTCDate() === parts[2];
}

function cleanText_(value, maxLength) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength || 200);
}

function normalizeArabic_(value) {
  return String(value || "")
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function publicError_(code, message) {
  const error = new Error(message);
  error.isPublicError = true;
  error.code = code;
  return error;
}

function errorResponse_(code, message) {
  return {
    ok: false,
    error: code,
    message: message
  };
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =====================================================
   10. سجل الحضور حسب التاريخ
   ===================================================== */

function getAttendanceByDate_(data) {
  const date = cleanText_(data && data.date, 10);

  if (!isValidDate_(date)) {
    throw publicError_("invalid", "التاريخ المحدد غير صحيح.");
  }

  // الأيام الماضية لا تتغير عمليًا: نخزّنها بضع دقائق.
  // اليوم الحالي لا يُخزَّن هنا أبدًا (له كاش الملخص القصير).
  const cacheable = date < today_();
  const key = PERF_.DAY_KEY + date;

  if (cacheable) {
    const hit = cacheGet_(key);

    if (hit) {
      try {
        return JSON.parse(hit);
      } catch (error) {
        // كاش تالف: نقرأ من الورقة
      }
    }
  }

  const result = readAttendanceByDate_(date);

  if (cacheable) {
    cachePut_(key, JSON.stringify(result), PERF_.DAY_TTL);
  }

  return result;
}

function readAttendanceByDate_(date) {
  const sheet = getSheet_(APP_CONFIG.SHEETS.ATTENDANCE);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 3) {
    return {
      date: date,
      records: [],
      total: 0
    };
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (value) {
      return String(value || "").trim();
    });

  const dateColumnIndex = headers.indexOf(date);

  if (dateColumnIndex < 2) {
    return {
      date: date,
      records: [],
      total: 0
    };
  }

  // نقرأ فقط: عمودي الرقم والاسم + عمود التاريخ المطلوب
  // (بدل قراءة كل الأعمدة وكل الألوان، وهي تكبر مع كل جلسة جديدة)
  const rowCount = lastRow - 1;
  const idNameValues = sheet.getRange(2, 1, rowCount, 2).getDisplayValues();
  const dateRange = sheet.getRange(2, dateColumnIndex + 1, rowCount, 1);
  const dateValues = dateRange.getDisplayValues();

  const records = [];

  for (let i = 0; i < rowCount; i++) {
    const memberId = String(idNameValues[i][0] || "").trim();
    const fullName = String(idNameValues[i][1] || "").trim();
    const attendanceValue = String(dateValues[i][0] || "").trim();

    if (!memberId || !attendanceValue) {
      continue;
    }

    const timeMatch = attendanceValue.match(/([01]?\d|2[0-3]):[0-5]\d/);
    const time = timeMatch ? timeMatch[0] : attendanceValue;

    records.push({
      id: memberId,
      fullName: fullName,
      time: time,
      status: "حاضر"
    });
  }

  records.sort(function (a, b) {
    return a.time.localeCompare(b.time);
  });

  return {
    date: date,
    records: records,
    total: records.length
  };
}

/* =====================================================
   11. ملخص لوحة المتابعة (action: summary)
   ===================================================== */

/**
 * الملخص يُخزَّن 15 ثانية ويُبطَل فورًا مع أي سطر جديد في Log
 * وعند إضافة/تعديل/تعطيل عضو.
 */
function getSummary_() {
  const key = PERF_.SUMMARY_KEY + today_();
  const cached = cacheGet_(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // كاش تالف: نحسب من جديد
    }
  }

  const result = computeSummary_();

  cachePut_(key, JSON.stringify(result), PERF_.SUMMARY_TTL);

  return result;
}

function computeSummary_() {
  const date = today_();

  // كل تسجيل في Attendance يُحتسب حضورًا بغض النظر عن حالة العضوية أو الوقت.
  const attendance = getAttendanceByDate_({ date: date });
  const members = listMembers_().members;
  const memberIds = {};

  members.forEach(function (member) {
    memberIds[member.id] = true;
  });

  const records = attendance.records.filter(function (record) {
    return memberIds[record.id];
  });
  const present = records.length;
  const absent = Math.max(0, members.length - present);

  // آخر 5 تسجيلات (الأحدث أولًا؛ عند تساوي الدقيقة يُعتمد ترتيب الصف)
  const recentCheckIns = records
    .map(function (record, index) {
      return { record: record, index: index };
    })
    .sort(function (a, b) {
      const byTime = b.record.time.localeCompare(a.record.time);
      return byTime !== 0 ? byTime : b.index - a.index;
    })
    .slice(0, 5)
    .map(function (item) {
      return {
        memberId: item.record.id,
        memberName: item.record.fullName,
        status: item.record.status,
        time: item.record.time
      };
    });

  return {
    date: date,
    total: members.length,
    present: present,
    absent: absent,
    recentCheckIns: recentCheckIns
  };
}