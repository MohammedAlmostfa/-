
"use strict";

/**
 * Hadir - Bottom Navigation
 * إنشاء شريط التنقل السفلي حسب دور المستخدم.
 */

(function () {
  const NAVIGATION_ITEMS = {
    owner: [
      {
        label: "الرئيسية",
        href: APP_PAGES.home,
        icon: "home",
        page: "home.html"
      },
      {
        label: "مسح الحضور",
        href: APP_PAGES.scan,
        icon: "scan",
        page: "scan.html"
      },
      {
        label: "الأعضاء",
        href: APP_PAGES.members,
        icon: "users",
        page: "members.html"
      },
      {
        label: "السجل",
        href: APP_PAGES.log,
        icon: "clipboard-list",
        page: "log.html"
      }
    ],

    observer: [
      {
        label: "مسح الحضور",
        href: APP_PAGES.scan,
        icon: "scan",
        page: "scan.html"
      }
    ]
  };

  /**
   * أيقونات SVG ثابتة لتجنّب إدخال HTML قادم من المستخدم.
   */
  const ICONS = {
    home:
      '<path d="m3 10 9-7 9 7"></path>' +
      '<path d="M5 9v11h14V9"></path>' +
      '<path d="M9 20v-6h6v6"></path>',

    scan:
      '<path d="M4 8V4h4"></path>' +
      '<path d="M16 4h4v4"></path>' +
      '<path d="M20 16v4h-4"></path>' +
      '<path d="M8 20H4v-4"></path>' +
      '<path d="M7 12h10"></path>',

    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>' +
      '<circle cx="10" cy="7" r="4"></circle>' +
      '<path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>' +
      '<path d="M17 3.13a4 4 0 0 1 0 7.75"></path>',

    "clipboard-list":
      '<rect x="5" y="4" width="14" height="17" rx="2"></rect>' +
      '<path d="M9 4.5V3h6v1.5"></path>' +
      '<path d="M9 10h6"></path>' +
      '<path d="M9 14h6"></path>' +
      '<path d="M9 18h3"></path>'
  };

  function createIcon(name) {
    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    /*
     * محتوى الأيقونات من ثوابت محلية داخل هذا الملف،
     * وليس من بيانات المستخدم أو الخادم.
     */
    const paths = ICONS[name];

    if (paths) {
      const template = document.createElement("template");
      template.innerHTML = paths;
      svg.appendChild(template.content.cloneNode(true));
    }

    return svg;
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf("/") + 1);

    return filename || "index.html";
  }

  function renderBottomNavigation() {
    const container = document.getElementById("bottom-nav");

    if (!container) {
      return;
    }

    const role = getSessionRole();
    const currentPage = getCurrentPage();

    /*
     * لا نعرض التنقل في الصفحات العامة أو عند عدم وجود جلسة.
     */
    if (
      currentPage === "index.html" ||
      currentPage === "excuse.html" ||
      !getSessionToken() ||
      !NAVIGATION_ITEMS[role]
    ) {
      container.replaceChildren();
      container.hidden = true;
      return;
    }

    container.hidden = false;
    container.replaceChildren();

    const nav = document.createElement("nav");
    nav.className = "bottom-nav-inner";
    nav.setAttribute("aria-label", "التنقل الرئيسي");

    NAVIGATION_ITEMS[role].forEach(function (item) {
      const link = document.createElement("a");

      link.className = "bottom-nav-item";
      link.href = item.href;

      const isActive = currentPage === item.page;

      if (isActive) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }

      link.appendChild(createIcon(item.icon));

      const label = document.createElement("span");
      label.textContent = item.label;

      link.appendChild(label);
      nav.appendChild(link);
    });

    container.appendChild(nav);
  }

  /*
   * تشغيل التنقل بعد تجهيز عناصر الصفحة.
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      renderBottomNavigation
    );
  } else {
    renderBottomNavigation();
  }

  /*
   * نوفّر الدالة للصفحات التي تحتاج إعادة رسم الشريط
   * بعد تغيّر حالة الجلسة.
   */
  window.renderBottomNavigation = renderBottomNavigation;
})();
