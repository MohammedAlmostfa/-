
"use strict";

const API_URL = "https://script.google.com/macros/s/AKfycbyu1_DO73fafb3Fhf4aPNIMeWX9I4ip8Mp3EFK7rQGfP-Sc8PFSTSYH9L08ouUhMsZokQ/exec"

const APP_NAME = "حاضر";
const APP_VERSION = "1.0.0";
const APP_TIME_ZONE = "Asia/Damascus";

const APP_PAGES = Object.freeze({
  login: "index.html",
  home: "home.html",
  scan: "scan.html",
  addMember: "add-member.html",
  memberCard: "member-card.html",
  members: "members.html",
  member: "member.html",
  excuses: "excuses.html",
  pending: "pending.html",
  log: "log.html",
  excuse: "excuse.html"
});

const APP_ROLES = Object.freeze({
  OBSERVER: "observer",
  OWNER: "owner"
});

const SESSION_KEYS = Object.freeze({
  TOKEN: "hadir_token",
  ROLE: "hadir_role"
});

/**
 * مكتبات خارجية بإصدارات مثبّتة، تُحمَّل عند الحاجة فقط (انظر loadScriptOnce في api.js).
 */
const LIB_URLS = Object.freeze({
  html5Qrcode: "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js",
  html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
});
