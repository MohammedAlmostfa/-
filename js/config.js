
"use strict";

const API_URL = "https://script.google.com/macros/s/AKfycbwF2ECT4BpiJ2kGV2GyH_1AauppckpYoe8Vnu4eN278rgb7_tPeQrAaOL5zB0F8qjFg6Q/exec";

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
