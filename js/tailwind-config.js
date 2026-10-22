
(function () {
  "use strict";

  if (typeof tailwind === "undefined") {
    console.error(
      "Hadir: يجب تحميل Tailwind CDN قبل js/tailwind-config.js."
    );
    return;
  }

  tailwind.config = {
    darkMode: "class",

    theme: {
      extend: {
        colors: {
          primary: "#5D1820",
          "primary-container": "#7A2E35",
          secondary: "#795902",
          "secondary-gold": "#C9A24B",

          background: "#FAF7F2",
          surface: "#FAF7F2",
          "surface-container-low": "#F6F3EE",
          "surface-container-lowest": "#FFFFFF",
          "surface-container-high": "#EBE8E3",

          "on-surface": "#1C1C19",
          "on-surface-variant": "#544243",

          outline: "#877272",
          "outline-variant": "#DAC1C1",

          error: "#BA1A1A",
          success: "#3E8E3E",
          warning: "#F2A900",
          muted: "#858585"
        },

        fontFamily: {
          sans: ["Cairo", "sans-serif"],
          body: ["Cairo", "sans-serif"]
        },

        borderRadius: {
          DEFAULT: "0.5rem",
          lg: "0.75rem",
          xl: "1rem",
          "2xl": "1rem"
        },

        minHeight: {
          control: "52px"
        },

        boxShadow: {
          card: "0 10px 24px -6px rgba(122, 46, 53, 0.06), 0 4px 8px -2px rgba(30, 27, 24, 0.03)"
        }
      }
    }
  };
})();
