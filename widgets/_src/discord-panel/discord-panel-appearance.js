/* PackRat Voice Panel appearance extensions.
 * Loaded after discord-panel-ui.js so it can extend the canonical iCUE
 * settings path without duplicating the voice/state implementation.
 */

(function () {
  var FONT_STACKS = {
    default: {
      ui: '"Segoe UI", Arial, sans-serif',
      display: '"Bahnschrift", "Segoe UI", sans-serif'
    },
    segoe: {
      ui: '"Segoe UI", Arial, sans-serif',
      display: '"Segoe UI", Arial, sans-serif'
    },
    bahnschrift: {
      ui: '"Bahnschrift", "Segoe UI", sans-serif',
      display: '"Bahnschrift", "Segoe UI", sans-serif'
    },
    arial: {
      ui: 'Arial, sans-serif',
      display: 'Arial, sans-serif'
    },
    consolas: {
      ui: 'Consolas, "Courier New", monospace',
      display: 'Consolas, "Courier New", monospace'
    },
    georgia: {
      ui: 'Georgia, "Times New Roman", serif',
      display: 'Georgia, "Times New Roman", serif'
    }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function numericProperty(name, fallback) {
    var raw = getIcueProperty(name, fallback);
    var value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function applyPanelAppearance() {
    var root = document.documentElement;
    var opacityPercent = clamp(numericProperty("panelOpacity", 100), 0, 100);
    var opacity = opacityPercent / 100;
    var fontKey = String(getIcueProperty("fontFamily", "default") || "default").toLowerCase();
    var font = FONT_STACKS[fontKey] || FONT_STACKS.default;

    root.style.setProperty("--panel-opacity", String(opacity));
    root.style.setProperty("--panel-top-alpha", String(0.82 * opacity));
    root.style.setProperty("--panel-bottom-alpha", String(0.72 * opacity));
    root.style.setProperty("--activity-alpha", String(0.62 * opacity));
    root.style.setProperty("--control-alpha", String(0.82 * opacity));
    root.style.setProperty("--chip-alpha", String(0.45 * opacity));
    root.style.setProperty("--font-ui", font.ui);
    root.style.setProperty("--font-display", font.display);
  }

  var baseApplySettings = applySettings;
  applySettings = function () {
    baseApplySettings();
    applyPanelAppearance();
  };

  globalThis.__PACKRAT_DISCORD_APPEARANCE__ = {
    apply: applyPanelAppearance,
    fonts: Object.keys(FONT_STACKS)
  };
})();
