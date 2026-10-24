/**
 * تحسينات جهة Google Apps Script (الخادم)
 * ------------------------------------------------------------
 * مثال جاهز للنسخ إلى مشروع Apps Script. لم أطّلع على كود الخادم عندك،
 * فالأسماء (listMembers_, summary_, readMembersFromSheet_ ...) أمثلة فقط:
 * عدّلها لتطابق دوالك الفعلية.
 */

/** كاش على مستوى الخادم: يُنفّذ producer مرة كل ttl ثانية فقط. */
function cachedJson_(key, ttlSeconds, producer) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);

  if (hit) {
    return JSON.parse(hit);
  }

  var value = producer();

  try {
    // حد القيمة الواحدة في CacheService هو 100KB تقريباً.
    cache.put(key, JSON.stringify(value), ttlSeconds);
  } catch (e) {
    // القيمة كبيرة جداً: نتجاوز التخزين ونعيد النتيجة مباشرة.
  }

  return value;
}

/** حذف مفاتيح الكاش بعد أي عملية تغيّر البيانات. */
function invalidate_(keys) {
  CacheService.getScriptCache().removeAll(keys);
}

/* ---------------- أمثلة الاستخدام داخل الـ router عندك ---------------- */

// قائمة الأعضاء: تتغير نادراً، فنخزّنها 5 دقائق.
function listMembers_(data) {
  return cachedJson_('members:list', 300, function () {
    return readMembersFromSheet_();
  });
}

// ملخص اليوم: يتغير مع كل مسح، نخزّنه مدة قصيرة جداً.
function summary_(data) {
  return cachedJson_('summary:today', 20, function () {
    return computeSummary_(); // دالتك الحالية
  });
}

// استدعِها بعد إضافة عضو أو تعديله:
function afterAddMember_() {
  invalidate_(['members:list', 'summary:today']);
}

// واستدعِها بعد تسجيل حضور:
function afterScan_() {
  invalidate_(['summary:today']);
}

/**
 * قراءة الشيت: استدعاء واحد getValues() بدل قراءة خلية خلية
 * (كل getRange().getValue() داخل حلقة يكلّف عشرات الميلي ثانية).
 */
function readMembersFromSheet_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Members');
  var values = sheet.getDataRange().getValues();
  var headers = values.shift();

  return values.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * نصائح إضافية:
 * - افتح SpreadsheetApp مرة واحدة لكل طلب (لا تكرر getActive()/openById()).
 * - تجنّب appendRow داخل حلقة؛ اجمع الصفوف واستعمل setValues() مرة واحدة.
 * - استعمل LockService حول عمليات الكتابة فقط، لا حول القراءة.
 */
