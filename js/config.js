
"use strict";

const API_URL = "https://script.google.com/macros/s/AKfycbypex4cy9OvBxQD_yNroCCwC9blvMrTROc78QDPlFqWziDKZcbvHHkvaBUubLWcjeGALQ/exec";

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
