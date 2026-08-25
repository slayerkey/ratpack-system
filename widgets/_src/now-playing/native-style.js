/* Marketplace recovery: make the hero gradient visibly honor iCUE native style colors.
 * The authored palette presets still shape companion hues, but the native accent is
 * always a primary gradient field so Custom Style / device Palette changes are obvious.
 */
(function () {
    function hueFromColor(value) {
        var text = String(value || "").trim();
        var r, g, b, match;
        if ((match = /^#([0-9a-f]{3})$/i.exec(text))) {
            r = parseInt(match[1][0] + match[1][0], 16);
            g = parseInt(match[1][1] + match[1][1], 16);
            b = parseInt(match[1][2] + match[1][2], 16);
        } else if ((match = /^#([0-9a-f]{6})$/i.exec(text))) {
            r = parseInt(match[1].slice(0, 2), 16);
            g = parseInt(match[1].slice(2, 4), 16);
            b = parseInt(match[1].slice(4, 6), 16);
        } else if ((match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text))) {
            r = Number(match[1]); g = Number(match[2]); b = Number(match[3]);
        } else {
            return 150;
        }
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
        if (delta === 0) return 0;
        var hue;
        if (max === r) hue = 60 * (((g - b) / delta) % 6);
        else if (max === g) hue = 60 * (((b - r) / delta) + 2);
        else hue = 60 * (((r - g) / delta) + 4);
        return wrapHue(hue);
    }

    paletteHues = function (seed, preset) {
        var r = mulberry32(seed ^ fnv1a(preset));
        var accent = hueFromColor(readSettings().accent);
        if (preset === "neon") return [accent, 302 + r() * 26, 184 + r() * 24, wrapHue(accent - 34 - r() * 18)].map(wrapHue);
        if (preset === "ember") return [accent, 18 + r() * 28, 326 + r() * 28, wrapHue(accent + 42 + r() * 18)].map(wrapHue);
        if (preset === "ocean") return [accent, 184 + r() * 34, 220 + r() * 34, wrapHue(accent - 28 - r() * 18)].map(wrapHue);
        return [
            accent,
            wrapHue(accent + 24 + r() * 46),
            wrapHue(accent + 138 + r() * 72),
            wrapHue(accent - 28 - r() * 38)
        ];
    };
})();
