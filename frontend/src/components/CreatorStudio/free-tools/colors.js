export function hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generatePaletteColors(count, hRange, sRange, lRange) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const h = randomRange(hRange[0], hRange[1]);
        const s = randomRange(sRange[0], sRange[1]);
        const l = randomRange(lRange[0], lRange[1]);
        colors.push(hslToHex(h, s, l));
    }
    return colors;
}
