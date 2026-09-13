import React, { useState, useCallback, useRef } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { FaqAccordion } from "./ColorPaletteUI";
import { Copy, Check, Download, ChevronDown, ChevronUp } from "lucide-react";
import { toPng } from "html-to-image";

// ─────────────────────────────────────────────────────────
//  Color Utility Functions
// ─────────────────────────────────────────────────────────

function hexToHsl(hex) {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(h, s, l) {
  const sn = s / 100,
    ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}
function parseAnyColor(input) {
  const trimmed = input.trim();
  if (/^#?[0-9A-Fa-f]{6}$/.test(trimmed.replace("#", ""))) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }
  const rgbMatch = trimmed.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  const hslMatch = trimmed.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
  if (hslMatch) return hslToHex(+hslMatch[1], +hslMatch[2], +hslMatch[3]);
  return null;
}
function generateScale(hex, steps) {
  const hsl = hexToHsl(hex);
  if (!hsl) return {
    tints: [],
    shades: []
  };
  const [h, s, l] = hsl;
  const tints = [];
  for (let i = steps; i >= 1; i--) {
    const ratio = i / steps;
    const newL = l + (100 - l) * ratio;
    const newS = Math.max(0, s * (1 - ratio * 0.25));
    tints.push(hslToHex(h, newS, Math.min(99, newL)));
  }
  const shades = [];
  for (let i = 1; i <= steps; i++) {
    const ratio = i / steps;
    const newL = l * (1 - ratio);
    const newS = Math.min(100, s * (1 + ratio * 0.1));
    shades.push(hslToHex(h, newS, Math.max(1, newL)));
  }
  return {
    tints,
    shades
  };
}
function getDisplayValue(hex, format) {
  if (format === "hex") return hex.toUpperCase();
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (format === "rgb") return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
}
function isLight(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const [r, g, b] = rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b > 128;
}

// ─────────────────────────────────────────────────────────
//  Single Swatch
// ─────────────────────────────────────────────────────────
const Swatch = ({
  hex,
  label,
  format,
  isBase
}) => {
  const [copied, setCopied] = useState(false);
  const displayVal = getDisplayValue(hex, format);
  const copy = () => {
    navigator.clipboard.writeText(displayVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return <div onClick={copy} className={`min-w-[60px] flex-shrink-0 flex flex-col cursor-pointer group transition-transform duration-150 hover:-translate-y-1 ${isBase ? "ring-2 ring-offset-2 ring-primary rounded-xl" : ""}`}>
            <div className="rounded-xl flex-1 relative flex items-center justify-center" style={{
      background: hex,
      minHeight: "200px"
    }}>
                <span className={`text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 text-white px-1.5 py-0.5 rounded-full absolute bottom-2`}>
                    {copied ? "✓" : "Copy"}
                </span>
                {isBase && <span className={`absolute top-2 left-0 right-0 flex justify-center`}>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-black/40 text-white px-2 py-0.5 rounded-full">BASE</span>
                    </span>}
            </div>
            <div className="mt-1.5 text-center px-0.5">
                <div className="text-[10px] font-bold font-mono text-foreground truncate">{label}</div>
                <div className="text-[9px] text-muted-foreground font-mono truncate">{hex.toUpperCase()}</div>
            </div>
        </div>;
};

// ─────────────────────────────────────────────────────────
//  Copy Button
// ─────────────────────────────────────────────────────────
const CopyBtn = ({
  text,
  label,
  className = ""
}) => {
  const [copied, setCopied] = useState(false);
  return <button onClick={() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-border bg-card hover:bg-accent transition-all ${className}`}>
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? "Copied!" : label}
        </button>;
};

// ─────────────────────────────────────────────────────────
//  FAQ
// ─────────────────────────────────────────────────────────
const FAQ_ITEMS = [{
  q: "What is the difference between a tint and a shade?",
  a: "A tint is created by mixing a color with white, making it lighter. A shade is created by mixing a color with black, making it darker. Together they form a complete color scale from near-white to near-black."
}, {
  q: "How many tints and shades should I generate?",
  a: "For most design systems, 10 steps (5 tints + 5 shades) is standard. For comprehensive Tailwind-style systems, 10 steps per side (like 100–900) is ideal. This tool lets you go up to 25 steps per side for maximum granularity."
}, {
  q: "What's the difference between HSL mixing and RGB mixing for tints?",
  a: "RGB mixing (directly interpolating r, g, b values toward 255 or 0) often produces grey, washed-out midpoints. HSL mixing (adjusting lightness while preserving hue and saturation) produces perceptually natural, vibrant color scales."
}, {
  q: "How do I use the CSS variables export in my project?",
  a: "Copy the exported CSS variables and paste them inside a :root {} block in your global CSS file. Then reference them as var(--color-100), var(--color-500) etc. throughout your stylesheets."
}, {
  q: "How do I use the Tailwind export?",
  a: "Copy the exported object and paste it inside the `extend.colors` section of your tailwind.config.js, giving it a name like 'brand'. You'll then have brand-100, brand-200, etc. available as Tailwind classes."
}];
export default function TintShadeGenerator() {
  const [inputValue, setInputValue] = useState("#6366F1");
  const [baseHex, setBaseHex] = useState("#6366F1");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState(24);
  const [format, setFormat] = useState("hex");
  const [showCssExport, setShowCssExport] = useState(false);
  const [showTailwindExport, setShowTailwindExport] = useState(false);
  const swatchRef = useRef(null);
  const {
    tints,
    shades
  } = generateScale(baseHex, steps);
  const allColors = [...tints, baseHex, ...shades];
  const getTintLabel = i => {
    const val = Math.round((steps - i) / steps * 450 + 50);
    return `${val}`;
  };
  const getShadeLabel = i => {
    const val = Math.round(i / steps * 450 + 500);
    return `${val}`;
  };
  const handleInput = useCallback(val => {
    setInputValue(val);
    const parsed = parseAnyColor(val);
    if (parsed) {
      setBaseHex(parsed);
      setError("");
    } else {
      setError("Enter a valid HEX (#RRGGBB), RGB (rgb(r,g,b)), or HSL (hsl(h,s%,l%)) color");
    }
  }, []);
  const cssVars = [...tints.map((c, i) => `  --color-${getTintLabel(i)}: ${c};`), `  --color-500: ${baseHex}; /* base */`, ...shades.map((c, i) => `  --color-${getShadeLabel(i + 1)}: ${c};`)].join("\n");
  const tailwindColors = [...tints.map((c, i) => `    '${getTintLabel(i)}': '${c}',`), `    '500': '${baseHex}', // base`, ...shades.map((c, i) => `    '${getShadeLabel(i + 1)}': '${c}',`)].join("\n");
  const handleDownload = async () => {
    if (!swatchRef.current) return;
    try {
      // html-to-image bug workaround: 'trim of undefined' often happens with SVG elements from lucide-react. 
      // We use the filter function to exclude SVG nodes during rendering.
      const filter = node => {
        const exclusionClasses = ['lucide'];
        return !exclusionClasses.some(classname => node.classList?.contains(classname));
      };
      const url = await toPng(swatchRef.current, {
        cacheBust: true,
        style: {
          padding: "32px",
          background: "#ffffff"
        },
        filter: node => {
          // Try to filter out SVG elements that cause the trim error
          if (node.tagName && node.tagName.toLowerCase() === 'svg') return false;
          return true;
        }
      });
      const a = document.createElement("a");
      a.download = `tint-shade-${baseHex.replace("#", "")}-inspo.png`;
      a.href = url;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };
  const hsl = hexToHsl(baseHex);
  const rgb = hexToRgb(baseHex);
  return <FreeToolLayout toolName="Tint & Shade Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "HEX to RGB Converter",
    href: "/free-tools/hex-to-rgb-converter"
  }, {
    name: "Color Contrast Checker",
    href: "/free-tools/color-contrast-checker"
  }]}>
            <SEO title="Tint & Shade Generator — Free Color Scale Tool | Inspo AI" description="Generate 40 tints and shades from any color. Copy HEX, RGB, HSL. Export CSS custom properties or Tailwind config. 100% free." keywords="tint shade generator, color scale generator, color tints, color shades, css color variables, tailwind color palette, color system" schemaMarkup={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Tint & Shade Generator by Inspo AI",
      "applicationCategory": "DesignApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }} />

            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Tint & Shade <span className="inspo-gradient-text">Generator</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Get up to 50 perfectly balanced tints and shades from any color instantly.
                    </p>
                </div>

                {/* TOP CONTROLS ROW (Single horizontal line) */}
                <div className="bg-card rounded-3xl border border-border shadow-inspo p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                        {/* 1. Color Input */}
                        <div className="flex-1 w-full max-w-xs">
                            <label className="block text-sm font-semibold text-foreground mb-2">Color Input</label>
                            <div className="flex items-center gap-3">
                                <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-sm shrink-0 border border-black/10" style={{
                background: baseHex
              }}>
                                    <input type="color" value={baseHex} onChange={e => {
                  setBaseHex(e.target.value);
                  setInputValue(e.target.value);
                  setError("");
                }} className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer opacity-0" />
                                </div>
                                <input type="text" value={inputValue} onChange={e => handleInput(e.target.value)} placeholder="#6366F1" className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0" />
                            </div>
                            {error && <p className="text-xs text-red-500 mt-2 absolute">{error}</p>}
                        </div>

                        {/* 2. Steps Slider */}
                        <div className="flex-1 w-full max-w-sm px-4">
                            <label className="flex justify-between items-end mb-2">
                                <span className="text-sm font-semibold text-foreground">Steps per side: <span className="text-primary">{steps}</span></span>
                                <span className="text-xs text-muted-foreground">{steps * 2 + 1} total swatches</span>
                            </label>
                            <input type="range" min={5} max={25} value={steps} onChange={e => setSteps(+e.target.value)} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" style={{
              background: `linear-gradient(to right, #6366F1 0%, #6366F1 ${(steps - 5) / 20 * 100}%, hsl(var(--muted)) ${(steps - 5) / 20 * 100}%, hsl(var(--muted)) 100%)`
            }} />
                            <style dangerouslySetInnerHTML={{
              __html: `
                                input[type=range]::-webkit-slider-thumb {
                                    -webkit-appearance: none;
                                    height: 20px;
                                    width: 20px;
                                    border-radius: 50%;
                                    background: white;
                                    border: 2px solid #e5e7eb;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                                    cursor: pointer;
                                    margin-top: -9px;
                                }
                                input[type=range]::-webkit-slider-runnable-track {
                                    width: 100%;
                                    height: 4px;
                                    cursor: pointer;
                                    background: transparent;
                                    border-radius: 4px;
                                }
                            `
            }} />
                            <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-2 px-0.5">
                                <span>5</span><span>25</span>
                            </div>
                        </div>

                        {/* 3. Format Toggle */}
                        <div className="flex-none">
                            <label className="block text-sm font-semibold text-foreground mb-2">Copy Format</label>
                            <div className="flex rounded-xl bg-muted p-1">
                                {["hex", "rgb", "hsl"].map(f => <button key={f} onClick={() => setFormat(f)} className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${format === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                        {f}
                                    </button>)}
                            </div>
                        </div>

                    </div>

                    {/* Action Buttons (Below controls, aligned right) */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-border">
                        <div className="text-xs font-mono text-muted-foreground flex gap-4">
                            {rgb && hsl && !error && <>
                                    <span>RGB: <strong className="text-foreground font-medium">{rgb[0]}, {rgb[1]}, {rgb[2]}</strong></span>
                                    <span className="opacity-40">•</span>
                                    <span>HSL: <strong className="text-foreground font-medium">{hsl[0]}°, {hsl[1]}%, {hsl[2]}%</strong></span>
                                </>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <CopyBtn text={allColors.map(c => getDisplayValue(c, format)).join(", ")} label="Copy All HEX" />
                            <button onClick={handleDownload} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-border bg-card hover:bg-accent transition-all">
                                <Download size={14} /> PNG
                            </button>
                            <button onClick={() => {
              setShowCssExport(!showCssExport);
              setShowTailwindExport(false);
            }} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${showCssExport ? "bg-primary text-white border-primary" : "border-border bg-card hover:bg-accent"}`}>
                                CSS Vars {showCssExport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button onClick={() => {
              setShowTailwindExport(!showTailwindExport);
              setShowCssExport(false);
            }} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${showTailwindExport ? "bg-primary text-white border-primary" : "border-border bg-card hover:bg-accent"}`}>
                                Tailwind {showTailwindExport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Export Panels */}
                    {showCssExport && <div className="mt-4 bg-muted rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-foreground">CSS Custom Properties</span>
                                <CopyBtn text={`:root {\n${cssVars}\n}`} label="Copy" className="text-xs py-1 px-3" />
                            </div>
                            <pre className="text-[11px] font-mono text-foreground/80 overflow-auto max-h-48 leading-relaxed">
                                {`:root {\n${cssVars}\n}`}
                            </pre>
                        </div>}

                    {showTailwindExport && <div className="mt-4 bg-muted rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-foreground">tailwind.config.js → extend.colors.brand</span>
                                <CopyBtn text={`// tailwind.config.js\nmodule.exports = {\n  theme: { extend: { colors: { brand: {\n${tailwindColors}\n  }}}}\n}`} label="Copy" className="text-xs py-1 px-3" />
                            </div>
                            <pre className="text-[11px] font-mono text-foreground/80 overflow-auto max-h-48 leading-relaxed">
                                {`colors: {\n  brand: {\n${tailwindColors}\n  }\n}`}
                            </pre>
                        </div>}
                </div>

                {/* SWATCH AREA (Immediately below controls) */}
                <div className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 mb-6 overflow-visible" ref={swatchRef}>
                    {/* Tints */}
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-2xl font-display italic font-semibold text-foreground"><span>Tints</span></h2>
                        <div className="text-muted-foreground text-sm flex-1">({tints.length} — lighter)</div>
                        <CopyBtn text={tints.map(c => getDisplayValue(c, format)).join(", ")} label={`Copy ${tints.length} tints`} className="!bg-background" />
                    </div>
                    <div className="flex gap-1.5 mb-8 overflow-x-auto pb-4 scrollbar-thin">
                        {tints.map((c, i) => <Swatch key={c + i} hex={c} label={getTintLabel(i)} format={format} />)}
                    </div>

                    {/* Base */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 border-t border-dashed border-border" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg shadow-sm border border-black/10" style={{
              background: baseHex
            }} />
                            <div>
                                <div className="text-xs font-bold text-foreground">Base Color — 500</div>
                                <div className="text-[10px] font-mono text-muted-foreground">{baseHex.toUpperCase()}</div>
                            </div>
                        </div>
                        <div className="flex-1 border-t border-dashed border-border" />
                    </div>

                    {/* Shades */}
                    <div className="flex items-center gap-4 mb-4 mt-8">
                        <h2 className="text-2xl font-display italic font-semibold text-foreground"><span>Shades</span></h2>
                        <div className="text-muted-foreground text-sm flex-1">({shades.length} — darker)</div>
                        <CopyBtn text={shades.map(c => getDisplayValue(c, format)).join(", ")} label={`Copy ${shades.length} shades`} className="!bg-background" />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-thin">
                        {shades.map((c, i) => <Swatch key={c + i} hex={c} label={getShadeLabel(i + 1)} format={format} />)}
                    </div>
                </div>

                {/* UI PREVIEW AREA (Bottom) */}
                <div className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 mb-10">
                    <h2 className="text-lg font-semibold text-foreground text-center mb-6">Real-world UI <span>examples</span></h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {/* Light Mode */}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Light Mode Application</p>
                            <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                                <div className="h-2" style={{
                background: baseHex
              }} />
                                <div className="p-6" style={{
                background: tints[Math.min(1, tints.length - 1)] || "#f9fafb"
              }}>
                                    <div className="w-24 h-4 rounded-full mb-3" style={{
                  background: baseHex
                }} />
                                    <div className="w-full h-2.5 rounded bg-black/10 mb-2" />
                                    <div className="w-4/5 h-2.5 rounded bg-black/5 mb-6" />
                                    <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5" style={{
                  background: baseHex
                }}>
                                        Primary Action →
                                    </button>
                                    <button className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ml-3 border" style={{
                  background: "white",
                  borderColor: baseHex,
                  color: baseHex
                }}>
                                        Secondary
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Dark Mode */}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Dark Mode Application</p>
                            <div className="rounded-2xl border border-white/10 overflow-hidden shadow-sm" style={{
              background: shades[Math.min(4, shades.length - 1)] || "#111"
            }}>
                                <div className="h-2" style={{
                background: baseHex
              }} />
                                <div className="p-6">
                                    <div className="w-24 h-4 rounded-full mb-3" style={{
                  background: tints[Math.min(3, tints.length - 1)] || "#eee"
                }} />
                                    <div className="w-full h-2.5 rounded bg-white/15 mb-2" />
                                    <div className="w-4/5 h-2.5 rounded bg-white/10 mb-6" />
                                    <button className="px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5" style={{
                  background: baseHex,
                  color: isLight(baseHex) ? "#000" : "#fff"
                }}>
                                        Primary Action →
                                    </button>
                                    <button className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ml-3 border bg-white/5 hover:bg-white/10" style={{
                  borderColor: baseHex,
                  color: tints[Math.min(3, tints.length - 1)] || "#eee"
                }}>
                                        Secondary
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SEO Content */}
                <section className="max-w-3xl mx-auto mb-4">
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        A tint & shade generator is an essential tool for any designer building a systematic color palette. By taking a single brand color and generating scientifically accurate lighter (tints) and darker (shades) variations, you create a complete color scale ready for use in any design system, CSS framework, or UI component library.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">What are tints and <span>shades</span>?</h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        A <strong className="text-foreground">tint</strong> is any color created by adding white to a base color — making it lighter and more pastel-like. A <strong className="text-foreground">shade</strong> is any color created by adding black — making it darker and more shadow-like. Together, tints and shades form a monochromatic color scale that is fundamental to all modern design systems (Tailwind, Material Design, Radix, etc.).
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Why use HSL mixing instead of <span>RGB</span>?</h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Simple linear RGB tinting (interpolating RGB channels toward 255) often produces washed-out, grey, dead-looking midpoints. This tool uses HSL adjustment — keeping your hue and saturation intact while only shifting lightness — producing perceptually vivid, natural-looking scales that look just as you'd expect from professional design tools.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">How to use in a Tailwind <span>project</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Click "Tailwind Config" above, copy the exported object, and paste it under <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">theme.extend.colors</code> in your <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">tailwind.config.js</code>. You'll instantly have classes like <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">brand-100</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">brand-500</code>, and <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">brand-900</code> available across your entire project.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">How to use in Vanilla <span>CSS</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        Click "CSS Vars" above and copy the exported block. Paste it inside a <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">:root {"{}"}</code> declaration in your global stylesheet. You can then use <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">var(--color-100)</code> through <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">var(--color-900)</code> anywhere in your CSS — enabling theming and dark mode support with ease.
                    </p>
                </section>

                <FaqAccordion items={FAQ_ITEMS} />
            </div>
        </FreeToolLayout>;
}